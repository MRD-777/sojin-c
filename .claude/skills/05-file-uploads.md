---
name: file-uploads
description: Use when handling file uploads (images, videos, documents, receipts, contracts), file storage in Supabase Storage, generating signed URLs, or any code touching the Media module. Enforces magic-byte validation, size limits, malware scanning, UUID filenames, signed URLs with expiry, and storage quota enforcement.
---

# File Uploads — Safety Rules

> ⚠️ المستخدمين هيرفعوا صور إيصالات، عقود، شيكات، فواتير. ملف malicious واحد ممكن يهز السيرفر كله، يسرق بيانات، أو يستخدم كـ phishing storage.
> القاعدة: **افترض كل ملف مرفوع malicious حتى تثبت العكس بـ multiple validation layers**.

---

## 1. Validate من الـ Magic Bytes — مش الـ extension

الـ extension في الـ filename = نص يقدر أي حد يغيره. الـ magic bytes (file signature) = bytes الأولى من الـ file content.

✅ صح — استخدم `file-type` library:
```bash
pnpm add file-type
```

```typescript
import { fileTypeFromBuffer } from 'file-type';

async validateFileType(buffer: Buffer, allowedMimes: string[]): Promise<{ ext: string; mime: string }> {
  const detected = await fileTypeFromBuffer(buffer);
  if (!detected) {
    throw new BadRequestException('نوع الملف غير معروف أو تالف');
  }

  if (!allowedMimes.includes(detected.mime)) {
    throw new BadRequestException(
      `نوع الملف "${detected.mime}" غير مسموح. المسموح: ${allowedMimes.join(', ')}`,
    );
  }

  return { ext: detected.ext, mime: detected.mime };
}
```

❌ غلط — كارثة أمنية:
```typescript
// ⛔ attacker يسمي ملف .exe كـ .jpg، الـ extension check بيمشيه
const ext = path.extname(file.originalname);
if (!['.jpg', '.png'].includes(ext)) throw new Error('Bad type');
```

❌ غلط — يعتمد على الـ MIME من الـ client:
```typescript
// ⛔ الـ Content-Type من الـ multipart بياخده الـ browser من الـ extension
if (!['image/jpeg', 'image/png'].includes(file.mimetype)) throw new Error('Bad type');
```

**القاعدة:** الـ `file.mimetype` و `file.originalname` كلهم client-controlled. **لا تثق فيهم.**

---

## 2. Allowed File Types — Whitelist صارم

```typescript
// common/constants/file-types.ts
export const ALLOWED_FILE_TYPES = {
  IMAGE: {
    mimes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'],
    maxSize: 10 * 1024 * 1024,       // 10 MB
    extensions: ['jpg', 'jpeg', 'png', 'webp', 'heic'],
  },
  VIDEO: {
    mimes: ['video/mp4', 'video/quicktime', 'video/webm'],
    maxSize: 100 * 1024 * 1024,      // 100 MB
    extensions: ['mp4', 'mov', 'webm'],
  },
  DOCUMENT: {
    mimes: ['application/pdf'],
    maxSize: 25 * 1024 * 1024,       // 25 MB
    extensions: ['pdf'],
  },
  // ⚠️ ممنوع تماماً:
  //   - application/x-msdownload (.exe)
  //   - application/javascript (.js)
  //   - text/html (.html)
  //   - application/zip (.zip) — ممكن zip bombs
  //   - SVG (XSS via <script> داخله)
} as const;
```

**ملاحظات مهمة:**
- **SVG ممنوع** — ممكن يحتوي على `<script>` ويعمل XSS
- **Office files (.docx, .xlsx)** — لو لازم: scan macros أو decompose
- **PDF**: مسموح لكن scan JavaScript actions
- **ZIP**: ممنوع إلا لو لازم + zip bomb detection

---

## 3. Maximum Size per Type — Enforce قبل الـ upload + بعد الـ read

✅ صح:
```typescript
// في الـ Multer config
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

MulterModule.register({
  storage: memoryStorage(),  // مش disk — عشان ما نتلوثش الـ FS
  limits: {
    fileSize: 100 * 1024 * 1024,    // hard cap عام = 100MB
    files: 10,                        // max 10 files per request
  },
  fileFilter: (req, file, cb) => {
    // ✅ الـ MIME من الـ client untrusted — لكن سريع filter قبل ما نقرأ
    const allowed = Object.values(ALLOWED_FILE_TYPES).flatMap(t => t.mimes);
    if (!allowed.includes(file.mimetype)) {
      return cb(new BadRequestException('نوع الملف غير مسموح'), false);
    }
    cb(null, true);
  },
});
```

**Double-check بعد الـ read:**
```typescript
async upload(file: Express.Multer.File, expectedType: 'IMAGE' | 'VIDEO' | 'DOCUMENT') {
  const config = ALLOWED_FILE_TYPES[expectedType];

  // 1. حجم
  if (file.size > config.maxSize) {
    throw new BadRequestException(`حجم الملف يتجاوز ${config.maxSize / 1024 / 1024} MB`);
  }
  if (file.size === 0) throw new BadRequestException('الملف فارغ');

  // 2. magic bytes
  const detected = await this.validateFileType(file.buffer, config.mimes);

  // 3. باقي الخطوات...
}
```

---

## 4. Storage Quota per Company

كل شركة عندها `storageQuota` و `storageUsed` (في الـ schema بالفعل).

✅ صح:
```typescript
async upload(user: JwtPayload, file: Express.Multer.File, updateId: string) {
  // 1. fetch company quota
  const company = await this.prisma.company.findUnique({
    where: { id: user.companyId },
    select: { storageQuota: true, storageUsed: true },
  });

  // 2. check
  const newUsage = company.storageUsed + BigInt(file.size);
  if (newUsage > company.storageQuota) {
    throw new BadRequestException(
      `تم تجاوز حد التخزين (${company.storageQuota / BigInt(1024 ** 3)} GB). يرجى ترقية الباقة.`,
    );
  }

  // 3. upload + update usage in transaction
  return this.prisma.$transaction(async (tx) => {
    const media = await tx.media.create({ data: { /* ... */ } });
    await tx.company.update({
      where: { id: user.companyId },
      data: { storageUsed: { increment: BigInt(file.size) } },
    });
    // ... upload to storage
    return media;
  });
}
```

**عند الـ delete (soft):**
- Storage الحقيقي ما يتمسحش (compliance + audit)
- لكن `storageUsed` ما يتـ decrement-ش — الـ ملف لسه موجود
- بعد فترة retention (7 سنين مثلاً) — cron job يـ hard-delete وي decrement quota

---

## 5. UUID Filenames — منع Path Traversal

أي filename من الـ client = خطر:
- `../../etc/passwd` → path traversal
- `nul`, `con`, `aux` على Windows → reserved names
- emojis / RTL chars → display attacks
- 1000-char filename → buffer overflow

✅ صح:
```typescript
import { randomUUID } from 'crypto';

async uploadToStorage(file: Express.Multer.File, detectedExt: string, user: JwtPayload) {
  // ✅ filename = UUID + extension تم detect-ه من magic bytes
  const safeName = `${randomUUID()}.${detectedExt}`;
  const path = `${user.companyId}/${user.userId}/${safeName}`;

  // Supabase Storage
  const { error } = await this.supabase.storage
    .from('updates-media')   // private bucket
    .upload(path, file.buffer, {
      contentType: detected.mime,
      cacheControl: '3600',
      upsert: false,           // ⚠️ false عشان ما نـ overwrite-ش
    });

  if (error) throw new InternalServerErrorException('فشل رفع الملف');
  return path;
}
```

❌ غلط — كارثة:
```typescript
// ⛔ يستخدم filename من الـ client
const path = `${user.companyId}/${file.originalname}`;
// originalname = "../../../prod-secrets.env" → write خارج الـ company folder
```

**الـ original filename ممكن نحفظه في الـ DB كـ metadata** لو محتاج الـ user يشوف اسم الملف الأصلي، لكنه **مش بيتستخدم في الـ storage path أبداً**.

---

## 6. Supabase Storage — Private Buckets + Signed URLs

✅ Buckets المطلوبة:
| Bucket | Visibility | Use case |
|---|---|---|
| `updates-media` | **Private** | صور وفيديوهات الـ updates |
| `payment-receipts` | **Private** | إيصالات الدفع |
| `contracts` | **Private** | عقود مع subcontractors / clients |
| `company-logos` | **Public** (read-only) | logos فقط — أي ملف عام آخر = bug |
| `user-avatars` | **Public** (read-only) | avatars |

❌ ممنوع تماماً: bucket public للـ updates media أو financial documents.

### Signed URL Generation
```typescript
async getSignedUrl(user: JwtPayload, mediaId: string) {
  const media = await this.prisma.media.findFirst({
    where: {
      id: mediaId,
      update: { phase: { project: { companyId: user.companyId } } },
    },
    include: { update: { include: { phase: { include: { project: true } } } } },
  });
  if (!media) throw new NotFoundException();

  // CLIENT ownership check
  if (user.role === 'CLIENT') {
    if (media.update.phase.project.clientId !== user.userId) {
      throw new NotFoundException();
    }
    if (media.update.status !== 'APPROVED') {
      throw new ForbiddenException();
    }
  }

  // ✅ Signed URL مع expiry قصير
  const { data, error } = await this.supabase.storage
    .from('updates-media')
    .createSignedUrl(media.url, 3600);   // 1 hour

  if (error) {
    this.logger.error(`Signed URL generation failed for ${mediaId}`, error);
    throw new InternalServerErrorException('فشل توليد رابط الملف');
  }

  // audit log للـ access على الـ sensitive files
  if (['contract', 'receipt'].includes(media.type as string)) {
    await this.auditLog.log({
      companyId: user.companyId, userId: user.userId, userRole: user.role,
      entityType: 'media', entityId: mediaId, action: 'READ' as any,
      newValues: { accessedAt: new Date() },
    });
  }

  return { url: data.signedUrl, expiresAt: new Date(Date.now() + 3600_000) };
}
```

### Expiry Times بحسب الـ sensitivity
| File type | Expiry |
|---|---|
| Public images (avatars, logos) | لا signed (public bucket) |
| Update photos | 1 hour |
| Receipts | 30 minutes |
| Contracts | 15 minutes |
| Bank statements / sensitive | 5 minutes + audit log |

---

## 7. Image Processing — استخدم Sharp

Sharp مثبت بالفعل. للـ images:
- Resize للـ thumbnails
- Strip EXIF (الـ EXIF فيه GPS coords + camera info + ممكن يحتوي على malicious data)
- Re-encode (يمسح أي embedded scripts/payloads)

✅ صح:
```typescript
import sharp from 'sharp';

async processImage(buffer: Buffer) {
  // ✅ Re-encode + strip metadata + resize
  const processed = await sharp(buffer, { failOn: 'error' })  // يفشل لو الـ image مكسور/malicious
    .rotate()                                  // auto-orient حسب EXIF قبل ما نمسحه
    .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85, mozjpeg: true })       // re-encode → يمسح أي payload
    .withMetadata({ exif: {} })                 // strip كل الـ EXIF
    .toBuffer();

  // Thumbnail
  const thumbnail = await sharp(processed)
    .resize(400, 400, { fit: 'cover' })
    .jpeg({ quality: 70 })
    .toBuffer();

  return { processed, thumbnail };
}
```

**فوائد:**
1. يفشل لو الـ buffer مش image حقيقي (extra layer of validation)
2. يمسح GPS coords من الـ EXIF (privacy)
3. Re-encode → أي malicious payload مدفون في الـ image يتمسح
4. Resize → ما نخزنش 100MB images

---

## 8. Malware Scanning

للـ production: integrate مع ClamAV أو VirusTotal API.

✅ Pattern (ClamAV):
```typescript
import { NodeClam } from 'clamscan';

async scanForMalware(buffer: Buffer): Promise<void> {
  const clamscan = await new NodeClam().init({
    clamdscan: { host: process.env.CLAMD_HOST, port: 3310, timeout: 10000 },
  });

  const { isInfected, viruses } = await clamscan.scanBuffer(buffer);
  if (isInfected) {
    this.logger.error(`Malware detected in upload: ${viruses.join(', ')}`);
    throw new BadRequestException('الملف يحتوي على برمجيات خبيثة');
  }
}
```

**في dev/staging**: skip بـ env flag (`ENABLE_MALWARE_SCAN=false`).
**في production**: إجباري على كل upload قبل storage.

**Async option**: لو الـ scan بطيء، احفظ الـ file بـ status `SCANNING` ثم scan في BullMQ job → تحديث status لـ `CLEAN` أو `INFECTED`.

---

## 9. ممنوع تخزين في الـ Application Server

الـ files **لا** تتخزن في:
- `/uploads` folder في الـ NestJS app
- `/tmp` (إلا temp processing قصير جداً)
- داخل الـ Docker container
- في الـ project's `public/` folder

✅ الـ files دايماً في:
- Supabase Storage (الـ default)
- AWS S3 / Cloudflare R2 (لو migration)
- لا حاجة تانية

**الـ application server stateless** — يقدر يـ scale أفقياً بدون مشاكل storage.

---

## 10. Download Endpoint — حماية إضافية

لو الـ frontend بيستخدم الـ signed URL مباشرة → تمام.
لو محتاج download endpoint:

```typescript
@Get('media/:id/download')
@Roles('SUPER_ADMIN', 'PROJECT_MANAGER', 'CLIENT', /* ... */)
async download(
  @CurrentUser() user: JwtPayload,
  @Param('id', ParseUUIDPipe) id: string,
  @Res() res: Response,
) {
  const media = await this.mediaService.findOne(user, id);  // ownership check

  // ✅ Stream من Storage مباشرة — مش نحملها في memory
  const stream = await this.supabase.storage
    .from('updates-media')
    .download(media.url);

  res.set({
    'Content-Type': media.mimeType,
    'Content-Disposition': `attachment; filename="${encodeURIComponent(media.caption ?? 'file')}.${media.mimeType.split('/')[1]}"`,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-cache',
  });

  stream.data.body.pipe(res);
}
```

**Headers مهمة:**
- `Content-Disposition: attachment` — يجبر download (مش inline rendering)
- `X-Content-Type-Options: nosniff` — يمنع MIME sniffing
- `Content-Type` = الـ MIME المعروف من الـ DB (مش من الـ file مباشرة)

---

## 11. Receipt / Contract Specifics

للـ Payment receipts و Contracts (sensitive):
- **Watermark**: ضيف watermark بـ user ID + timestamp على PDFs لما يتمنحوا للـ view
- **Page-level audit**: كل preview/download يتسجل في audit_log
- **No client-side caching**: `Cache-Control: no-store, private`
- **Download counter**: لو ملف اتنزّل أكتر من X مرة في فترة قصيرة → alert

---

## Multer Configuration — الكامل

```typescript
// modules/media/media.module.ts
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

@Module({
  imports: [
    MulterModule.register({
      storage: memoryStorage(),   // مش disk
      limits: {
        fileSize: 100 * 1024 * 1024,     // 100MB hard cap
        files: 10,                         // max 10 files per request
        fields: 20,                        // max 20 non-file fields
        headerPairs: 100,
      },
    }),
  ],
})
```

---

## Anti-patterns

```typescript
// ⛔ 1. الاعتماد على extension
const ext = path.extname(file.originalname);
if (ext === '.jpg') { /* trust it */ }

// ⛔ 2. الاعتماد على client MIME
if (file.mimetype === 'image/jpeg') { /* trust it */ }

// ⛔ 3. Filename من client في الـ storage path
const path = `${user.id}/${file.originalname}`;

// ⛔ 4. Disk storage في الـ app server
storage: diskStorage({ destination: './uploads' })

// ⛔ 5. Public bucket لـ sensitive files
.from('all-files')   // bucket public

// ⛔ 6. لا expiry على signed URL
.createSignedUrl(path, 7 * 24 * 3600)   // أسبوع كامل = كارثة

// ⛔ 7. مفيش quota check
await upload(file)  // company هتخزن tier 50TB

// ⛔ 8. مفيش re-encoding للـ images
.from('avatars').upload(originalBuffer)   // EXIF + payloads مرفوعين

// ⛔ 9. SVG مسموح
mimes: [..., 'image/svg+xml']

// ⛔ 10. عرض الملف inline
'Content-Disposition': 'inline'   // HTML/JS بتشتغل في الـ browser
```

---

## Checklist لأي upload endpoint

- [ ] Multer config: memoryStorage + size limits + file count limit
- [ ] File buffer non-empty + size validated
- [ ] **Magic bytes validation** عبر `file-type` library
- [ ] Whitelist mimes (لا blacklist)
- [ ] **SVG ممنوع**
- [ ] Company storage quota check قبل upload
- [ ] Filename = UUID + detected extension
- [ ] Storage path includes `companyId/userId/`
- [ ] Bucket = **private** (إلا الـ avatars/logos)
- [ ] Images: Sharp re-encode + strip EXIF + resize
- [ ] Malware scan في production
- [ ] Signed URL مع expiry (مش public)
- [ ] Ownership check قبل توليد signed URL
- [ ] Audit log على sensitive file access
- [ ] DB transaction: media record + quota update
- [ ] Error في الـ storage = rollback الـ DB
- [ ] Soft delete (الـ file يبقى — quota مش بتنقص)
