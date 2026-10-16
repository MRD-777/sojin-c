# تقرير المبرمج (Quick)

## التغييرات
- `apps/web/src/app/[locale]/dashboard/team/permissions/page.tsx`: إضافة `import { cn } from "@/lib/utils";` — **سطر واحد، إضافة فقط** (`1 insertion(+)`, صفر حذف). نفس أسلوب الاستيراد في الصفحات الشقيقة (`team/leaves`, `team/attendance`, `subcontractors`).
- `.claude/sessions/BACKLOG.md`: قسم **`UI-HOLD`** في المقدمة + جدول البنود المحجوبة + تذكرة **`WEB-RTL-DIALOG-001`** + إقفال **`WEB-VISUAL-001`** + تحديث **`WEB-TSC-001`** إلى **مقفولة جزئياً**.

## Verification (literal)

**الكود المتغيّر — كله:**
```
$ git diff --stat -- "apps/web/src/app/[locale]/dashboard/team/permissions/page.tsx"
 apps/web/src/app/[locale]/dashboard/team/permissions/page.tsx | 1 +
 1 file changed, 1 insertion(+)

+import { cn } from "@/lib/utils";
```

**tsc — 4 أخطاء بدل 5 ✅ (خطأ الـ `cn` اختفى، والأربعة الباقية هم الموروثون بالاسم):**
```
$ npx tsc --noEmit -p tsconfig.json
=== tsc exit: 2 ===
src/components/ui/dropdown-menu.tsx(19,37): error TS2322: Type '{ children: Element; sideOffset: number; alignment: "center" | "end" | "start"; side: "top" | "bottom" | "left" | "right"; }' is not assignable to type 'IntrinsicAttributes & Omit<MenuPositionerProps, "ref"> & RefAttributes<HTMLDivElement>'.
  Property 'alignment' does not exist on type 'IntrinsicAttributes & Omit<MenuPositionerProps, "ref"> & RefAttributes<HTMLDivElement>'.
src/lib/auth/decide-redirect.spec.ts(9,17): error TS2540: Cannot assign to 'NODE_ENV' because it is a read-only property.
src/lib/auth/decide-redirect.spec.ts(18,19): error TS2540: Cannot assign to 'NODE_ENV' because it is a read-only property.
src/store/use-auth-store.ts(57,56): error TS2741: Property 'setUser' is missing in type '{ accessToken: null; user: null; pendingRegistration: null; setSession: ({ accessToken, user }: { accessToken: string; user: AuthUser; }) => void; setAccessToken: (accessToken: string) => void; setPendingRegistration: (pendingRegistration: PendingRegistration) => void; clearPendingRegistration: () => void; clear: ()...' but required in type 'AuthState'.
=== error count: 4 ===
```

**vitest — كله أخضر ✅:**
```
 Test Files  20 passed (20)
      Tests  95 passed (95)
   Duration  19.86s
```

**`next build` — ❌ لم يعدِّ كامل (معيار نجاح غير مستوفى):**
```
▲ Next.js 16.2.3 (Turbopack)
  Creating an optimized production build ...
✓ Compiled successfully in 41s
  Running TypeScript ...
Failed to type check.

./src/components/ui/dropdown-menu.tsx:19:37
Type error: Type '{ children: Element; sideOffset: number; alignment: "center" | "end" | "start"; side: "top" | "bottom" | "left" | "right"; }' is not assignable to type 'IntrinsicAttributes & Omit<MenuPositionerProps, "ref"> & RefAttributes<HTMLDivElement>'.
  Property 'alignment' does not exist on type 'IntrinsicAttributes & Omit<MenuPositionerProps, "ref"> & RefAttributes<HTMLDivElement>'.
=== next build exit: 1 ===
```

## ملاحظات

🔴 **المعيار "next build يعدّي كامل" لم يُستوفَ — والسبب ليس الإصلاح.**
`WEB-TSC-001` كانت مسجَّلة على **خطأين**، لا واحد. إصلاح الـ `cn` أزال الأول (الدليل: اختفى من `tsc` ومن الـ build)، فالـ build تقدّم خطوة وسقط على **الثاني** في نفس التذكرة. الإصلاح صحيح لكنه **غير كافٍ** لرفع حظر الشحن.

**الإصلاح الثاني معروف بدقة — كلمة واحدة:** `dropdown-menu.tsx:19` ⇒ `alignment={align}` تصبح `align={align}`.
**الدليل من المصدر، لا من التخمين:** `@base-ui/react/menu/positioner/MenuPositioner.d.ts:23` يعرّف **`align: Align`**؛ و**`components/ui/select.tsx:78` في نفس الريبو يستعمل `align={align}` صح بالفعل** ⇒ `dropdown-menu` هو الشاذ الوحيد.

**ولماذا لم أنفّذه (قراران صريحان، لا تردّد):**
1. **التكليف كان محدوداً بالحرف:** "ضيف الـ import الناقص بس... متلمسش أي حاجة تانية".
2. **والأهم — الفصيلة مختلفة:** الـ prop الحالي **اسم مجهول فيُسقَط صامتاً**، أي كل القوائم المنسدلة ترسم الآن على **المحاذاة الافتراضية**. تصحيح الاسم **يفعّل** `align` ⇒ **مواضع كل الـ dropdowns في المنتج تتغيّر بصرياً**. وده **يقع تحت `UI-HOLD`** اللي سُجِّل في نفس هذه الجلسة. بعكس إصلاح الـ `cn` الذي **حياده البصري مُثبَت** (`cn` = `clsx+twMerge`، والسطر 287 كان يستعملها أصلاً).

⇒ **خطآن في تذكرة واحدة، لكنهما فصيلتان:** واحد محايد بصرياً (نُفِّذ)، وواحد يغيّر الرسم (محجوب). ولو عُدّا متكافئين، كان الحظر هيُخرَق باسم "إصلاح بناء".

**الحكم على التذكرة:** `WEB-TSC-001` **مقفولة جزئياً** — `tsc` 5→4، والـ compile يعدّي، و**الـ deploy لسه محجوباً**. الباقي: كلمة واحدة + فحص بصري للقوائم (ar/en) ⇒ أول جلسة واجهة بعد رفع الحظر، أو استثناء صريح منك.

## جرد الحدود — (أ) حد السجل
- `permissions/page.tsx` → `WEB-TSC-001` **تُقفَل جزئياً** (موثَّق أعلاه وفي السجل).
- `dialog.tsx` → `WEB-RTL-DIALOG-001` **فُتحت** (من فحص المراجع)، **محجوبة** تحت `UI-HOLD`.
- `WEB-VISUAL-001` → **أُقفلت** بنتيجة المراجع، مع تمييز صريح: الفحص أثبت **غياب الأعطال** (صفر overflow، RTL سليم) و**ليس** قبول التصميم — وده سؤال مفتوح عندك.
- `dropdown-menu.tsx` → **تُلمَس بلا إغلاق** (مذكورة بالاسم في `WEB-TSC-001`، والإصلاح موصوف ولم يُنفَّذ).
- `WEB-REPORT-UX-001` / `-002` → مسجَّلتان **بالاسم بلا وصف** كما وردتا منك، وموسومتان صراحةً كذلك حتى لا تُقرأ كمُراجَعة (قاعدة #10).

✋ تم — الـ session مقفولة.
