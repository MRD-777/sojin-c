// ============================================
// 📸 Media Security — Constants
//
// Single source of truth for: allowed mime/extension whitelists,
// per-MediaType size caps, and the bucket each type uploads to.
//
// All buckets here are PRIVATE — reads must go through createSignedUrl()
// with a short TTL. Public buckets (avatars, logos) are NOT in this file
// because the Media entity does not represent them.
//
// Blacklist intent (documented for reviewers):
//   - image/svg+xml      → <script> inside an SVG runs in the browser
//   - application/zip    → zip bombs + smuggled executables
//   - application/x-*    → executables of any kind
//   - text/html, .js     → stored XSS via direct asset URL
// ============================================
import { MediaType } from '@prisma/client';

/** Bytes-in-a-megabyte — used for size caps below. */
const MB = 1024 * 1024;

/**
 * Per-MediaType policy. The detected mime (from magic bytes) must appear
 * in `mimes`; the size from Supabase metadata must be ≤ `maxSize`.
 *
 * NOTE: `extensions` is informational — we derive the extension from the
 * detected mime via `file-type`, not the client filename.
 */
export const MEDIA_TYPE_POLICY = {
  IMAGE: {
    mimes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
    extensions: ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'],
    maxSize: 10 * MB,
    bucket: 'updates-media',
  },
  VIDEO: {
    mimes: ['video/mp4', 'video/quicktime', 'video/webm'],
    extensions: ['mp4', 'mov', 'webm'],
    maxSize: 100 * MB,
    bucket: 'updates-media',
  },
  DOCUMENT: {
    mimes: ['application/pdf'],
    extensions: ['pdf'],
    maxSize: 25 * MB,
    bucket: 'updates-media',
  },
} as const satisfies Record<
  MediaType,
  {
    readonly mimes: readonly string[];
    readonly extensions: readonly string[];
    readonly maxSize: number;
    readonly bucket: string;
  }
>;

/**
 * Bytes to read from the head of a Supabase object for magic-byte detection.
 * 4100 covers every signature the `file-type` library recognizes (the
 * library's own MINIMUM_BYTES_TO_DETECT is 4100). Reading more is wasteful;
 * reading less risks false negatives on container formats (mp4, webm).
 */
export const MAGIC_BYTES_SAMPLE_SIZE = 4100;

/**
 * Signed URL TTLs by sensitivity. Documents (PDFs — invoices, contracts,
 * receipts) get the tightest window because their leak blast radius is the
 * worst.
 */
export const SIGNED_URL_TTL_SECONDS = {
  IMAGE: 3600, // 1 hour — common case, watched by a person in a browser tab
  VIDEO: 3600, // 1 hour — same playback ergonomics as IMAGE
  DOCUMENT: 900, // 15 minutes — financial/legal sensitivity
} as const satisfies Record<MediaType, number>;

/**
 * Explicit DENY-list of mimes that magic-byte detection might surface.
 * `file-type` will happily identify these — we reject them BEFORE the
 * per-type whitelist check so the audit trail is unambiguous.
 *
 * Order matters for the message returned to the client: more dangerous
 * formats are listed first so support engineers triaging an incident see
 * the worst case at the top.
 */
export const ALWAYS_BLOCKED_MIMES: readonly string[] = [
  // Executable formats — never legitimate as user-uploaded media
  'application/x-msdownload',
  'application/x-msi',
  'application/x-executable',
  'application/x-mach-binary',
  'application/x-elf',
  'application/x-dosexec',
  // Script formats — stored XSS if browser renders them inline
  'image/svg+xml',
  'text/html',
  'text/xml',
  'application/xml',
  'application/javascript',
  'application/x-javascript',
  // Archive formats — zip bombs + macro-laden Office files smuggled inside
  'application/zip',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'application/x-tar',
  'application/gzip',
] as const;
