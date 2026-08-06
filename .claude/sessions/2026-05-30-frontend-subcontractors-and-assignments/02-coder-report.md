# تقرير المبرمج

## المرحلة 1: تثبيت Shadcn components — ✅

**الأمر المنفذ:**
```
cd apps/web && printf 'N\nN\nN\nN\nN\nN\nN\nN\n' | npx -y shadcn@latest add select dialog tabs separator
```

(الـ `printf 'N\n…'` لأن الـ Shadcn CLI بـ interactive prompt يسأل عن الـ overwrite للملفات الموجودة
زي `button.tsx`. الجواب N يحافظ على الملف الأصلي ويـ skip الـ overwrite.)

**الملفات المُنشأة:**
- `apps/web/src/components/ui/select.tsx`
- `apps/web/src/components/ui/dialog.tsx`
- `apps/web/src/components/ui/tabs.tsx`
- `apps/web/src/components/ui/separator.tsx`

**انحراف عن الـ Plan — موثق:**
- الـ Plan افترض إن الـ CLI سيـ install `@radix-ui/react-{select,dialog,tabs,separator}`. الواقع: الـ
  `components.json` بـ style `"base-nova"` ⇒ الـ CLI استخدم `@base-ui/react` بدلاً منهم. الـ dep
  موجود بالفعل في `package.json` (`"@base-ui/react": "^1.4.1"`) فمفيش حاجة إضافية اتـ install.
- ده **مقبول وأفضل**: consistency مع الـ existing `dropdown-menu.tsx` و `tooltip.tsx` اللي بيستخدموا
  base-ui. مفيش mixing بين radix و base-ui.

**Verification (literal):**

```
$ ls apps/web/src/components/ui/
avatar.tsx       command-palette.tsx  input.tsx        progress.tsx     theme-toggle.tsx
badge.tsx        dialog.tsx           label.tsx        select.tsx       tooltip.tsx
button.tsx       dropdown-menu.tsx    language-switcher.tsx separator.tsx
card.tsx         sonner.tsx           tabs.tsx         textarea.tsx
checkbox.tsx     table.tsx
```

```
$ grep -E 'from "@base-ui' apps/web/src/components/ui/{select,dialog,tabs,separator}.tsx
apps/web/src/components/ui/select.tsx:    import { Select as SelectPrimitive } from "@base-ui/react/select"
apps/web/src/components/ui/dialog.tsx:    import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
apps/web/src/components/ui/tabs.tsx:      import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
apps/web/src/components/ui/separator.tsx: import { Separator as SeparatorPrimitive } from "@base-ui/react/separator"
```

```
$ npx tsc --noEmit 2>&1 | grep -E "(select|dialog|tabs|separator)\.tsx"
(no output — zero new errors in installed components)
```

**ملاحظة عن tsc errors pre-existing:**
الـ tsc لقى 2 errors في ملفات لم نلمسها:
1. `src/app/[locale]/dashboard/team/permissions/page.tsx(287,40)` — `cn` not found
2. `src/components/ui/dropdown-menu.tsx(19,37)` — `alignment` prop type mismatch

دول pre-existing — مش من تعديلاتنا. موثقين هنا للـ transparency، لكن خارج scope الـ session.

---

## المرحلة 2: إضافة i18n keys — ✅

**الملفات المعدّلة:**
- `apps/web/messages/ar.json` — أضيف namespace `Common.subcontractors` + `Common.assignmentsMatrix`
- `apps/web/messages/en.json` — نفس الـ keys بـ EN translations

**استراتيجية الـ namespacing (انحراف موثق عن الـ Plan):**
- الـ Plan قال `Common.team.assignments.*`. الواقع: في `Common.team.assignments` موجود بالفعل في
  line 1105 من ar.json بـ keys مختلفة (timeline, transfer requests) — هتـ conflict.
- الحل: استخدمت `Common.assignmentsMatrix` كـ top-level namespace جديد. ده يمنع الـ collision
  ويخلي الـ keys القديمة شغالة.
- الـ subcontractors في `Common.subcontractors` (top-level) — مفيش conflict مع
  `Common.dashboardPage.projects.details.subcontractors` لأن المسارات مختلفة كلياً في الـ tree.

**الـ keys المُضافة (high-level):**

| Namespace | الأقسام |
|---|---|
| `Common.subcontractors` | title, subtitle, count, actions, stats, filters, specialty, ratingFilter, status, card, table, empty, addDialog, detail (tabs, projectTable, ratingTable, ratingForm), compare (criteria, chart) |
| `Common.assignmentsMatrix` | title, subtitle, actions, view, filters, roles, projectStatus, matrix, table, addDialog, yes, no, empty |

**Verification (literal):**

```
$ node -e "JSON.parse(require('fs').readFileSync('apps/web/messages/ar.json','utf8')); console.log('ar.json OK');"
ar.json OK

$ node -e "JSON.parse(require('fs').readFileSync('apps/web/messages/en.json','utf8')); console.log('en.json OK');"
en.json OK
```

**Parity check:**
- AR file: `Common.subcontractors` بـ كل الـ subkeys المطلوبة + `Common.assignmentsMatrix`
- EN file: مطابق 1:1 في الـ structure (نفس الـ paths)، النصوص translated

---

## ملخص حتى الآن

- المراحل المكتملة: 2/5
- الملفات المُنشأة: 4 (shadcn components)
- الملفات المُعدَّلة: 2 (messages)
- انحرافات عن الـ Plan: 2 (موثقة ومقبولة — base-ui بدل radix، `assignmentsMatrix` بدل `team.assignments`)
- tsc errors جديدة: 0
- JSON validation: PASS (2/2)
- وقت التنفيذ التقديري: ~7 دقائق

## المراحل المتبقية (للـ session القادم بعد إذن المستخدم)

- المرحلة 3: `subcontractors/page.tsx` (قائمة بكروت + جدول)
- المرحلة 4: `subcontractors/[id]/page.tsx` + `subcontractors/compare/page.tsx`
- المرحلة 5: `team/assignments/page.tsx` (Matrix view)

---

✋ تم المبرمج (مرحلتين فقط) — للموافقة على المتابعة للمراحل 3-5؟
