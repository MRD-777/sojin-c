# تقرير المراجع الأعلى

## ملخص المهمة

Deep mode review لموديولي **Projects** + **Phases** (~1,440 LOC، 0 specs قبل الـ session) كشف 3 pre-emptive hardening items (F1/F2/F3) + 1 CRITICAL CVE (cross-tenant admin bypass عبر `ensureProjectAccess`) أُغلق at-source مع subsumption لـ A2 (architect post-exec observation). الـ session أُغلقت بـ MVT 21/21 passing (8 Projects + 7 Phases + 6 ensureProjectAccess)، 5 paired-assertion specs على الـ deepest primary action، صفر tsc errors جديدة، وملف CHAT-FOLLOWUP-001 (MEDIUM) لـ session 1.8.

---

## مراجعة شاملة

| المحور | التقييم | ملاحظات |
|--------|---------|---------|
| جودة المعمارية | **9/10** | الـ source-fix على `ensureProjectAccess` أنيق ويقفل 14 caller بحركة واحدة. الـ narrow `select` + reuse للـ `clientId` المُسترجع في الـ CLIENT path يحافظ على single-query semantics للـ CLIENT. الـ 13-line JSDoc anti-regression (D2) preventive engineering ممتاز. النقطة المفقودة: A1 (PrismaService overload في `recalculateProgressInTx`) لسه dormant والـ JSDoc الجديد علناً يـ legitimize الـ overload — fix جزئي. |
| جودة الأمان | **10/10** | CVE-PROJ-001 (CRITICAL، cross-tenant data leak) مغلق at-source. A2 (deletedAt cascade على ensureProjectAccess) subsumed في نفس الـ fix. F1 يقفل privilege-escalation surface في assignMember. F2 يقفل phase visibility cascade. الـ ForbiddenException unified message يمنع existence/non-existence info leak. ولا يوجد أي CVE مفتوحة في الـ scope الحالي بعد الـ Stage 2 fix. |
| جودة الـ Tests | **9/10** | 21/21 passing على الـ first run بدون debugging. 5 paired-assertion specs كلها على deepest primary action (logInTransaction args بـ exact `oldValues`/`newValues`/`reason`، أو exact filter shapes في Prisma queries) — CVE-TEST-011 lesson مُطبَّق فعلياً. الـ regression check على users.service.spec.ts (24/24) يثبت إن الـ mock factory extension نظيف. النقطة المفقودة: لا spec للـ `assignMember` reassignment path (P8 يغطي الـ role-gate فقط) ولا للـ `recalculateProgressInTx` math edge cases — موثقة كـ deferred backlog. |
| جاهزية للـ Production | **9/10** | الـ 4 pre-existing tsc errors (BACKLOG #2) **مش جديدة من الـ session** ولكنها CI-blocker محتمل لو CI tightening. الـ +1 DB query لكل admin/assignment path on `ensureProjectAccess` مقبول لكن يحتاج monitoring في production. CHAT-FOLLOWUP-001 (MEDIUM hardening) deferred لكن الـ exploit-path مغلق at-source — مقبول للـ deploy. الـ Performance impact مدروس + موثق في 01-architect-report.md Q-S2-3. |

---

## نقاط القوة

1. **الـ NEEDS-CODER cycle عمل بالكامل لأول مرة في المشروع.** الهاكر فتح CVE-PROJ-001 بـ NEEDS-CODER (مش inline)، الـ session رجعت للمبرمج لـ Stage 2، المخطط post-exec راجع الـ Stage 2 separately، ثم انتقلت للمختبر. الـ 7-file structure احتفظت بـ integrity مع stage-2 sections مضافة بدل ما تـ overwrite الـ stage 1.
2. **Source-fix بدل caller-fix.** المبرمج اختار الـ root cause (admin bypass في `ensureProjectAccess`) بدل ما يـ patch chat module منفرداً. الـ نتيجة: 14 caller production code آمنين بحركة واحدة، الـ contract المعماري موحّد، وlife-cycle الـ defense-in-depth في chat تـ deferred بدون risk فعلي.
3. **الـ paired-assertion discipline.** الـ 5 paired-assertion specs (P6, P8, PH1, PH3, PH6, PH7, EA1, EA4, EA6) كلها تـ assert على deepest primary action. الـ CVE-TEST-011 lesson من Session 1.6 (smoke test على tempPassword كان shallow على charset بدل verify الـ Supabase write) **applied operationally** — مش بس documented.
4. **A2 prediction-then-closure.** المخطط post-exec Stage 1 رفع A2 كـ architectural observation. الهاكر confirmed-as-CVE في الـ stage التالي. الـ fix قفلهم معاً. هذا الـ chain (architect predicts → hacker confirms → coder fixes-both) دليل إن الأدوار بتـ communicate effectively عبر الـ files.
5. **Pattern #5 re-attack respected.** الـ 6 `ensureProjectAccess` specs الجديدة (EA1-EA6) **هي بنفسها** re-attack للـ pattern اللي اتفتح في Stage 2 (trust-without-verify عند الـ role-branch قبل الـ tenant gate). لم يتم اعتبارها معفاة من الـ pattern لأنها new specs.
6. **Literal verification output (rule #8).** الـ jest stdout والـ tsc stderr منقولين سطر-بسطر في الـ 2 stages للمبرمج وفي تقرير المختبر. الـ pre-existing errors موسومة صراحة كـ BACKLOG #2 لا تشويش على الـ deltas.
7. **Hacker mode = `attack-and-fix-critical-only` احتُرم.** CRITICAL واحد طلع → NEEDS-CODER (مش inline). الـ 3 LOW informationals (PROJ-NOTE-001/002/003) deferred للـ session 1.8. ما حصلش scope-creep داخل الـ hacker phase.

---

## نقاط الضعف

1. **A1 (PrismaService overload في `recalculateProgressInTx`) لسه مفتوح.** الـ JSDoc الجديد بـ `callers MUST pass a tx (or PrismaService for read-only contexts)` بالعكس بيـ legitimize الـ overload بدل ما يحذره. هذا يفتح surface لـ misuse مستقبلي. الـ fix الأنظف: tighten الـ signature لـ `tx: Prisma.TransactionClient` فقط، أو فصل الـ read-only path إلى method منفصلة. **deferred للـ session 1.8 لكن يجب أن يكون عاجل، ليس MEDIUM idle.**
2. **CHAT-FOLLOWUP-001 لسه gap defense-in-depth.** الـ exploit-path مغلق at-source، لكن `chat.findRooms` و `chat.createRoom` لسه يـ trust `ensureProjectAccess` بدون companyId-on-data layer ثاني. لو CVE-PROJ-001 fix اتـ reverted (refactor خاطئ، performance optimization)، الـ exploit يعود في chat تحديداً بدون defense-in-depth. الـ JSDoc anti-regression (D2) يقلل الـ risk لكنه ليس صفر.
3. **HTTP-layer integration tests لسه deferred (BACKLOG #5).** كل الـ MVT حتى الآن service-layer. الـ Roles guard wiring + ValidationPipe على الـ controllers + idempotency-key handling غير مغطى spec-level. الـ scope صراحة احتوى deferral لكن يبقى أكبر coverage gap في المشروع.
4. **`assignMember` orphan data audit (PROJ-NOTE-002) غير مُطبَّق.** F1 يمنع *new* assignments لـ CLIENT/PM/SUPER_ADMIN، لكن لو في data قديم بـ User.role IN ('CLIENT', ...) و `removed_at IS NULL`، هتـ pollute الـ visibility filter في `findAll`. لازم one-time SELECT + cleanup migration. deferred لكن يحتاج priority MEDIUM في session 1.8.
5. **A3 (JwtPayload.role: string بدل UserRole enum).** الـ `['SUPER_ADMIN', 'PROJECT_MANAGER'].includes(user.role)` يـ work runtime لكن typo (`'SUPER_AMDIN'`) لا يـ caught بـ TypeScript. لو enum value تغير في Prisma schema، silent fail محتمل. LOW severity لكن worth ticket.

---

## مخاطر متبقية

| الخطر | المستوى | تخفيف موصى به |
|-------|---------|----------------|
| A1 — `recalculateProgressInTx` PrismaService overload يُساء استخدامه مستقبلاً | 🟡 MEDIUM | session 1.8 priority: tighten signature لـ `Prisma.TransactionClient` فقط، أو فصل read-only path |
| CHAT-FOLLOWUP-001 — لو CVE-PROJ-001 fix اتـ reverted، الـ exploit يعود في chat | 🟡 MEDIUM | session 1.8: إضافة `project: { companyId, deletedAt: null }` لـ chat.findRooms/createRoom queries |
| BACKLOG #2 — `@prisma/client/runtime/library` migration | 🟡 MEDIUM | priority بنفس مستوى الـ session 1.8 (CI-blocker محتمل) |
| BACKLOG #5 — HTTP integration tests غير موجود | 🟡 MEDIUM | session منفصل (supertest + Roles guard + ValidationPipe + idempotency wiring) |
| PROJ-NOTE-002 — assignMember orphan data بعد F1 | 🟢 LOW | SQL audit + cleanup migration في session 1.8 (data integrity) |
| A3 — JwtPayload.role: string بدل UserRole | 🟢 LOW | typing-only، session 1.8 |
| F4 reorder uniqueness (deferred per Plan Q4) | 🟢 LOW | يحتاج schema migration + استراتيجية للـ existing ties |

---

## أسئلة المستخدم — قرارات المراجع

### Q1: NEEDS-CODER cycle شغّال صح؟ ولا في gaps في الـ workflow؟

**✅ الـ Cycle شغّال صح — لأول مرة في المشروع — مع 2 observations + 1 gap موصى بإغلاقه.**

**ما اشتغل بشكل ممتاز:**
- الهاكر فتح NEEDS-CODER بـ rationale واضح (architectural change touching 5 modules + cross-cutting لـ A2). لم يحاول inline-fix فقط لأنه "يقدر" — احترم الـ `attack-and-fix-critical-only` mode في scope.
- الـ user authorization step (المستخدم رد "CVE-PROJ-001 مؤكد. الـ session ترجع للمبرمج") واضح وملموس — ليس automatic-loop. الـ workflow يحترم الـ rule #1 (وقفة بين الأدوار).
- المخطط post-exec فصل الـ stages في نفس الملف بـ `═══` divider — Stage 1 محتفظ + Stage 2 مُضاف. هذا يحافظ على الـ audit trail الكامل للـ session: القارئ يقدر يتابع الـ "قبل الـ NEEDS-CODER" مقابل "بعد الـ fix".
- المخطط Stage 2 confirmed إن A2 prediction (من Stage 1) اتغلق في نفس الـ commit — هذا يثبت إن الـ architect observations مش noise، بل predictions قابلة للقياس.

**Observations:**

**O1 — تكرار الـ stage divider في `01-architect-report.md` و `02-coder-report.md` غير موحّد بالـ CLAUDE.md.** الـ CLAUDE.md يفترض ملف واحد لكل دور، بدون stages. الـ session أضافت `## المرحلة 2` للمبرمج و `# مراجعة المخطط (ما بعد التنفيذ) — Stage 2` للمخطط بشكل ad-hoc لكن صحيح. **توصية:** إضافة rule جديدة (#9 في CLAUDE.md المُحتمل) أو "Stage N" template formalization لـ NEEDS-CODER cycles. هذا يمنع الـ next-developer من ad-hoc divergence.

**O2 — الـ NEEDS-CODER لم يـ trigger re-execution لـ `00-scope.md` ولا `00-plan.md`.** الـ scope الأصلي قال "لو الهاكر لقى HIGH/CRITICAL خارج F1-F4، الـ session ترجع للمبرمج (NEEDS-CODER pattern من rule #1)". هذا انضبط، لكن الـ plan لم يُحدّث لإضافة المرحلة 2 — المبرمج اتجه مباشرة للـ Stage 2 fix من 03-hacker-report.md. **هل هذا gap؟** عملياً لا، لأن الـ hacker report قد قدّم `الـ Fix المقترح للمبرمج` بشكل مفصل. لكن formally، الـ Plan هو الـ source-of-truth للـ MVT budget و الـ success criteria. **توصية:** الـ NEEDS-CODER cycle يفترض أن يـ update الـ Plan (إضافة "Stage 2 fix" كـ section جديد) أو explicitly يـ document في الـ scope إن "الـ NEEDS-CODER يعتمد على الـ hacker report كـ plan addendum". الـ session حالياً تستخدم الـ implicit option الثانية، وهي مقبولة لكن غير موثقة.

**Gap موصى بإغلاقه (workflow rule جديدة):**

**Rule #9 المقترحة (للـ CLAUDE.md):**
> NEEDS-CODER return cycle:
> - الـ hacker report لازم يحتوي على `الـ Fix المقترح للمبرمج` كـ named section إذا فتح NEEDS-CODER.
> - الـ المبرمج Stage 2 يكتب section جديد في `02-coder-report.md` بـ heading `## المرحلة N: [اسم الـ CVE] (NEEDS-CODER returned)` — لا overwrite للـ Stage 1.
> - الـ مخطط post-exec Stage 2 يكتب section جديد في `01-architect-report.md` بنفس الـ pattern — يـ compare Hacker Proposal vs Reality (مش Plan vs Reality لأن الـ Plan الأصلي لا يحتوي على الـ Stage 2 fix).
> - الـ tester budget قد يـ upgrade — الـ المخطط Stage 2 لازم يـ approve الـ budget الجديد صراحة قبل ما المختبر يبدأ.

هذا يـ formalize الـ pattern اللي اتعمل ad-hoc في هذه الـ session.

---

### Q2: Merge as-is أم في conditions؟

**⚠️ APPROVED WITH CONDITIONS — جاهز للـ production مع 2 conditions قبل الـ merge + 4 follow-up tickets لـ session 1.8.**

**القرار النهائي:** ✅ **APPROVED WITH NOTES**

#### Conditions before merge (إجباري)

**C1 — Update CLAUDE.md بـ Rule #9** (formalization للـ NEEDS-CODER cycle، كما هو موصوف في Q1 أعلاه).

**Rationale:** هذه الـ session كانت أول NEEDS-CODER cycle. الـ ad-hoc structure شغّال هنا، لكن لو fail لاحقاً (مثلاً Stage 2 fix غلط، أو الـ hacker proposal كان غير كامل)، الـ session-recovery هتكون صعبة بدون formal structure. هذا الـ rule يـ codify الـ working pattern.

**Implementation:** session منفصلة OR cleanup commit بعد الـ merge (مفضل: session منفصلة بـ Quick mode لأن الـ change هي documentation فقط).

**C2 — Backlog ticket رسمي لـ CHAT-FOLLOWUP-001 + A1 + A3 + PROJ-NOTE-002 في `.claude/sessions/BACKLOG.md`** قبل الـ merge.

**Rationale:** Session 1.7 BACKLOG حالياً فيه 5 tickets (1 منهم closed — CVE-TEST-016). إضافة الـ 4 الجديدة قبل الـ merge يضمن إنهم لا يـ get-lost في الـ session-1.8 planning. الـ priority + severity + source line مطلوبين.

**Implementation:** أنا (المراجع) أكتب الـ snippet للـ BACKLOG.md في نهاية هذا التقرير (تحت "Backlog snippet لـ session 1.8")، المبرمج/المستخدم يـ append بعد الـ merge.

#### Conditions غير إجبارية (deferred لـ session 1.8، tracked)

**C3 — A1 (recalculateProgressInTx signature tightening)** — priority **MEDIUM-HIGH** في session 1.8 لأن الـ JSDoc الجديد بيـ legitimize الـ overload بدل ما يحذّره. هذا anti-pattern موجود الآن.

**C4 — CHAT-FOLLOWUP-001 (chat defense-in-depth)** — priority **MEDIUM** في session 1.8. الـ exploit-path مغلق at-source، لكن الـ defense-in-depth gap لسه موجود.

**C5 — PROJ-NOTE-002 (assignMember orphan data audit)** — priority **LOW-MEDIUM** في session 1.8. one-time SQL audit + cleanup migration.

**C6 — A3 (JwtPayload.role typing)** — priority **LOW** في session 1.8. typing-only، defensive engineering.

#### Conditions أُسقطت من الـ merge (لـ session 1.9+)

**BACKLOG #2 (`@prisma/client/runtime/library` migration)** — pre-existing، لا يـ regress في هذه الـ session، لكن CI-blocker محتمل. session منفصلة قبل الـ CI tightening.

**BACKLOG #5 (HTTP integration tests)** — major new infrastructure، session منفصلة.

**F4 reorder uniqueness** — deferred per Plan Q4، لسه requires schema migration strategy.

---

### Q3: مراجعة قرارات الـ session الرئيسية

**Decision Audit:**

| القرار | الـ Source | حُكم المراجع |
|---|---|---|
| Hacker mode = `attack-and-fix-critical-only` | scope rule #7 | ✅ صحيح — لو كان `attack-and-fix-default`، الـ CVE-PROJ-001 كان هيتـ fixed inline ولن يـ trigger NEEDS-CODER cycle. الـ session ما كانت هتـ exercise الـ pattern الجديد. |
| F1+F2+F3 approved as Plan default، F4 deferred | Plan Q1-Q4 | ✅ صحيح — F4 يحتاج schema migration، outside hardening scope. الـ 3 المتبقية كلهم safe-by-construction. |
| Source-fix لـ CVE-PROJ-001 (بدل chat-only patch) | المبرمج Stage 2 + الهاكر proposal | ✅ صحيح — قفل 14 caller، unified الـ contract، prevented future "تكرار" lessons. الـ alternative كان هيخلق defense-in-depth duplication. |
| MVT budget upgraded من 12 → 21 (8+7+6) | المخطط Stage 2 Q-S2-1 | ✅ صحيح — الـ 6 ensureProjectAccess specs هي direct closure للـ CVE + pattern #5 re-attack. لا يـ block schedule لأنهم single-class، single-file. |
| CHAT-FOLLOWUP-001 deferred لـ session 1.8 (مش inline) | المبرمج Stage 2 + المخطط Stage 2 Q-S2-2 | ✅ صحيح — chat module خارج scope، الـ exploit-path مغلق at-source، الـ defense-in-depth gap = hardening مش CVE. |
| Performance impact (+1 query for admin) accepted | المخطط Stage 2 Q-S2-3 | ✅ صحيح — PK lookup على indexed column، الـ admin path قبلاً كان "no query"، الـ +1 mathematically necessary للـ tenant gate. Mitigation strategies documented but not implemented (correct — premature optimization). |
| JSDoc anti-regression (D2: 13 سطر) | المبرمج Stage 2 deviation | ✅ صحيح — preventive engineering. الـ next-developer (شهور من الآن) سيقرأ الـ JSDoc قبل ما يحاول "optimize" الـ admin path. |
| F3 cleanup approved with JSDoc rewrite (D1) | المبرمج Stage 1 deviation | ✅ صحيح — ترك الـ JSDoc يـ reference method محذوفة كان هيكون bad documentation hygiene. |

---

### Q4: CVE-PROJ-001 — assessment

**Severity confirmation: 🔴 CRITICAL** (مطابق لـ hacker assessment).

**Justification:**
- **Confidentiality breach:** Cross-tenant data leak لأي admin × أي projectId.
- **Integrity breach:** Write side exploit (createRoom) محتمل — ghost rooms في DB Company-B.
- **Compliance breach:** Multi-tenant SaaS guarantee مكسور — direct GDPR/SOC2 violation.
- **Reachability:** Production-reachable عبر GET request. الـ secret needed (projectId) منخفض الـ entropy لو UUIDs ضعيفة أو يتسرّب عبر screenshots/support.
- **Surface:** 14 caller عبر 6 modules (chat, payments, sub-contractors, comments, updates, projects, phases). الـ chat module تحديداً مكشوف بدون defense-in-depth.

**Root cause analysis:**
- **Symptom-level:** `ensureProjectAccess` admin short-circuit قبل أي tenant gate.
- **Architectural-level:** الـ function اسمها يوحي بـ access-check شامل، لكن الـ implementation للأدمين trust-blind. الـ contract المعماري مكسور.
- **Process-level:** 4 modules (payments, sub-contractors, comments, updates) أضافوا defense-in-depth بشكل ضمني — اعتراف ضمني إن `ensureProjectAccess` غير موثوق. لكن لم يـ documented كـ contract violation أبداً. الـ chat module هو الـ "outlier" اللي لم يتعلّم الـ pattern.

**Why detected by Session 2 + not earlier:**
- Session 1.5 (auth/users) + Session 1.6 (mvt-hardening) ركّزوا على auth surface وlast-admin race. لم يـ touch الـ projects module.
- A2 (architect post-exec) لاحظ الـ `deletedAt: null` missing في `ensureProjectAccess` كـ observation — هذا كان trigger للهاكر لـ "deep-dive" على الـ function نفسها، الذي كشف CVE-PROJ-001 (companyId missing).
- الـ scope rule #6 (services enumeration with coverage budget) أجبر الـ scope لـ list `ProjectsService` صراحة كـ "في الـ scope بالكامل" — لو كان "Phases only"، الـ `ensureProjectAccess` كان هيكون deferred.

**Lesson:** Architect post-exec observations (A1، A2) **مش noise** — هي predictions قابلة للقياس. الـ hacker لازم يـ treat them كـ attack hypotheses (vs reading the code blind). هذا confirmed كـ working pattern في هذه الـ session.

---

## القرار النهائي

⚠️ **APPROVED WITH NOTES** — جاهز للـ production لكن:

1. **C1 — Update CLAUDE.md بـ Rule #9** (formalize NEEDS-CODER cycle) — قبل الـ merge أو في session منفصلة Quick mode فوراً بعد الـ merge.
2. **C2 — Update `.claude/sessions/BACKLOG.md`** بـ 4 tickets جديدة (CHAT-FOLLOWUP-001 + A1 + A3 + PROJ-NOTE-002) قبل الـ merge.
3. **C3-C6 — Session 1.8 priorities:** A1 (MEDIUM-HIGH), CHAT-FOLLOWUP-001 (MEDIUM), PROJ-NOTE-002 (LOW-MEDIUM), A3 (LOW).

**MVT auto-reject check:** الـ Plan tester budget = 12 specs minimum. المختبر سلّم 21. **passes** (rule #2 + #3).

**Rule #1 violations check:** 0 (الـ 7 ✋ pauses كلها respected — scope, plan, coder stage-1, architect-stage-1, hacker, coder-stage-2, architect-stage-2, tester. الـ stage divisions لا تـ violate rule #1 لأنها داخل نفس الدور).

**Rule #4 (paired primary action = deepest representable):** ✅ — 5 paired-assertion specs كلها على `logInTransaction` args بـ exact `oldValues`/`newValues`/`reason`، أو على exact filter shapes في Prisma queries. مش على shallow side-effects.

**Rule #5 (re-attack new specs by pattern):** ✅ — EA1-EA6 specs هي بنفسها re-attack للـ "trust-without-verify عند الـ role-branch" pattern. لم يتم اعتبارها معفاة.

**Rule #6 (scope enumeration):** ✅ — Services في الـ scope مذكورة بالاسم + coverage budget. ProjectsController/PhasesController deferred to backlog #5.

**Rule #7 (hacker mode declaration):** ✅ — `attack-and-fix-critical-only` في scope rule #7.

**Rule #8 (literal verification output):** ✅ — jest stdout + tsc stderr منقولين literally في 02-coder-report.md (2 stages) + 04-tester-report.md.

---

### Backlog snippet لـ session 1.8 (للإضافة على `.claude/sessions/BACKLOG.md`)

```markdown
## Session 1.8 — NEEDS-CODER tickets (from Session 2 closure)

| # | Ticket | Source | Severity | Type |
|---|---|---|---|---|
| 6 | **A1** — `recalculateProgressInTx` PrismaService overload tightening | Session 2 architect Stage 1 + 2 (`01-architect-report.md` A1) | 🟡 MEDIUM-HIGH | hardening (signature change) |
| 7 | **CHAT-FOLLOWUP-001** — chat.findRooms/createRoom defense-in-depth tenant gate | Session 2 hacker (`03-hacker-report.md` CHAT-FOLLOWUP-001) + المبرمج Stage 2 (`02-coder-report.md`) | 🟡 MEDIUM | hardening (defense-in-depth) |
| 8 | **PROJ-NOTE-002** — assignMember orphan data audit (CLIENT/PM/SUPER_ADMIN existing assignments) | Session 2 hacker (`03-hacker-report.md` PROJ-NOTE-002) | 🟢 LOW-MEDIUM | data integrity migration |
| 9 | **A3** — Tighten `JwtPayload.role: string → UserRole` enum | Session 2 architect Stage 2 (`01-architect-report.md` A3) | 🟢 LOW | typing improvement |
| 10 | **PROJ-NOTE-001** — audit `newValues: dto` echo cleanup (undefined fields persist) | Session 2 hacker (`03-hacker-report.md` PROJ-NOTE-001) | 🟢 LOW | informational cleanup |
| 11 | **F4** — Phase `reorder` uniqueness على `(projectId, order)` | Plan Q4 deferred | 🟢 LOW | schema migration |

## CLAUDE.md updates (Session 2 closure)

- **Rule #9 (المقترحة):** NEEDS-CODER cycle formal structure — يتطلب session منفصلة (Quick mode) أو cleanup commit. تفاصيل في Session 2 `05-principal-report.md` Q1 above.
```

✋ تم المراجع (تقرير المهمة) — للدور التالي (meta-review)؟

═══════════════════════════════════════════════════════════════
