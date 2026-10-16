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

---

## المرحلة 2: إزالة prop الـ `alignment` (بتكليف المالك)

### التغيير
`apps/web/src/components/ui/dropdown-menu.tsx:19` — **حُذف `alignment={align}`** من `Menu.Positioner` (لم تُصحَّح تسميته لـ `align`، بقرار المالك: التصحيح يحرّك كل القوائم ⇒ `UI-HOLD`).
`align` **بقي مُفكَّكاً (destructured)** مع تعليق يشرح السبب: لو شيلناه من التفكيك هيروح في `...props` ⇒ يُسكَب على `Menu.Popup` ⇒ يظهر في الـ DOM. فبقاؤه **يحافظ على نفس السلوك الحالي بالظبط**.

### إثبات الحياد — قياس DOM قبل/بعد (لا ادّعاء)
probe مؤقت في jsdom رندر قائمة **مفتوحة** بـ `align="end"` و`side="bottom"`، وطبع كل عناصر الـ portal بكل خصائصها. (الملف حُذف بعد القياس.)

**قبل:**
```
<div alignment="end" data-align="center" data-open="" data-side="bottom" role="presentation" style="position: absolute; left: 0px; top: 0px; opacity: 0; transform: translate(0px, 0px);">
=== align attr present anywhere: 0
=== alignment attr present anywhere: 1
=== data-side values: bottom,bottom
=== data-align values: center,center
```

**بعد:**
```
<div data-align="center" data-open="" data-side="bottom" role="presentation" style="position: absolute; left: 0px; top: 0px; opacity: 0; transform: translate(0px, 0px);">
=== align attr present anywhere: 0
=== alignment attr present anywhere: 0
=== data-side values: bottom,bottom
=== data-align values: center,center
```

**الفرق الحقيقي الوحيد** (باستثناء أرقام التوقيت):
```
2c2
< <div alignment="end" data-align="center" ...>
---
> <div data-align="center" ...>
5c5
< === alignment attr present anywhere: 1
---
> === alignment attr present anywhere: 0
```

**ما طُلب إثباته، مُثبَتاً بنداً بنداً:**
| المطلوب | النتيجة |
|---|---|
| `side` و`sideOffset` نفسهما قبل وبعد | ✅ `data-side="bottom"` في الحالتين، و`style` الـ positioner **متطابق حرفياً** (`left: 0px; top: 0px; transform: translate(0px, 0px)`) |
| مفيش `align` بيتبعت في الحالتين | ✅ `align attr … : 0` قبل و بعد |
| الحياد البصري | ✅ **`data-align="center"` في الحالتين** — أي base-ui كانت بتحسب `center` **حتى والـ prop موجود** رغم إن المستدعي طلب `end` ⇒ **الـ prop ما كان له أثر على المحاذاة، فإزالته لا تحرّك شيئاً** |

🔑 **الاستنتاج الأقوى من القياس:** الـ `alignment` ما كانش "مُهمَلاً" بالافتراض — كان **مُهمَلاً بالقياس**: المستدعي طلب `end` وbase-ui رسمت `center`. وأثره الوحيد كان **attribute غير قياسي في الـ DOM**، فإزالته **بتنظّف** ولا تغيّر.

### Verification (literal)

**tsc — 3 أخطاء ✅ (كان 4):**
```
$ npx tsc --noEmit -p tsconfig.json
=== tsc exit: 2 ===
src/lib/auth/decide-redirect.spec.ts(9,17): error TS2540: Cannot assign to 'NODE_ENV' because it is a read-only property.
src/lib/auth/decide-redirect.spec.ts(18,19): error TS2540: Cannot assign to 'NODE_ENV' because it is a read-only property.
src/store/use-auth-store.ts(57,56): error TS2741: Property 'setUser' is missing in type '{ accessToken: null; user: null; pendingRegistration: null; setSession: ({ accessToken, user }: { accessToken: string; user: AuthUser; }) => void; setAccessToken: (accessToken: string) => void; setPendingRegistration: (pendingRegistration: PendingRegistration) => void; clearPendingRegistration: () => void; clear: ()...' but required in type 'AuthState'.
=== count: 3 ===
```

**vitest — كله أخضر ✅:**
```
 Test Files  20 passed (20)
      Tests  95 passed (95)
```

**`next build` — ❌ لسه محجوباً، بخطأ من تذكرة أخرى:**
```
▲ Next.js 16.2.3 (Turbopack)
  Creating an optimized production build ...
✓ Compiled successfully in 42s
  Running TypeScript ...
Failed to type check.

./src/store/use-auth-store.ts:57:56
Type error: Property 'setUser' is missing in type '{ accessToken: null; user: null; pendingRegistration: null; setSession: ({ accessToken, user }: { accessToken: string; user: AuthUser; }) => void; setAccessToken: (accessToken: string) => void; setPendingRegistration: (pendingRegistration: PendingRegistration) => void; clearPendingRegistration: () => void; clear: ()...' but required in type 'AuthState'.

  [90m57 |[0m export const useAuthStore = create<AuthState>((set) => ({
=== next build exit: 1 ===
```

### 📌 الاكتشاف البنيوي — حظر الـ build كان سلسلة لا بنداً
`next build` **بيتوقف عند أول خطأ**، فكل إصلاح بيكشف اللي بعده. الترتيب الفعلي كما قيس اليوم:

| # | الخطأ | التذكرة | الحالة |
|---|---|---|---|
| 1 | `permissions/page.tsx:287` (`cn`) | `WEB-TSC-001` | ✅ مُصلَح (المرحلة 1) |
| 2 | `dropdown-menu.tsx:19` (`alignment`) | `WEB-TSC-001` | ✅ مُصلَح (المرحلة 2) |
| 3 | `use-auth-store.ts:57` (`setUser`) | **`WEB-STORE-001`** | ⛔ **الحاجب الحالي** |
| 4 | `decide-redirect.spec.ts:9,18` (`NODE_ENV`) | `WEB-TSC-002` | ❓ غير معروف إن كان الـ build هيسقط عليه (ملف spec) |

⇒ **`WEB-TSC-001` مقفولة بالكامل** (خطآها الاثنان زالا، والدليل اختفاؤهما من `tsc`)، **والـ deploy لسه محجوباً**. المعيار "next build يعدّي كامل" **لم يُستوفَ، والسبب خارج نطاق التذكرة المُكلَّف بها.**

### ليه ما كمّلتش للخطأ التالت
`use-auth-store.ts:57` **تذكرة أخرى** (`WEB-STORE-001`) خارج التكليف. وقِست المرشَّح للإصلاح: `grep -rn "setUser" apps/web/src` ⇒ **تطابق واحد = تعريفه نفسه (سطر 51)، صفر مستدعٍ** ⇒ حذف السطر = **تعريف في interface بلا كود تشغيل ولا مستهلك ولا أثر بصري** (أكثر حياداً من اللي عملته النهاردة). **ومع ذلك لم أنفّذه** لأن `R-4` في السجل بتربط البند ده بـ «setSession side-effect» ⇒ **الحذف قد يخالف الإصلاح المقصود** لو `setUser` مقصود كواجهة تُنفَّذ لا تُشال. **قرار منتج، مرفوع للمالك** — ورُفِّعت `WEB-STORE-001` لـ 🔴 HIGH بالدليل.

### السجل في هذه المرحلة
`WEB-DROPDOWN-ALIGN-001` **فُتحت** تحت `UI-HOLD` (بالقياس الذي يثبت أن `align` لا يصل) · `WEB-REPORT-UX-001` و`-002` **اتوصفا من المالك** ⇒ **صفر بند بالاسم بلا وصف** تحت الحظر (ثغرة القاعدة #10 مقفولة) · `WEB-TSC-001` **DONE** · `WEB-STORE-001` **مُرفَّعة لـ HIGH كحاجب حالي**.

✋ تم — المرحلة 2 مقفولة، والـ session مقفولة.
