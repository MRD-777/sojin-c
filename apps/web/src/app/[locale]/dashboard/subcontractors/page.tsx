"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import {
  Users,
  Star,
  TrendingUp,
  Wallet,
  Search,
  Plus,
  GitCompare,
  Phone,
  Mail,
  Calendar,
  Eye,
  LayoutGrid,
  List as ListIcon,
  MoreVertical,
} from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { StatCard } from "@/components/dashboard/global/stat-card";
import { Breadcrumbs } from "@/components/dashboard/global/breadcrumbs";
import { EmptyState } from "@/components/dashboard/global/empty-state";
import { cn } from "@/lib/utils";

import { SUBCONTRACTORS, type SubContractor, type Specialty } from "./_data";

type ViewMode = "cards" | "table";
type RatingFilter = "all" | "fourPlus" | "threePlus";
type StatusFilter = "all" | "active" | "inactive";
type SpecialtyFilter = "all" | Specialty;

const SPECIALTIES: Specialty[] = [
  "electrical",
  "plumbing",
  "painting",
  "ac",
  "gypsum",
  "ceramic",
  "steel",
];

function StarRow({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`rating ${rating}`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(
            "w-3.5 h-3.5",
            i <= Math.round(rating)
              ? "fill-amber-400 text-amber-400"
              : "text-muted-foreground/30"
          )}
        />
      ))}
      <span className="ml-1 text-xs font-medium text-foreground/80">
        {rating.toFixed(1)}
      </span>
    </span>
  );
}

function formatCurrency(value: number, locale: string) {
  if (value >= 1_000_000) {
    return locale === "ar"
      ? `${(value / 1_000_000).toFixed(1)}م ج`
      : `${(value / 1_000_000).toFixed(1)}M EGP`;
  }
  if (value >= 1000) {
    return locale === "ar"
      ? `${Math.round(value / 1000)}K ج`
      : `${Math.round(value / 1000)}K EGP`;
  }
  return locale === "ar" ? `${value} ج` : `${value} EGP`;
}

export default function SubcontractorsListPage() {
  const t = useTranslations("Common.subcontractors");
  const tNav = useTranslations("Common.nav");
  const locale = useLocale();
  const isAr = locale === "ar";

  const [search, setSearch] = useState("");
  const [specialty, setSpecialty] = useState<SpecialtyFilter>("all");
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [view, setView] = useState<ViewMode>("cards");
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = useMemo<SubContractor[]>(() => {
    return SUBCONTRACTORS.filter((s) => {
      if (search) {
        const haystack = `${s.name} ${s.nameEn}`.toLowerCase();
        if (!haystack.includes(search.toLowerCase())) return false;
      }
      if (specialty !== "all" && s.specialty !== specialty) return false;
      if (ratingFilter === "fourPlus" && s.rating < 4) return false;
      if (ratingFilter === "threePlus" && s.rating < 3) return false;
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      return true;
    });
  }, [search, specialty, ratingFilter, statusFilter]);

  const stats = useMemo(() => {
    const active = SUBCONTRACTORS.filter((s) => s.status === "active").length;
    const ratingsSum = SUBCONTRACTORS.reduce((acc, s) => acc + s.rating, 0);
    const avgRating = SUBCONTRACTORS.length
      ? ratingsSum / SUBCONTRACTORS.length
      : 0;
    const totalValue = SUBCONTRACTORS.reduce(
      (acc, s) => acc + s.totalContractsValue,
      0
    );
    return {
      total: SUBCONTRACTORS.length,
      active,
      avgRating,
      totalValue,
    };
  }, []);

  return (
    <div className="flex flex-col gap-6 p-6" data-testid="subcontractors-page">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <Breadcrumbs
            items={[
              { label: tNav("dashboard"), href: "/dashboard" },
              { label: tNav("subcontractors"), href: "/dashboard/subcontractors" },
            ]}
          />
          <div className="flex items-center gap-3 mt-1">
            <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
            <Badge variant="outline">{t("count", { count: filtered.length })}</Badge>
          </div>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dashboard/subcontractors/compare"
            className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
          >
            <GitCompare className="w-4 h-4" />
            {t("actions.comparePrices")}
          </Link>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger
              render={
                <Button className="gap-2 bg-[#111] hover:bg-black text-white dark:bg-white dark:hover:bg-gray-100 dark:text-black">
                  <Plus className="w-4 h-4" />
                  {t("actions.addNew")}
                </Button>
              }
            />
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{t("addDialog.title")}</DialogTitle>
                <DialogDescription>{t("addDialog.description")}</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-3 py-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="sub-name">{t("addDialog.name")}</Label>
                  <Input id="sub-name" placeholder={t("addDialog.namePlaceholder")} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="sub-specialty">{t("addDialog.specialty")}</Label>
                  <Select>
                    <SelectTrigger id="sub-specialty" className="w-full">
                      <SelectValue placeholder={t("addDialog.specialtyPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {SPECIALTIES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {t(`specialty.${s}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="sub-phone">{t("addDialog.phone")}</Label>
                  <Input id="sub-phone" placeholder={t("addDialog.phonePlaceholder")} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="sub-email">{t("addDialog.email")}</Label>
                  <Input
                    id="sub-email"
                    type="email"
                    placeholder={t("addDialog.emailPlaceholder")}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="sub-notes">{t("addDialog.notes")}</Label>
                  <Textarea
                    id="sub-notes"
                    rows={3}
                    placeholder={t("addDialog.notesPlaceholder")}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  {t("addDialog.cancel")}
                </Button>
                <Button onClick={() => setDialogOpen(false)}>
                  {t("addDialog.save")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t("stats.total")}
          value={String(stats.total)}
          icon={<Users className="w-5 h-5" />}
          colorClass="bg-black/5 text-[#111] dark:bg-white/10 dark:text-white"
        />
        <StatCard
          title={t("stats.active")}
          value={String(stats.active)}
          icon={<TrendingUp className="w-5 h-5" />}
          colorClass="bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400"
        />
        <StatCard
          title={t("stats.avgRating")}
          value={`${stats.avgRating.toFixed(1)} ★`}
          icon={<Star className="w-5 h-5" />}
          colorClass="bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400"
        />
        <StatCard
          title={t("stats.totalContractValue")}
          value={formatCurrency(stats.totalValue, locale)}
          icon={<Wallet className="w-5 h-5" />}
          colorClass="bg-black/5 text-[#111] dark:bg-white/10 dark:text-white"
        />
      </div>

      <Card className="border-black/5 dark:border-white/5 shadow-sm bg-[#fafafa] dark:bg-[#111]">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
            <div className="relative w-full lg:w-72">
              <Search
                className={cn(
                  "absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground",
                  isAr ? "right-3" : "left-3"
                )}
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("filters.search")}
                className={isAr ? "pr-10" : "pl-10"}
                data-testid="search-input"
              />
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <Select
                value={specialty}
                onValueChange={(v) => setSpecialty(v as SpecialtyFilter)}
              >
                <SelectTrigger className="min-w-[140px]" data-testid="specialty-filter">
                  <SelectValue placeholder={t("filters.specialty")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("specialty.all")}</SelectItem>
                  {SPECIALTIES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(`specialty.${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={ratingFilter}
                onValueChange={(v) => setRatingFilter(v as RatingFilter)}
              >
                <SelectTrigger className="min-w-[140px]">
                  <SelectValue placeholder={t("filters.rating")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("ratingFilter.all")}</SelectItem>
                  <SelectItem value="fourPlus">{t("ratingFilter.fourPlus")}</SelectItem>
                  <SelectItem value="threePlus">{t("ratingFilter.threePlus")}</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as StatusFilter)}
              >
                <SelectTrigger className="min-w-[120px]">
                  <SelectValue placeholder={t("filters.status")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("status.all")}</SelectItem>
                  <SelectItem value="active">{t("status.active")}</SelectItem>
                  <SelectItem value="inactive">{t("status.inactive")}</SelectItem>
                </SelectContent>
              </Select>

              <div className="inline-flex rounded-lg border border-input p-0.5">
                <Button
                  type="button"
                  variant={view === "cards" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setView("cards")}
                  className="gap-1.5 h-7"
                  data-testid="view-cards"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t("filters.viewCards")}</span>
                </Button>
                <Button
                  type="button"
                  variant={view === "table" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setView("table")}
                  className="gap-1.5 h-7"
                  data-testid="view-table"
                >
                  <ListIcon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t("filters.viewTable")}</span>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState title={t("empty.title")} description={t("empty.description")} />
      ) : view === "cards" ? (
        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          data-testid="cards-grid"
        >
          {filtered.map((sub) => (
            <SubContractorCard key={sub.id} sub={sub} isAr={isAr} />
          ))}
        </div>
      ) : (
        <Card className="border-black/5 dark:border-white/5 shadow-sm bg-[#fafafa] dark:bg-[#111] overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-black/5 dark:bg-white/5">
                  <TableRow>
                    <TableHead>{t("table.name")}</TableHead>
                    <TableHead>{t("table.specialty")}</TableHead>
                    <TableHead>{t("table.rating")}</TableHead>
                    <TableHead>{t("table.currentProjects")}</TableHead>
                    <TableHead>{t("table.totalContracts")}</TableHead>
                    <TableHead>{t("table.status")}</TableHead>
                    <TableHead className="text-center w-[80px]">
                      {t("table.actions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((sub) => (
                    <TableRow key={sub.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 border">
                            <AvatarFallback>
                              {(isAr ? sub.name : sub.nameEn).slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-semibold text-sm">
                            {isAr ? sub.name : sub.nameEn}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {t(`specialty.${sub.specialty}`)}
                      </TableCell>
                      <TableCell>
                        <StarRow rating={sub.rating} />
                      </TableCell>
                      <TableCell className="text-sm">{sub.current.length}</TableCell>
                      <TableCell className="text-sm">
                        {formatCurrency(sub.totalContractsValue, locale)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "gap-1.5",
                            sub.status === "active"
                              ? "border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                              : "border-muted text-muted-foreground"
                          )}
                        >
                          <span
                            className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              sub.status === "active" ? "bg-emerald-500" : "bg-gray-400"
                            )}
                          />
                          {t(`status.${sub.status}`)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              className={cn(
                                buttonVariants({ variant: "ghost", size: "icon" }),
                                "h-8 w-8"
                              )}
                            >
                              <MoreVertical className="w-4 h-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                render={
                                  <Link href={`/dashboard/subcontractors/${sub.id}`} />
                                }
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                {t("actions.viewProfile")}
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Phone className="w-4 h-4 mr-2" />
                                {t("actions.contact")}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface CardProps {
  sub: SubContractor;
  isAr: boolean;
}

function SubContractorCard({ sub, isAr }: CardProps) {
  const t = useTranslations("Common.subcontractors");
  const locale = useLocale();
  const initials = (isAr ? sub.name : sub.nameEn)
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("");

  return (
    <Card className="border-black/5 dark:border-white/5 shadow-sm bg-[#fafafa] dark:bg-[#111] hover:shadow-md transition-shadow">
      <CardContent className="p-5 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="h-12 w-12 border">
              <AvatarFallback className="font-semibold">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h3 className="font-semibold text-base leading-tight truncate">
                {isAr ? sub.name : sub.nameEn}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t(`specialty.${sub.specialty}`)}
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "gap-1.5 shrink-0",
              sub.status === "active"
                ? "border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                : "border-muted text-muted-foreground"
            )}
          >
            <span
              className={cn(
                "w-1.5 h-1.5 rounded-full",
                sub.status === "active" ? "bg-emerald-500" : "bg-gray-400"
              )}
            />
            {t(`status.${sub.status}`)}
          </Badge>
        </div>

        <StarRow rating={sub.rating} />

        <Separator />

        <div className="grid grid-cols-1 gap-1.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5" />
            <span dir="ltr">{sub.phone}</span>
          </div>
          {sub.email && (
            <div className="flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" />
              <span className="truncate" dir="ltr">
                {sub.email}
              </span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            <span>
              {t("card.joinedAt")} {sub.joinedAt}
            </span>
          </div>
        </div>

        <Separator />

        <div>
          <p className="text-xs font-semibold mb-2">{t("card.currentProjects")}</p>
          {sub.current.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {t("card.noCurrentProjects")}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {sub.current.map((p) => (
                <div
                  key={p.id}
                  className="rounded-md border border-black/5 dark:border-white/5 bg-background p-2 text-xs"
                >
                  <p className="font-medium">
                    {isAr ? p.projectName : p.projectNameEn} —{" "}
                    <span className="text-muted-foreground">
                      {isAr ? p.phaseName : p.phaseNameEn}
                    </span>
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {t("card.agreed")}: {formatCurrency(p.agreedCost, locale)} ·{" "}
                    {t("card.actual")}: {formatCurrency(p.actualCost, locale)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <Separator />

        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {t("card.totalProjects")}:{" "}
            <span className="font-semibold text-foreground">{sub.totalProjects}</span>
          </span>
          <span className="text-muted-foreground">
            {t("card.totalContracts")}:{" "}
            <span className="font-semibold text-foreground">
              {formatCurrency(sub.totalContractsValue, locale)}
            </span>
          </span>
        </div>

        <div className="flex gap-2 pt-1">
          <Link
            href={`/dashboard/subcontractors/${sub.id}`}
            className={cn(buttonVariants({ variant: "default", size: "sm" }), "flex-1")}
          >
            <Eye className="w-3.5 h-3.5 mr-1.5" />
            {t("actions.viewProfile")}
          </Link>
          <Button variant="outline" size="sm" className="flex-1">
            <Phone className="w-3.5 h-3.5 mr-1.5" />
            {t("actions.contact")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
