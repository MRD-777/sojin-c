import { DashboardLayoutWrapper } from "@/components/dashboard/dashboard-layout";
import { RouteGuard } from "@/components/auth/route-guard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RouteGuard>
      <DashboardLayoutWrapper>{children}</DashboardLayoutWrapper>
    </RouteGuard>
  );
}
