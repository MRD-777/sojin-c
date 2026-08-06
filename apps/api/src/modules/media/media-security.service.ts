// ============================================
// 📸 MediaSecurityService — defense layer for the Media module
//
// Threat model (in plain terms):
//   1. Client uploads an .exe renamed to .jpg              → magic-byte check
//   2. Client lies about fileSize/mimeType                  → re-derived server-side
//   3. Client writes to "../../prod-secrets" via path       → path scoping + UUID
//   4. Client picks the bucket on the wire                  → bucket from MEDIA_TYPE_POLICY
//   5. Client crafts a path under another tenant's prefix   → assertPathBelongsToTenant
//   6. Client signs upload, never registers media           → orphan cleanup
//   7. Client shares a long-lived public read URL           → private buckets + short TTL
//
// Why a separate service (and not inline in MediaService):
//   - Single place to swap the storage backend later (S3 / R2) without touching
//     the workflow code in MediaService.
//   - Single place to add malware scanning when ClamAV lands (skill 05 §8).
//   - Unit-testable in isolation: the verification logic does not need a real
//     Prisma client or audit log to be exercised.
// ============================================
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MediaType } from '@prisma/client';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { JwtPayload } from '../../common/decorators';
import {
  ALWAYS_BLOCKED_MIMES,
  MAGIC_BYTES_SAMPLE_SIZE,
  MEDIA_TYPE_POLICY,
  SIGNED_URL_TTL_SECONDS,
} from './media-security.constants';
// file-type v16 is the last CommonJS release; v17+ is ESM-only and breaks
// Jest's resolver (the ts-jest CJS pipeline cannot resolve a dynamic import
// of an ESM-only package). v16 still gets us robust magic-byte detection
// for every format we care about — swap when we move the whole API to ESM.
import * as fileType from 'file-type';

/**
 * Result of a successful verification — what the caller should commit to the
 * DB. `size` and `mime` here are server-derived, NOT client-supplied.
 */
export interface VerifiedFile {
  readonly bucket: string;
  readonly path: string;
  readonly mime: string;
  readonly size: number;
  /** Detected extension (jpg/png/mp4/pdf/…) — derived from magic bytes. */
  readonly extension: string;
}


@Injectable()
export class MediaSecurityService {
  private readonly logger = new Logger(MediaSecurityService.name);
  private readonly supabase: SupabaseClient;
  private readonly supabaseUrl: string;
  private readonly serviceRoleKey: string;

  constructor(private readonly config: ConfigService) {
    this.supabaseUrl = this.config.getOrThrow<string>('NEXT_PUBLIC_SUPABASE_URL');
    this.serviceRoleKey = this.config.getOrThrow<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );
    this.supabase = createClient(this.supabaseUrl, this.serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  // ─── Path generation ───────────────────────────────────

  /**
   * Returns a storage path that is GUARANTEED safe:
   *   - Starts with `{companyId}/{userId}/` — tenant isolation by design
   *   - Uses a random UUID — no client filename ever appears in the path
   *   - Uses the policy-defined extension for the requested MediaType
   *
   * The original filename is intentionally discarded. Persisting it as a
   * `caption` or DB metadata is fine (and that's the caller's choice), but
   * the storage path itself must contain nothing the client controls.
   */
  generateUploadPath(user: JwtPayload, type: MediaType): {
    bucket: string;
    path: string;
  } {
    const policy = MEDIA_TYPE_POLICY[type];
    // Pick the most common extension for the type — the actual extension is
    // re-derived from magic bytes during verifyUploadedFile. This is purely
    // for filename ergonomics in storage UIs.
    const ext = policy.extensions[0];
    const path = `${user.companyId}/${user.userId}/${randomUUID()}.${ext}`;
    return { bucket: policy.bucket, path };
  }

  // ─── Tenant scoping ────────────────────────────────────

  /**
   * Rejects any path that does not start with `{user.companyId}/`. This is
   * the LAST line of defense against a client that bypasses getUploadUrl
   * and tries to register a media row pointing at another tenant's data.
   *
   * @throws BadRequestException with a deliberately vague message — we do
   *         not confirm whether the foreign path exists.
   */
  assertPathBelongsToTenant(user: JwtPayload, path: string): void {
    if (typeof path !== 'string' || path.length === 0) {
      throw new BadRequestException('مسار الملف غير صالح');
    }
    // Reject obvious traversal attempts even if the prefix would pass —
    // belt-and-braces against future bucket-policy mistakes.
    if (path.includes('..') || path.startsWith('/') || path.includes('\\')) {
      throw new BadRequestException('مسار الملف غير صالح');
    }
    const expectedPrefix = `${user.companyId}/`;
    if (!path.startsWith(expectedPrefix)) {
      throw new BadRequestException('مسار الملف غير صالح');
    }
  }

  // ─── Upload URL issuance ───────────────────────────────

  /**
   * Asks Supabase for a single-use signed upload URL bound to the path
   * we generated. The bucket is chosen from MEDIA_TYPE_POLICY — the
   * client cannot influence it, which closes the "upload PDF to the
   * company-logos public bucket" attack.
   */
  async createSignedUploadUrl(user: JwtPayload, type: MediaType) {
    const { bucket, path } = this.generateUploadPath(user, type);

    const { data, error } = await this.supabase.storage
      .from(bucket)
      .createSignedUploadUrl(path);

    if (error || !data) {
      this.logger.error(
        `Failed to create signed upload URL: bucket=${bucket} path=${path} err=${error?.message}`,
      );
      throw new InternalServerErrorException('فشل في إنشاء رابط الرفع');
    }

    return {
      bucket,
      path: data.path ?? path,
      signedUrl: data.signedUrl,
      token: data.token,
      // Echo the policy back so the client can short-circuit invalid uploads
      // (oversize, wrong type) before hitting the network.
      maxSize: MEDIA_TYPE_POLICY[type].maxSize,
      allowedMimes: MEDIA_TYPE_POLICY[type].mimes,
    };
  }

  // ─── Verification (post-upload) ────────────────────────

  /**
   * Verifies an object the client claims to have uploaded:
   *   1. HEAD the object to confirm it exists + read the real Content-Length
   *   2. Reject if size > policy.maxSize (the wire-time limit could be lax)
   *   3. GET the first MAGIC_BYTES_SAMPLE_SIZE bytes via a Range request
   *   4. Detect the mime via `file-type` — magic bytes, not the client header
   *   5. Reject if detected mime is in ALWAYS_BLOCKED_MIMES
   *   6. Reject if detected mime is not in MEDIA_TYPE_POLICY[type].mimes
   *
   * @throws BadRequestException with a specific Arabic message on rejection
   * @throws NotFoundException when Supabase says the object isn't there
   */
  async verifyUploadedFile(
    bucket: string,
    path: string,
    expectedType: MediaType,
  ): Promise<VerifiedFile> {
    const policy = MEDIA_TYPE_POLICY[expectedType];
    const objectUrl = this.objectUrl(bucket, path);

    // 1. HEAD → existence + real size
    const head = await fetch(objectUrl, {
      method: 'HEAD',
      headers: { Authorization: `Bearer ${this.serviceRoleKey}` },
    });
    if (head.status === 404 || head.status === 400) {
      throw new NotFoundException('لم يتم العثور على الملف المرفوع');
    }
    if (!head.ok) {
      this.logger.error(
        `Storage HEAD failed: bucket=${bucket} path=${path} status=${head.status}`,
      );
      throw new InternalServerErrorException('فشل في التحقق من الملف');
    }

    const contentLength = head.headers.get('content-length');
    const size = contentLength ? parseInt(contentLength, 10) : 0;
    if (!Number.isFinite(size) || size <= 0) {
      throw new BadRequestException('الملف فارغ أو غير صالح');
    }
    if (size > policy.maxSize) {
      throw new BadRequestException(
        `حجم الملف يتجاوز الحد المسموح (${Math.round(
          policy.maxSize / (1024 * 1024),
        )} MB)`,
      );
    }

    // 2. Range GET → just enough bytes to detect the type
    const range = await fetch(objectUrl, {
      headers: {
        Authorization: `Bearer ${this.serviceRoleKey}`,
        Range: `bytes=0-${MAGIC_BYTES_SAMPLE_SIZE - 1}`,
      },
    });
    if (!range.ok && range.status !== 206) {
      this.logger.error(
        `Storage range GET failed: bucket=${bucket} path=${path} status=${range.status}`,
      );
      throw new InternalServerErrorException('فشل في قراءة الملف');
    }

    const headBytes = Buffer.from(await range.arrayBuffer());
    if (headBytes.length === 0) {
      throw new BadRequestException('الملف فارغ أو غير صالح');
    }

    // 3. file-type detection (magic bytes, NOT the client's Content-Type).
    // v16 exposes `fromBuffer` on the module namespace.
    const detected = await fileType.fromBuffer(headBytes);
    if (!detected) {
      throw new BadRequestException('نوع الملف غير معروف أو تالف');
    }

    // 4. Deny-list runs BEFORE the per-type allowlist so that an attacker
    // who somehow lands their script inside an IMAGE upload still gets a
    // clear rejection reason in the audit log.
    if (ALWAYS_BLOCKED_MIMES.includes(detected.mime)) {
      this.logger.warn(
        `Blocked-mime upload attempt: bucket=${bucket} path=${path} mime=${detected.mime}`,
      );
      throw new BadRequestException('نوع الملف غير مسموح به');
    }

    // 5. Per-type whitelist. The `policy.mimes` is a literal readonly tuple
    // (`as const`), so we widen it to `readonly string[]` for the includes
    // check — otherwise TS narrows the parameter to the tuple's union.
    const allowed: readonly string[] = policy.mimes;
    if (!allowed.includes(detected.mime)) {
      throw new BadRequestException(
        `نوع الملف "${detected.mime}" غير مسموح لهذا الحقل`,
      );
    }

    return {
      bucket,
      path,
      mime: detected.mime,
      size,
      extension: detected.ext,
    };
  }

  // ─── Orphan cleanup ────────────────────────────────────

  /**
   * Best-effort deletion of a file the caller no longer wants in storage.
   * Used when verifyUploadedFile rejects a file — the client uploaded it
   * but it must never be reachable, so we wipe it.
   *
   * Best-effort by design: a deletion failure here must NOT mask the
   * original rejection reason to the user. We log and move on.
   */
  async deleteOrphan(bucket: string, path: string): Promise<void> {
    try {
      const { error } = await this.supabase.storage.from(bucket).remove([path]);
      if (error) {
        this.logger.warn(
          `Orphan cleanup failed: bucket=${bucket} path=${path} err=${error.message}`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `Orphan cleanup threw: bucket=${bucket} path=${path} err=${String(err)}`,
      );
    }
  }

  // ─── Signed read URL ───────────────────────────────────

  /**
   * Short-lived signed URL for reading the object. The TTL is fixed per
   * MediaType (see SIGNED_URL_TTL_SECONDS). Callers must do their own
   * ownership / role checks BEFORE invoking this — this method does NOT
   * verify access; it only signs.
   */
  async createSignedReadUrl(
    bucket: string,
    path: string,
    type: MediaType,
  ): Promise<{ url: string; expiresAt: Date }> {
    const ttl = SIGNED_URL_TTL_SECONDS[type];
    const { data, error } = await this.supabase.storage
      .from(bucket)
      .createSignedUrl(path, ttl);

    if (error || !data) {
      this.logger.error(
        `Signed read URL failed: bucket=${bucket} path=${path} err=${error?.message}`,
      );
      throw new InternalServerErrorException('فشل في توليد رابط الملف');
    }

    return {
      url: data.signedUrl,
      expiresAt: new Date(Date.now() + ttl * 1000),
    };
  }

  // ─── Helpers ───────────────────────────────────────────

  private objectUrl(bucket: string, path: string): string {
    return `${this.supabaseUrl}/storage/v1/object/${bucket}/${encodeURI(path)}`;
  }
}
