"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Building2,
  MapPin,
  Calendar,
  Users,
  DollarSign,
  Compass,
  Scale,
  ShieldCheck,
  UserPlus,
  Trash2,
  Plus,
  Loader2,
  AlertCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useClients } from "@/lib/hooks/use-clients";
import { useCreateProject } from "@/lib/hooks/use-create-project";
import {
  mapFormToCreateInput,
  type ProjectFormState,
} from "@/lib/projects/map-form-to-create-input";

interface WorkerAssignment {
  id: string;
  name: string;
  role: string;
}

// The empty backend-backed form. Every extra wizard field (code, contractType,
// priority, currency, internalBudget/downPayment/retention, workHours,
// constraints, consultant, contractNo/Date, workers) is UI-only and NOT part of
// this state: those map to schema the API does not accept yet (finance → S7,
// assignMember → later). Only the fields below are persisted.
const EMPTY_FORM: ProjectFormState = {
  name: "",
  clientId: "",
  type: "",
  description: "",
  location: "",
  startDate: "",
  expectedEndDate: "",
  totalBudget: "",
  dailyUpdateDeadline: "",
};

export default function NewProjectPage() {
  const t = useTranslations("Common");
  const router = useRouter();
  const [step, setStep] = useState(1);

  // ── backend-backed form state ──
  const [form, setForm] = useState<ProjectFormState>(EMPTY_FORM);
  const setField = <K extends keyof ProjectFormState>(
    key: K,
    value: ProjectFormState[K],
  ) => setForm((f) => ({ ...f, [key]: value }));

  // ── data / mutation ──
  const { data: clients, isLoading: clientsLoading, isError: clientsError } =
    useClients();
  const createProject = useCreateProject();

  // Local (client-side) validation message; distinct from the backend error the
  // mutation surfaces. Step fields are conditionally rendered, so HTML `required`
  // on the hidden Step-1 name won't fire at submit — we validate manually.
  const [formError, setFormError] = useState<string | null>(null);
  const backendError =
    createProject.error != null
      ? (createProject.error as { message?: string }).message ?? null
      : null;

  // ── workers step: UI-only (assignMember not wired — no bulk assign endpoint
  //    in S3; these are collected for UX only and intentionally NOT submitted) ──
  const [workers, setWorkers] = useState<WorkerAssignment[]>([]);
  const [newWorkerName, setNewWorkerName] = useState("");
  const [newWorkerRole, setNewWorkerRole] = useState("siteEng");
  const [customRoles, setCustomRoles] = useState<string[]>([]);
  const [newCustomRole, setNewCustomRole] = useState("");
  const [showCustomRoleInput, setShowCustomRoleInput] = useState(false);

  const steps = [
    { id: 1, name: t("dashboardPage.projects.new.step1"), icon: ShieldCheck },
    { id: 2, name: t("dashboardPage.projects.new.step2"), icon: Compass },
    { id: 3, name: t("dashboardPage.projects.new.step3"), icon: Scale },
    { id: 4, name: t("dashboardPage.projects.new.step4"), icon: DollarSign },
    { id: 5, name: t("dashboardPage.projects.new.step5"), icon: Users }
  ];

  const handleNext = () => {
    if (step < steps.length) setStep(step + 1);
  };

  const handlePrev = () => {
    if (step > 1) setStep(step - 1);
  };

  const addWorker = () => {
    if (!newWorkerName) return;
    const worker: WorkerAssignment = {
      id: Math.random().toString(36).substr(2, 9),
      name: newWorkerName,
      role: newWorkerRole === "custom" ? newCustomRole : t(`dashboardPage.projects.new.roles.${newWorkerRole}`)
    };
    setWorkers([...workers, worker]);
    setNewWorkerName("");
  };

  const removeWorker = (id: string) => {
    setWorkers(workers.filter(w => w.id !== id));
  };

  const addCustomRole = () => {
    if (newCustomRole && !customRoles.includes(newCustomRole)) {
      setCustomRoles([...customRoles, newCustomRole]);
      setNewWorkerRole("custom");
      setShowCustomRoleInput(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (createProject.isPending) return;

    // Manual required-field guard (name + clientId): if either is missing we
    // send the user back to Step 1 where both live rather than firing a request
    // the backend would reject with 400.
    if (!form.name.trim() || !form.clientId) {
      setFormError(
        "اسم المشروع والعميل مطلوبان — أكملهما في الخطوة الأولى.",
      );
      setStep(1);
      return;
    }
    setFormError(null);

    createProject.mutate(mapFormToCreateInput(form), {
      onSuccess: (created) => {
        // Relative push from /projects/new → /projects/{id} (same convention the
        // detail/list pages use). invalidateQueries(['projects']) is handled in
        // the hook's onSuccess so the list is fresh on arrival.
        router.push(`./${created.id}`);
      },
    });
  };

  return (
    <div className="max-w-[1800px] mx-auto space-y-10 px-4 sm:px-8 py-12 w-full animate-in fade-in slide-in-from-bottom-4 duration-1000">
      <header className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-black dark:bg-white text-white dark:text-black mb-4 shadow-xl">
          <Building2 className="w-8 h-8" />
        </div>
        <h1 className="text-4xl font-black tracking-tighter text-[#111] dark:text-white">
          {t("dashboardPage.projects.new.title")}
        </h1>
        <p className="text-base text-[#666] dark:text-[#999] max-w-xl mx-auto leading-relaxed">
          {t("dashboardPage.projects.new.subtitle")}
        </p>
      </header>

      {/* Progress Wizard - Enterprise Style */}
      <div className="relative pt-4 pb-12">
        <div className="absolute top-[44px] left-0 w-full h-0.5 bg-black/5 dark:bg-white/5 -z-10" />
        <div
          className="absolute top-[44px] left-0 h-0.5 bg-[#111] dark:bg-white transition-all duration-700 ease-in-out -z-10"
          style={{ width: `${((step - 1) / (steps.length - 1)) * 100}%` }}
        />

        <div className="flex justify-between">
          {steps.map((s) => {
            const isCompleted = step > s.id;
            const isCurrent = step === s.id;
            const Icon = s.icon;
            return (
              <div key={s.id} className="flex flex-col items-center gap-4 group cursor-pointer" onClick={() => s.id < step && setStep(s.id)}>
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border-2 transition-all duration-500 shadow-sm ${
                  isCompleted
                    ? "bg-[#111] border-[#111] text-white dark:bg-white dark:border-white dark:text-black scale-90"
                    : isCurrent
                      ? "bg-white border-[#111] text-[#111] dark:bg-black dark:border-white dark:text-white scale-110 shadow-xl"
                      : "bg-white border-black/10 text-[#999] dark:bg-black dark:border-white/10 dark:text-[#666]"
                }`}>
                  {isCompleted ? <Check className="w-6 h-6" /> : <Icon className="w-6 h-6" />}
                </div>
                <div className="flex flex-col items-center">
                  <span className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isCurrent || isCompleted ? "text-[#111] dark:text-white" : "text-[#999]"}`}>
                    {t("dashboardPage.projects.new.step1").split(' ')[0]} {s.id}
                  </span>
                  <span className={`text-xs font-bold text-center max-w-[80px] leading-tight ${isCurrent || isCompleted ? "text-[#111] dark:text-white" : "text-[#999]"}`}>
                    {s.name}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <Card className="border-black/5 dark:border-white/5 shadow-2xl shadow-black/5 bg-white/80 dark:bg-black/80 backdrop-blur-xl overflow-hidden rounded-3xl">
          <CardHeader className="p-8 border-b border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01]">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center">
                {React.createElement(steps[step-1].icon, { className: "w-6 h-6 text-[#111] dark:text-white" })}
              </div>
              <div>
                <CardTitle className="text-2xl font-black text-[#111] dark:text-white">
                  {steps[step - 1].name}
                </CardTitle>
                <CardDescription className="text-sm font-medium mt-1">
                  خطوة {step} من {steps.length}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8">

            {/* STEP 1: PROJECT CHARTER */}
            {step === 1 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in duration-500">
                <div className="space-y-3 md:col-span-2">
                  <Label htmlFor="name" className="text-sm font-bold text-[#111] dark:text-white">
                    {t("dashboardPage.projects.new.nameLabel")}
                  </Label>
                  <Input
                    id="name"
                    placeholder={t("dashboardPage.projects.new.namePlaceholder")}
                    className="h-12 border-black/10 dark:border-white/10 rounded-xl px-4"
                    value={form.name}
                    onChange={(e) => setField("name", e.target.value)}
                    required
                  />
                </div>

                {/* Real CLIENT selector — supplies the required clientId (uuid). */}
                <div className="space-y-3 md:col-span-2">
                  <Label htmlFor="clientId" className="text-sm font-bold text-[#111] dark:text-white">
                    {t("dashboardPage.projects.new.clientLabel")}
                  </Label>
                  <select
                    id="clientId"
                    className="flex h-12 w-full rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-black px-4 py-2 text-sm text-[#111] dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white transition-all outline-none appearance-none disabled:opacity-60"
                    value={form.clientId}
                    onChange={(e) => setField("clientId", e.target.value)}
                    disabled={clientsLoading || clientsError}
                    required
                  >
                    <option value="" disabled>
                      {clientsLoading
                        ? t("loading")
                        : clientsError
                          ? "تعذّر تحميل العملاء"
                          : t("dashboardPage.projects.new.clientPlaceholder")}
                    </option>
                    {clients?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} — {c.email}
                      </option>
                    ))}
                  </select>
                  {clients && clients.length === 0 && !clientsLoading && (
                    <p className="text-xs text-[#999]">
                      لا يوجد عملاء بعد — أضف عميلاً أولاً من صفحة الفريق.
                    </p>
                  )}
                </div>

                <div className="space-y-3">
                  <Label htmlFor="code" className="text-sm font-bold text-[#111] dark:text-white">
                    {t("dashboardPage.projects.new.codeLabel")}
                  </Label>
                  {/* UI-only: the API assigns no project code field yet. */}
                  <Input id="code" placeholder={t("dashboardPage.projects.new.codePlaceholder")} className="h-12 border-black/10 dark:border-white/10 rounded-xl px-4" />
                </div>

                <div className="space-y-3">
                  <Label htmlFor="type" className="text-sm font-bold text-[#111] dark:text-white">
                    {t("dashboardPage.projects.new.typeLabel")}
                  </Label>
                  {/* Options are the real backend enum values (ProjectType). */}
                  <select
                    id="type"
                    className="flex h-12 w-full rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-black px-4 py-2 text-sm text-[#111] dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white transition-all outline-none appearance-none"
                    value={form.type}
                    onChange={(e) => setField("type", e.target.value)}
                  >
                    <option value="" disabled>{t("dashboardPage.projects.new.typePlaceholder")}</option>
                    <option value="FULL_FINISHING">تشطيب كامل</option>
                    <option value="PARTIAL_FINISHING">تشطيب جزئي</option>
                    <option value="CONSTRUCTION">إنشاءات</option>
                  </select>
                </div>

                <div className="space-y-3 md:col-span-2">
                  <Label htmlFor="desc" className="text-sm font-bold text-[#111] dark:text-white">
                    {t("dashboardPage.projects.new.descLabel")}
                  </Label>
                  <Textarea
                    id="desc"
                    placeholder={t("dashboardPage.projects.new.descPlaceholder")}
                    className="border-black/10 dark:border-white/10 rounded-xl min-h-[120px] p-4 leading-relaxed"
                    value={form.description}
                    onChange={(e) => setField("description", e.target.value)}
                  />
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-bold text-[#111] dark:text-white">
                    {t("dashboardPage.projects.new.contractTypeLabel")}
                  </Label>
                  {/* UI-only decorative (no contract model in API yet). */}
                  <select className="flex h-12 w-full rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-black px-4 py-2 text-sm text-[#111] dark:text-white outline-none">
                    <option value="lumpSum">{t("dashboardPage.projects.new.contractLumpSum")}</option>
                    <option value="unitRate">{t("dashboardPage.projects.new.contractUnitRate")}</option>
                    <option value="costPlus">{t("dashboardPage.projects.new.contractCostPlus")}</option>
                  </select>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-bold text-[#111] dark:text-white">
                    {t("dashboardPage.projects.new.priorityLabel")}
                  </Label>
                  {/* UI-only decorative (no priority field in API yet). */}
                  <select className="flex h-12 w-full rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-black px-4 py-2 text-sm text-[#111] dark:text-white outline-none">
                    <option value="normal">{t("dashboardPage.projects.new.priorityNormal")}</option>
                    <option value="high">{t("dashboardPage.projects.new.priorityHigh")}</option>
                    <option value="urgent">{t("dashboardPage.projects.new.priorityUrgent")}</option>
                  </select>
                </div>
              </div>
            )}

            {/* STEP 2: LOCATION & TIME */}
            {step === 2 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in duration-500">
                <div className="space-y-3 md:col-span-2">
                  <Label htmlFor="location" className="text-sm font-bold text-[#111] dark:text-white">
                    {t("dashboardPage.projects.new.locationLabel")}
                  </Label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999]" />
                    <Input
                      id="location"
                      placeholder={t("dashboardPage.projects.new.locationPlaceholder")}
                      className="h-12 border-black/10 dark:border-white/10 rounded-xl pl-12"
                      value={form.location}
                      onChange={(e) => setField("location", e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="startDate" className="text-sm font-bold text-[#111] dark:text-white">
                    {t("dashboardPage.projects.new.startDateLabel")}
                  </Label>
                  <Input
                    type="date"
                    id="startDate"
                    className="h-12 border-black/10 dark:border-white/10 rounded-xl px-4 text-start rtl:text-end"
                    value={form.startDate}
                    onChange={(e) => setField("startDate", e.target.value)}
                  />
                </div>

                <div className="space-y-3">
                  <Label htmlFor="deliveryDate" className="text-sm font-bold text-[#111] dark:text-white">
                    {t("dashboardPage.projects.new.deliveryDateLabel")}
                  </Label>
                  <Input
                    type="date"
                    id="deliveryDate"
                    className="h-12 border-black/10 dark:border-white/10 rounded-xl px-4 text-start rtl:text-end"
                    value={form.expectedEndDate}
                    onChange={(e) => setField("expectedEndDate", e.target.value)}
                  />
                </div>

                <div className="space-y-3">
                  <Label htmlFor="dailyDeadline" className="text-sm font-bold text-[#111] dark:text-white">
                    موعد التحديث اليومي
                  </Label>
                  {/* Real backend field (HH:mm). Optional — omitted when blank. */}
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999]" />
                    <Input
                      type="time"
                      id="dailyDeadline"
                      className="h-12 border-black/10 dark:border-white/10 rounded-xl pl-12 text-start rtl:text-end"
                      value={form.dailyUpdateDeadline}
                      onChange={(e) => setField("dailyUpdateDeadline", e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="constraints" className="text-sm font-bold text-[#111] dark:text-white">
                    {t("dashboardPage.projects.new.constraintsLabel")}
                  </Label>
                  {/* UI-only decorative. */}
                  <Input id="constraints" placeholder={t("dashboardPage.projects.new.constraintsPlaceholder")} className="h-12 border-black/10 dark:border-white/10 rounded-xl px-4" />
                </div>
              </div>
            )}

            {/* STEP 3: STAKEHOLDERS & CONTRACTS — UI-only (no contract/consultant
                model in API yet; the real client lives in Step 1's selector). */}
            {step === 3 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in duration-500">
                <div className="space-y-3 md:col-span-2">
                  <div className="flex items-start gap-3 p-4 rounded-xl border border-dashed border-black/10 dark:border-white/10 bg-black/[0.01] dark:bg-white/[0.01]">
                    <AlertCircle className="w-4 h-4 text-[#999] mt-0.5 shrink-0" />
                    <p className="text-xs text-[#666] dark:text-[#999] leading-relaxed">
                      العميل الرسمي يُحدَّد في الخطوة الأولى. الحقول التالية للعرض فقط
                      (بيانات الاستشاري والعقد) وتُدار لاحقاً — TODO: عقود/استشاري (backend لاحق).
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  <Label htmlFor="consultant" className="text-sm font-bold text-[#111] dark:text-white">
                    {t("dashboardPage.projects.new.consultantLabel")}
                  </Label>
                  <Input id="consultant" placeholder={t("dashboardPage.projects.new.consultantPlaceholder")} className="h-12 border-black/10 dark:border-white/10 rounded-xl px-4" />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="contractNo" className="text-sm font-bold text-[#111] dark:text-white">
                    {t("dashboardPage.projects.new.contractNoLabel")}
                  </Label>
                  <Input id="contractNo" className="h-12 border-black/10 dark:border-white/10 rounded-xl px-4" />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="contractDate" className="text-sm font-bold text-[#111] dark:text-white">
                    {t("dashboardPage.projects.new.contractDateLabel")}
                  </Label>
                  <Input type="date" id="contractDate" className="h-12 border-black/10 dark:border-white/10 rounded-xl px-4" />
                </div>
              </div>
            )}

            {/* STEP 4: BUDGET & FINANCE */}
            {step === 4 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-in fade-in duration-500">
                <div className="space-y-3 md:col-span-2">
                  <Label htmlFor="totalBudget" className="text-sm font-bold text-[#111] dark:text-white">
                    {t("dashboardPage.projects.new.budgetLabel")}
                  </Label>
                  <div className="relative">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999]" />
                    <Input
                      id="totalBudget"
                      type="number"
                      placeholder="0.00"
                      className="h-12 border-black/10 dark:border-white/10 rounded-xl pl-12 font-black text-lg"
                      value={form.totalBudget}
                      onChange={(e) => setField("totalBudget", e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <Label className="text-sm font-bold text-[#111] dark:text-white">
                    {t("dashboardPage.projects.new.currencyLabel")}
                  </Label>
                  {/* UI-only: single-currency backend for now. */}
                  <select className="flex h-12 w-full rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-black px-4 outline-none">
                    <option value="SAR">ر.س (SAR)</option>
                    <option value="EGP">ج.م (EGP)</option>
                    <option value="USD">$ (USD)</option>
                  </select>
                </div>
                {/* internalBudget / downPayment / retention → payments (S7). UI-only. */}
                <div className="space-y-3">
                  <Label htmlFor="internalBudget" className="text-sm font-bold text-[#111] dark:text-white">
                    {t("dashboardPage.projects.new.internalBudgetLabel")}
                  </Label>
                  <Input id="internalBudget" type="number" className="h-12 border-black/10 dark:border-white/10 rounded-xl px-4" />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="downPayment" className="text-sm font-bold text-[#111] dark:text-white">
                    {t("dashboardPage.projects.new.downPaymentLabel")}
                  </Label>
                  <Input id="downPayment" type="number" className="h-12 border-black/10 dark:border-white/10 rounded-xl px-4" />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="retention" className="text-sm font-bold text-[#111] dark:text-white">
                    {t("dashboardPage.projects.new.retentionLabel")}
                  </Label>
                  <Input id="retention" type="number" className="h-12 border-black/10 dark:border-white/10 rounded-xl px-4" />
                </div>
              </div>
            )}

            {/* STEP 5: WORKFORCE — UI-only (assignMember not wired in S3). */}
            {step === 5 && (
              <div className="space-y-10 animate-in fade-in duration-500">
                <div className="flex items-start gap-3 p-4 rounded-xl border border-dashed border-black/10 dark:border-white/10 bg-black/[0.01] dark:bg-white/[0.01]">
                  <AlertCircle className="w-4 h-4 text-[#999] mt-0.5 shrink-0" />
                  <p className="text-xs text-[#666] dark:text-[#999] leading-relaxed">
                    تعيين الفريق للعرض فقط في هذه المرحلة — TODO: ربط تعيين الأعضاء
                    (assign member) في session لاحقة. لن تُرسَل هذه البيانات مع إنشاء المشروع.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="space-y-3">
                    <Label className="text-sm font-bold text-[#111] dark:text-white">{t("dashboardPage.projects.new.managerLabel")}</Label>
                    <select className="flex h-12 w-full rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-black px-4 outline-none">
                      <option value="">اختر مدير المشروع</option>
                      <option value="1">أحمد علي</option>
                      <option value="2">سارة حسن</option>
                    </select>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-sm font-bold text-[#111] dark:text-white">{t("dashboardPage.projects.new.residentEngLabel")}</Label>
                    <select className="flex h-12 w-full rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-black px-4 outline-none">
                      <option value="">اختر المهندس المقيم</option>
                      <option value="1">عمر زيد</option>
                      <option value="2">خالد منصور</option>
                    </select>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-sm font-bold text-[#111] dark:text-white">{t("dashboardPage.projects.new.accountantLabel")}</Label>
                    <select className="flex h-12 w-full rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-black px-4 outline-none">
                      <option value="">اختر المحاسب</option>
                      <option value="1">محمد السعيد</option>
                    </select>
                  </div>
                </div>

                <div className="pt-8 border-t border-black/5 dark:border-white/5 space-y-6">
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-black text-[#111] dark:text-white flex items-center gap-2">
                      <UserPlus className="w-5 h-5" />
                      {t("dashboardPage.projects.new.workforceTitle")}
                    </h4>
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-xl h-10 gap-2 border-black/10"
                      onClick={() => setShowCustomRoleInput(!showCustomRoleInput)}
                    >
                      {t("dashboardPage.projects.new.customRole")}
                    </Button>
                  </div>

                  {showCustomRoleInput && (
                    <Card className="p-4 bg-black/[0.02] border-dashed border-2 border-black/10">
                      <div className="flex gap-3">
                        <Input
                          placeholder={t("dashboardPage.projects.new.customRolePlaceholder")}
                          value={newCustomRole}
                          onChange={(e) => setNewCustomRole(e.target.value)}
                          className="h-11 rounded-xl"
                        />
                        <Button type="button" className="bg-[#111] text-white rounded-xl px-6" onClick={addCustomRole}>
                          إضافة التصنيف
                        </Button>
                      </div>
                    </Card>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-black/[0.01] dark:bg-white/[0.01] p-6 rounded-2xl border border-black/5">
                    <div className="md:col-span-2 space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-widest text-[#999]">{t("dashboardPage.projects.new.workerName")}</Label>
                      <Input
                        placeholder="أدخل اسم العامل..."
                        value={newWorkerName}
                        onChange={(e) => setNewWorkerName(e.target.value)}
                        className="h-11 rounded-xl border-black/10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-widest text-[#999]">{t("dashboardPage.projects.new.workerRole")}</Label>
                      <select
                        className="flex h-11 w-full rounded-xl border border-black/10 bg-white dark:bg-black px-4 outline-none text-sm"
                        value={newWorkerRole}
                        onChange={(e) => setNewWorkerRole(e.target.value)}
                      >
                        {Object.keys(t.raw("dashboardPage.projects.new.roles")).map((role) => (
                          <option key={role} value={role}>{t(`dashboardPage.projects.new.roles.${role}`)}</option>
                        ))}
                        {customRoles.map((role) => (
                          <option key={role} value={role}>{role}</option>
                        ))}
                      </select>
                    </div>
                    <Button type="button" className="h-11 rounded-xl bg-[#111] text-white gap-2" onClick={addWorker}>
                      <Plus className="w-4 h-4" />
                      {t("dashboardPage.projects.new.addWorker")}
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {workers.map((w) => (
                      <div key={w.id} className="flex items-center justify-between p-4 rounded-xl border border-black/5 bg-white dark:bg-[#111] shadow-sm group">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-black/5 dark:bg-white/10 flex items-center justify-center text-[10px] font-black uppercase">
                            {w.name.substring(0, 2)}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-[#111] dark:text-white">{w.name}</div>
                            <Badge variant="outline" className="text-[10px] font-bold mt-1 h-5">{w.role}</Badge>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeWorker(w.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

          </CardContent>
        </Card>

        {/* Submit / validation error banner */}
        {(formError || backendError) && (
          <div className="flex items-start gap-3 p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-red-600 dark:text-red-400">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <p className="text-sm font-medium leading-relaxed">
              {formError ?? backendError}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => step === 1 ? router.push('./') : handlePrev()}
            className="text-[#666] dark:text-[#999] h-14 px-8 font-bold gap-3 hover:bg-black/5"
          >
            {step === 1 ? t("dashboardPage.projects.new.btnCancel") : (
              <>
                <ArrowLeft className="w-5 h-5 hidden rtl:block" />
                <ArrowRight className="w-5 h-5 hidden ltr:block" />
                {t("dashboardPage.projects.new.btnPrev")}
              </>
            )}
          </Button>

          <div className="flex gap-4">
            {step < steps.length ? (
              <Button
                type="button"
                onClick={handleNext}
                className="bg-[#111] text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90 h-14 px-10 rounded-2xl font-black text-lg gap-3 shadow-xl"
              >
                {t("dashboardPage.projects.new.btnNext")}
                <ArrowRight className="w-5 h-5 hidden rtl:block animate-pulse" />
                <ArrowLeft className="w-5 h-5 hidden ltr:block animate-pulse" />
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={createProject.isPending}
                className="bg-green-600 text-white hover:bg-green-700 h-14 px-12 rounded-2xl font-black text-xl shadow-xl shadow-green-500/20 gap-3 disabled:opacity-70"
              >
                {createProject.isPending && <Loader2 className="w-5 h-5 animate-spin" />}
                {t("dashboardPage.projects.new.btnCreate")}
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
