# Scope

## Mode: Quick
السبب: Migration ميكانيكية لـ 4 import lines (CI-blocker موثق في BACKLOG #2) — bug fix معروف ومحدود، single role كافي.

---

## المهمة

استبدال `import { Decimal } from '@prisma/client/runtime/library'` بمصدر صحيح من `@prisma/client` في الـ 4 files المتأثرة. Prisma 7.7.0 لم تعد تصدّر `runtime/library` subpath؛ الـ `Decimal` متاحة كـ `Prisma.Decimal` (verified في `node_modules/.prisma/client/index.d.ts:767 — export import Decimal = runtime.Decimal`). الـ goal: 4 tsc errors يختفوا، 0 behavior change.

---

## الملفات المتأثرة

| ملف | الـ Import الحالي | Decimal call sites | اقتراح الـ Fix |
|---|---|---|---|
| `apps/api/src/modules/payments/payments.service.ts` | سطر 28: `import { AuditAction, Prisma, PaymentType } from '@prisma/client';` + سطر 29: `import { Decimal } from '@prisma/client/runtime/library';` | 3 (سطور 154، 243، + `new Decimal(0)`) | احذف سطر 29، أضف `const { Decimal } = Prisma;` بعد الـ imports (يحافظ على call sites zero-change) **OR** Option B: استبدل كل `new Decimal(...)` بـ `new Prisma.Decimal(...)` |
| `apps/api/src/modules/payments/payments.service.spec.ts` | سطر 20: `import { Decimal } from '@prisma/client/runtime/library';` + سطر 21: `import { AuditAction } from '@prisma/client';` | 11 (سطور 130, 242, 284, 320, 388, 407, 409, 410, 411, 424، + comment) | احذف سطر 20، أضف `Prisma` للسطر 21: `import { AuditAction, Prisma } from '@prisma/client';` + `const { Decimal } = Prisma;` |
| `apps/api/src/modules/updates/updates.service.ts` | سطر 35: `import { AuditAction, Prisma, UpdateStatus } from '@prisma/client';` + سطر 36: `import { Decimal } from '@prisma/client/runtime/library';` | 1 (سطر 544) | احذف سطر 36، أضف `const { Decimal } = Prisma;` بعد الـ imports |
| `apps/api/src/modules/updates/updates.service.spec.ts` | سطر 26: `import { AuditAction } from '@prisma/client';` + سطر 27: `import { Decimal } from '@prisma/client/runtime/library';` | 4 (سطور 258, 312, 374, 376) | احذف سطر 27، أضف `Prisma` للسطر 26: `import { AuditAction, Prisma } from '@prisma/client';` + `const { Decimal } = Prisma;` |

**Total:** 4 ملفات، 4 سطر import حذف، 4 سطور alias إضافة، **0 changes للـ call sites** (Option A المُوصى بها) أو 19 call-site replacements (Option B).

**التوصية:** Option A (alias) — minimum diff، 0 behavior risk، 0 call-site review surface. Option B explicit أكثر لكن diff أكبر بـ 5× بدون فائدة semantic.

---

## الـ Services الحاضرة في الـ scope (rule #6)

| Service | الحالة في الـ session | Coverage budget |
|---|---|---|
| `PaymentsService` | ملف import تعديل فقط، logic بدون مساس | n/a (مفيش specs جديدة — موجودة) |
| `UpdatesService` | ملف import تعديل فقط، logic بدون مساس | n/a (نفس) |

---

## تعريف النجاح

- [ ] `npx tsc --noEmit` من `apps/api/` يـ output **0 errors** (Stage current: 4 errors — كلهم في الـ 4 ملفات أعلاه per BACKLOG #2).
- [ ] الـ 4 specs الموجودة (`payments.service.spec.ts`، `updates.service.spec.ts`) تـ run بنجاح (الـ pre-existing compile failures المذكورة في Session 2 02-coder-report.md تختفي).
- [ ] الـ existing specs اللي بتشتغل حالياً (`projects.service.spec.ts`، `phases.service.spec.ts`، `users.service.spec.ts`، `test-utils.spec.ts`) لسه تمر — 0 regressions.
- [ ] الـ literal `tsc` و `jest` output في `02-coder-report.md` (rule #8).
- [ ] BACKLOG.md تحديث: ticket #2 يـ marked كـ **DONE** مع reference للـ session folder.

---

## الحدود (خارج نطاق هذا الـ session)

- لا changes للـ business logic، الـ DTOs، الـ DB schema، الـ Decimal math semantics.
- لا re-test للـ Decimal arithmetic correctness — الـ specs الموجودة تـ assert الـ math، migration import فقط.
- لا touch لـ Session 1.8 الـ tickets الأخرى (CHAT-FOLLOWUP-001, A1, PROJ-NOTE-002, A3) — session منفصلة لكل واحد.
- لا upgrade لـ Prisma version — current 7.7.0 stays.
- لا touch للـ `dist/` files المُولّدة — `tsc` rebuild هيعيد توليدهم.

---

⏸️ AWAITING APPROVAL — رد بـ "approve" للبداية (Option A — alias)، أو "approve: option B" للـ explicit replacement، أو "edit: [تعديل]".

✋ تم Scope — للدور التالي (المبرمج)؟
