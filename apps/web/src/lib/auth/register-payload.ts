// ============================================
// register-payload — pure mapper (MVT-covered, decision P3)
//
// Merges the two-step register UI (personal step → company step) into the
// single atomic body the backend expects (RegisterCompanyDto,
// apps/api/src/modules/auth/auth.dto). Per decision D1, only the 6 fields
// the backend supports are emitted. Critically: NO `role` is sent — the
// backend forces SUPER_ADMIN (auth.service.ts:133), and the DTO runs with
// whitelist:true (main.ts:80) so any stray field would be rejected anyway.
// ============================================
import type { PendingRegistration } from "@/store/use-auth-store";
import type { RegisterPayload } from "@/lib/api/auth-client";

/** Company step fields. Only `companyName` reaches the backend (D1). */
export interface CompanyStep {
  companyName: string;
  // Deferred (no backend home yet): commercialRegister, specialization,
  // currency, address, taxId, employeeCount. Collected in the UI but NOT
  // transmitted. TODO: persist via /companies once supported.
}

export function buildRegisterPayload(
  personal: PendingRegistration,
  company: CompanyStep,
): RegisterPayload {
  const adminName = `${personal.firstName} ${personal.lastName}`.trim();
  const phone = personal.phone?.trim();

  const payload: RegisterPayload = {
    companyName: company.companyName.trim(),
    // No company-email field in the UI → reuse the admin's email
    // (matches the prior behavior of the removed setupWorkspace action).
    companyEmail: personal.email.trim(),
    adminName,
    adminEmail: personal.email.trim(),
    adminPassword: personal.password,
  };

  // companyPhone is optional — only include when non-empty so the DTO's
  // @IsOptional path is taken rather than failing the phone regex on "".
  if (phone) {
    payload.companyPhone = phone;
  }

  return payload;
}
