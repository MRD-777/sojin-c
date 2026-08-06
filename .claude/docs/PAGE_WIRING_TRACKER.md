# خريطة ربط الصفحات — Frontend ↔ Backend

> الهدف: مفيش صفحة تتنسى، مفيش صفحة تتربط غلط. كل صفحة ليها حالة واضحة.
> يتحدّث بعد كل session. آخر تحديث: 2026-08-03 (إقفال S7 — backend-only).

---

## نظام الحالات

| الرمز | المعنى |
|---|---|
| ⬜ TODO | لسه ما بدأناش |
| 🟡 IN PROGRESS | جاري الشغل عليها دلوقتي |
| ✅ DONE | متربطة بالكامل + مختبرة |
| ⛔ BLOCKED | مستنية حاجة تانية تخلص الأول |
| ❌ NO BACKEND | مفيش endpoint لها خالص — تتأجل |
| 🟢 BACKEND READY | **الـ backend خلص ومُختبَر — الصفحة لسه غير مربوطة** |

> 🟢 **BACKEND READY ≠ DONE.** الحالة دي معناها الـ endpoints موجودة ومُتحقَّق منها،
> لكن **صفر ربط frontend**. الصفحة تفضل ⬜/⛔ في جدولها لحد ما تتربط فعلاً.

---

## المجموعة 0 — البنية التحتية (خلصت في S1 + S2)

| # | العنصر | الحالة | Session |
|---|---|---|---|
| 0.1 | Auth Backend-first (login/register/logout) | ✅ DONE | S1 |
| 0.2 | Middleware (auth_hint، بدون NODE_ENV bypass) | ✅ DONE | S1 |
| 0.3 | Generic API Client (Bearer + refresh-on-401) | ✅ DONE | S2 |
| 0.4 | Client Route-Guard (`/users/me` on mount) | ✅ DONE | S2 |
| 0.5 | useMe() hook | ✅ DONE | S2 |

**نواقص صغيرة لسه ما اتحلتش من S1/S2 (تفاصيلها في BACKLOG.md — مش بلوكر لبدء S3):**
- R-1: مفيش اختبار لحالة "الـ token القديم يتجدد تلقائياً" — الكود شغّال بس غير مؤكَّد بـ test
- R-2: الـ hacker (فحص الثغرات) ما راجعش `client.ts` لسه — Standard mode كانت اللي شغّالة، مش Deep
- R-3: لو السيرفر وقع مؤقتاً (مش مشكلة auth)، المستخدم بيتطرد بدل ما ياخد فرصة يعيد المحاولة
- R-4: فيه method اسمها `setUser` متعرّفة بس مش متنفّذة فعلياً في الكود (trap لو حد استخدمها بالغلط)
- WEB-S1-002: مفيش Content-Security-Policy header لسه (حماية إضافية ضد XSS)
- WEB-TSC-001/002: 2 أخطاء compile قديمة (pre-existing) مش متعلقة بالـ auth

---

## المجموعة 1 — Dashboard الأساسي (أولوية قصوى)

> دي أهم مجموعة — بيها قلب المنتج (المشاريع + التقارير اليومية).

| # | الصفحة | المسار | Backend Endpoint | الحالة | ملاحظات |
|---|---|---|---|---|---|
| 1.1 | Dashboard Overview | `dashboard/page.tsx` | مجمّع من `projects` + `payments/summary` | ⬜ TODO | مفيش endpoint واحد — لازم aggregation |
| 1.2 | Projects List | `dashboard/projects/page.tsx` | `GET /projects` | ✅ DONE (S3) | loading/empty/error + status 5 قيم + formatMoney. search/filters UI-only → WEB-S3-004 |
| 1.3 | Project Create | `dashboard/projects/new/page.tsx` | `POST /projects` | ✅ DONE (S3) | client selector حقيقي (clientId UUID) + type→enum + pure mapper + manual guard (WEB-S3-001). workers/finance حقول UI-only |
| 1.4 | Project Detail | `dashboard/projects/[id]/page.tsx` | `GET /projects/:id` | ✅ DONE (S3) | core+phases+assignments مجمّعين في call واحد (مش 3). KPI مالي + subcontractors + audit = placeholders بـ TODO. `payments/summary` مؤجّل S7 (R-1-blocked) |
| 1.5 | Review Inbox | `dashboard/projects/reviews/page.tsx` | `GET /phases/:phaseId/updates` (status=PENDING) + approve/reject | ✅ DONE (S4) | مربوط كـ tab داخل project detail (bounded aggregation عبر مراحل المشروع، `useQueries`). **standalone `reviews/page.tsx` مربوط بمنتقي مشاريع حقيقي (WEB-S4-P7-001 DONE، 2026-07-13)** — `useProjects()` + كل مشروع يـ link لـ `[id]?tab=reviews` (deep-link عبر query-param أحادي الاتجاه). صفر mock متبقٍّ |
| 1.6 | Phases (داخل project detail) | — | `GET /projects/:id/phases` + progress/reorder | ✅ DONE (S4) | `PhaseAdminControls`: progress override (Dialog، Int 0–100 + reason ≥20) + reorder (↑/↓ swap بكتابتين). non-atomic swap = WEB-S4-SWAP-001 (MEDIUM) |
| 1.7 | Updates lifecycle | — | `POST/PATCH/submit/approve/reject/force-cancel` | ✅ DONE (S4) | approve (idempotent) + reject + force-cancel (idempotent، SUNK_COST، reason ≥20) مع Idempotency-Key holder مستقر. `submit`/تأليف DRAFT مؤجّل لـ session التأليف (مفيش entry-point) |

---

## المجموعة 2 — Team + Company

| # | الصفحة | المسار | Backend Endpoint | الحالة | ملاحظات |
|---|---|---|---|---|---|
| 2.1 | Team List | `dashboard/team/page.tsx` | `GET /users` | ⬜ TODO | ✅ جاهز |
| 2.2 | Permissions | `dashboard/team/permissions/page.tsx` | `PATCH /users/:id/permissions` | ⬜ TODO | ⚠️ فيها WEB-TSC-001 (`cn` error) — لازم يتصلح الأول |
| 2.3 | Settings (شركة) | `dashboard/settings/` | `GET/PATCH /companies/me` + `/settings` | ❌ NO PAGE | الصفحة مش موجودة — لازم تتعمل من الصفر |
| 2.4 | Profile (شخصي) | `dashboard/profile/` | `GET/PATCH /users/me` | ❌ NO PAGE | الصفحة مش موجودة |
| 2.5 | Team Assignments | `dashboard/team/assignments/` | `POST/DELETE /projects/:id/assignments` | ❌ NO PAGE | الصفحة مش موجودة |

---

## المجموعة 3 — Finance

| # | الصفحة | المسار | Backend Endpoint | الحالة | ملاحظات |
|---|---|---|---|---|---|
| 3.1 | Finance Overview | `dashboard/finance/page.tsx` | `GET /projects/:id/payments/summary` | ⬜ TODO | 🟡 جزئي — الـ backend per-project بس |
| 3.2 | Payments List | `dashboard/finance/payments/page.tsx` | `GET /projects/:projectId/payments` | ⬜ TODO | ✅ جاهز — ⚠️ محتاج R-1 يتقفل الأول (بيانات مالية = "ثقيلة") |
| 3.3 | Invoices | `dashboard/finance/invoices/page.tsx` | — | ❌ NO BACKEND | يفضل mock مع TODO واضح |
| 3.4 | Petty Cash | `dashboard/finance/petty-cash/page.tsx` | — | ❌ NO BACKEND | يفضل mock |
| 3.5 | Profitability | `dashboard/finance/profitability/page.tsx` | — | ❌ NO BACKEND | يفضل mock |
| 3.6 | Reconciliation | `dashboard/finance/reconciliation/page.tsx` | — | ❌ NO BACKEND | يفضل mock |
| **3.7** | **Financial Settings + BOQ** | *(الصفحة مش موجودة)* | **9 endpoints — انظر أدناه** | 🟢 **BACKEND READY (S7)** | **backend-only. صفر ربط frontend. ⛔ R-1 + بوابة الصلاحيات حاجبتان** |

---

### 🟢 S7 — Financial + BOQ backend: ✅ **DONE (backend-only)** · 2026-08-03

> **Deep mode كامل (7 ملفات)** — `.claude/sessions/2026-07-16-s7-financial-boq/`
> **⚠️ APPROVED WITH NOTES** · MVT **17/17 passing** · صفر regression · tsc EXIT 0 · صفر ثغرة CRITICAL/HIGH مفتوحة.

**الـ endpoints التسعة الجاهزة (متحقَّق منها بـ boot حيّ — 9/9 مسجّلة، صفر تعارض في 84 route):**

| Endpoint | Method | @Roles |
|---|---|---|
| `projects/:projectId/financial-settings` | GET | SUPER_ADMIN, ACCOUNTANT, PROJECT_MANAGER |
| `projects/:projectId/financial-settings` | PATCH | SUPER_ADMIN, ACCOUNTANT |
| `projects/:projectId/financial-summary` | GET | SUPER_ADMIN, ACCOUNTANT, PROJECT_MANAGER, CLIENT |
| `projects/:projectId/boq` | GET | SUPER_ADMIN, ACCOUNTANT, PROJECT_MANAGER, CLIENT |
| `projects/:projectId/boq` | POST | SUPER_ADMIN, ACCOUNTANT |
| `boq/:id/sub-items` | POST | SUPER_ADMIN, ACCOUNTANT |
| `boq/:id` | PATCH | SUPER_ADMIN, ACCOUNTANT |
| `boq/:id` | DELETE | SUPER_ADMIN, ACCOUNTANT |
| `boq/:id/link-update` | PATCH | SUPER_ADMIN, ACCOUNTANT, PROJECT_MANAGER, SITE_ENGINEER, SUPERVISOR |

**كمان جاهز:** 3 models (`ProjectFinancialSettings` / `BOQItem` / `BOQItemUpdate`) مُطبّقة على Supabase، ملخص مالي **يُحسب per-request بـ Decimal** (غير مخزَّن ⇒ لا عمود قابل للتلاعب)، شجرة BOQ بـ soft-delete + حارس الأبناء + سقف عمق 10، audit إجباري على كل تعديل إعدادات وحذف بند، و`ACCOUNTANT` بقى **company-wide** على كل مستهلكي `ensureProjectAccess`.

#### ⛔ الربط للـ frontend **مؤجَّل** — ثلاث بوابات لازم تتقفل بالترتيب

| # | البوابة | الحالة | المصدر |
|---|---|---|---|
| 1 | **R-1** — مسار refresh-success غير مُختبَر في `client.ts` | ⛔ **مفتوح** — S7 ما مسّتش `client.ts` | شرط قائم من `00-scope.md` + BACKLOG (R-1) |
| 2 | **S7-ROLES-GATE (أ)** — spec لمصفوفة الصلاحيات من الـ metadata | ⛔ **مفتوح — 🔴 HIGH** | `05-principal-report.md` قرار 2️⃣ |
| 3 | **S7-ROLES-GATE (ب)** — API-ROLES-001 + A3 (`UserRole` بدل `string`) | ⛔ **مفتوح — 🔴 مرفوع لـ HIGH** | نفس المصدر |

**🔴 ما لا يُقبل تحت أي ظرف:** تعريض أي من الـ 9 endpoints لمستخدم حقيقي قبل استيفاء البوابتين 2 و3.
**السبب:** مسار الأدوار هو **المسار الوحيد في هذا الـ module الذي لا يحرسه لا مترجم ولا اختبار** — وهو الذي يقرر **مين يشوف مال مين**.

#### 📌 بنود تخصّ **جلسة الربط** تحديداً (تُقرأ قبل كتابة أي سطر UI)

- **CVE-S7-007 — محسوم = خيار (ب):** يُرجَع `contractValue` للـ CLIENT في الملخص (الحجب الحالي **أمان موهوم** — الـ CLIENT يقرأه أصلاً مُفصَّلاً من `GET /boq`). **⛔ لا يمرّ بدون تحديث MVT-5.** وتُطرح على مالك المنتج مسألة `retentionPct`/`advancePct`/`advanceAmount` (بنود صريحة في كل عقد إنشاءات).
- **P-1 — 🔴 قبل رسم أي شاشة:** للمشروع الواحد **ثلاثة أرقام مستقلة لقيمته** (`Project.totalBudget` / `contractValue` / `Σ BOQItem.contractValue`) **بلا أي مصالحة**، و`contractValue` **لا يدخل أي عملية حسابية إطلاقاً**. **كلها ستظهر على نفس الشاشة.** لازم يُحسم **الرقم المرجعي الواحد** ودلالة الباقي قبل التصميم لا بعده.
- **`retentionPct` بلا سقف:** التوصية المعتمدة = **تحذير مرئي** عند `>10` أو عند `netDue ≤ 0` مع إنجاز موجب — **لا حدّ صامت في الـ backend** (المنع الصامت يخفي الخطأ؛ التحذير يخاطب المُدخِل).
- **`completedPct` قابل للتضخيم** (CVE-S7-006): نفس التقرير يُربط بعدة بنود، وكل بند يحتسب **كامل** التكلفة ⇒ `Σ completedValue` ممكن تتجاوز `totalCompleted` بمضاعفات. **عرضي فقط — `netDue` لا يمرّ على الـ BOQ.** لا تُبنى عليه أي شاشة "إجمالي إنجاز".
- **أفعال بلا نقيض:** مفيش `unlink` لرابط BOQ↔تقرير، ومفيش مسح لـ `warrantyStartDate`. **الـ UI ما يقدّمش الفعل كأنه قابل للتراجع.**

---

## المجموعة 4 — Media + Comments (مرتبطين بالـ Updates)

| # | العنصر | Backend Endpoint | الحالة | ملاحظات |
|---|---|---|---|---|
| 4.1 | رفع صور على تقرير | `POST /media/upload-url` → `PUT` Supabase → `POST /updates/:id/media` | ⬜ TODO | 3 خطوات — Deep mode (attack surface) |
| 4.2 | عرض صور تقرير | `GET /updates/:id/media` + `GET /media/:id/signed-url` | ⬜ TODO | |
| 4.3 | تعليقات على تقرير | `GET/POST /updates/:id/comments` | ⬜ TODO | مفيش صفحة UI حالياً — تتعمل مع Updates workflow |

---

## المجموعة 5 — باقي الموديولات

| # | الصفحة | المسار | Backend Endpoint | الحالة | ملاحظات |
|---|---|---|---|---|---|
| 5.1 | Subcontractors | `dashboard/subcontractors/` | `GET/POST /sub-contractors` | ❌ NO PAGE | الصفحة مش موجودة (فيه `_data.ts` mock بس) |
| 5.2 | Chat | `dashboard/chat/` | `GET/POST /projects/:id/chat-rooms` + messages | ❌ NO PAGE | REST polling بس — الصفحة مش موجودة |
| 5.3 | Audit Trail | `dashboard/audit/page.tsx` | `GET /audit-logs` | ⬜ TODO | ✅ جاهز — SUPER_ADMIN فقط |
| 5.4 | SLA Tracker | `dashboard/projects/sla/page.tsx` | — | ❌ NO BACKEND | يفضل mock |
| 5.5 | Reports | `dashboard/reports/page.tsx` | — | ❌ NO BACKEND | يفضل mock |

---

## المجموعة 6 — Team (features إضافية بدون backend)

كل دول **UI جاهز لكن مفيش backend خالص** — هيفضلوا mock مع TODO واضح لحد ما نقرر لو هنعملهم:

| # | الصفحة | الحالة |
|---|---|---|
| 6.1 | Attendance | ❌ NO BACKEND |
| 6.2 | Leaves | ❌ NO BACKEND |
| 6.3 | Org Chart | ❌ NO BACKEND |
| 6.4 | Performance | ❌ NO BACKEND |
| 6.5 | Safety | ❌ NO BACKEND |
| 6.6 | Training | ❌ NO BACKEND |

---

## المجموعة 7 — Auth Flows الناقصة

| # | العنصر | الحالة | ملاحظات |
|---|---|---|---|
| 7.1 | Logout button فعلي | ⬜ TODO | الـ hook (`useLogout`) جاهز من S1 — محتاج يتربط بزرار في UI |
| 7.2 | Forgot Password | ❌ NO BACKEND | مفيش endpoint |
| 7.3 | Reset Password | ❌ NO BACKEND | مفيش endpoint |
| 7.4 | Invite Teammates flow | ⬜ TODO | الـ backend (`POST /users`) جاهز — محتاج UI flow كامل |

---

## الترتيب المقترح للتنفيذ (Sessions)

```
✅ S1 — Auth backend-first                                    [DONE]
✅ S2 — Generic API client + route-guard                      [DONE]
✅ S3 — Projects List + Detail + Create      (المجموعة 1.2-1.4)   [DONE]
✅ S4 — Updates workflow + Review Inbox      (المجموعة 1.5-1.7)   [DONE] · Deep mode (state machine). standalone reviews picker (WEB-S4-P7-001) ✅ DONE 2026-07-13

🟢 S7 — Financial + BOQ backend                (المجموعة 3.7)      [BACKEND DONE 2026-08-03] · Deep mode. **backend-only — صفر ربط frontend**

S5  — Dashboard Overview (aggregation)       (المجموعة 1.1)         ← الجاي
S6  — Team + Company Settings                (المجموعة 2)
S7-WIRE — ربط Payments + Finance + BOQ       (المجموعة 3.1-3.2, 3.7)
          ⛔ **بعد 3 بوابات:** R-1 + spec مصفوفة الصلاحيات + API-ROLES-001/A3
          📌 وقبل التصميم: حسم P-1 (الرقم المرجعي لقيمة المشروع) + تنفيذ CVE-S7-007(ب)
S8  — Media Upload                           (المجموعة 4.1-4.2)   Deep mode (attack surface)
S9  — Comments + Audit                       (المجموعة 4.3, 5.3)
S10 — Subcontractors + Chat                  (المجموعة 5.1-5.2)   صفحات جديدة من الصفر
S11 — Permissions Gate على كل الـ UI         (كل المجموعات)
```

---

## قاعدة العمل

**قبل ما تبدأ أي session جديدة:**
1. افتح الملف ده
2. شوف آخر حاجة DONE
3. الصفحة الجاية في الترتيب = scope الـ session الجديدة
4. بعد ما تخلص، حدّث الحالة من ⬜ لـ ✅ فوراً

**الصفحات الـ ❌ NO BACKEND:**
- تفضل بمكانها بالـ mock data
- لازم TODO comment صريح في الكود يقول "mock — no backend yet"
- **ما تتخفيش من الـ navigation** إلا لو قررنا صراحة إنها مش هتتعمل خالص

**لو صفحة اتلغت أو اتأجلت لأجل غير مسمى:**
- حدّث الحالة هنا + سبب صريح
- ما تسيبهاش ⬜ TODO للأبد من غير سبب
