# Skills — Construction SaaS

دليل الـ skills المتاحة للـ Claude في هذا المشروع. كل skill ملف فيه قواعد آمنة وأمثلة محددة للـ stack بتاعنا (NestJS + Prisma + Supabase + Next.js).

## ⚠️ الـ Golden Rules (لكل skill)

قبل أي كود جديد، اسأل الثلاث أسئلة دي:

1. **لو حد بنية سيئة**، إيه أسوأ شي ممكن يعمله بالـ endpoint / feature ده؟
2. **لو في bug هنا**، ممكن يخسر العميل فلوس؟ أو يفسد بيانات مالية؟
3. **لو في dispute قانوني**، عندنا proof كامل لكل حاجة اتعملت؟

لو الإجابة على أي سؤال مش واضحة → ارجع للـ skill المناسب وتأكد قبل ما تكمل.

---

## الـ Skills المتاحة

| # | Skill | متى تستخدمها |
|---|---|---|
| 01 | [api-endpoints](./01-api-endpoints.md) | أي endpoint / controller / service جديد |
| 02 | [database](./02-database.md) | أي Prisma query، schema change، migration |
| 03 | [auth-security](./03-auth-security.md) | أي حاجة تخص identity، authorization، sessions، tokens |
| 04 | [daily-reports](./04-daily-reports.md) | الـ Updates module، DailyUpdateTracker، state transitions |
| 05 | [file-uploads](./05-file-uploads.md) | upload صور / فيديو / مستندات، signed URLs، Media module |
| 06 | [error-handling](./06-error-handling.md) | error classes، retries، graceful degradation، health checks |
| 07 | [audit-compliance](./07-audit-compliance.md) | **الأهم** — أي action بيغير state، financial operations |
| 08 | [testing](./08-testing.md) | كتابة tests، setting up Jest، coverage |

---

## ترتيب الأولوية لو في تعارض

لو في تعارض بين skills (مثلاً performance vs security):

```
Security > Auditability > Correctness > Performance > DX
```

**في نظام مالي، الأمان والـ auditability أهم من السرعة والـ developer experience.**

---

## كيف تنشأ skill جديد

1. الـ filename: `<NN>-<kebab-name>.md`
2. الـ frontmatter لازم فيها `name` و `description`
3. الـ description تشرح **متى** تستخدم الـ skill (مش بس عن إيه)
4. كل قاعدة جنبها ✅ صح و ❌ غلط مع كود من الـ stack بتاعنا
5. checklist في الآخر للـ PRs

---

## المراجع الإضافية

- `/CLAUDE.md` — overview للمشروع، tech stack، architecture decisions
- `apps/api/prisma/schema.prisma` — كل الـ entities والـ enums
- `apps/api/src/common/` — guards, decorators, filters, interceptors المعتمدة
