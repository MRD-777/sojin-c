// ============================================
// MVT-4 — money fidelity on the write body (Session A)
//
// Paired assertion (rule #4): the POSITIVE side proves the typed amount reaches
// the wire with ZERO drift (value, JSON serialisation, and 2-decimal round-trip
// all checked — not merely "a number was sent"), and the NEGATIVE side proves a
// malformed amount produces NO `cost` key at all, so nothing ambiguous can ever
// be shipped to an endpoint whose value lands in netDue.
//
// Why not assert `cost` is a STRING: the API rejects it. ValidationPipe runs with
// enableImplicitConversion:false (apps/api/src/main.ts:79-92) and the DTO field
// is @IsNumber() with no @Type() (updates/dto/index.ts:85), so "12500.50" is a
// 400 before the service is reached.
// ============================================
import { describe, it, expect } from "vitest";
import {
  EMPTY_REPORT_FORM,
  mapReportFormToBody,
  validateReportForm,
  type ReportFormState,
} from "./map-report-form-to-body";

const base: ReportFormState = { ...EMPTY_REPORT_FORM, title: "صبّ خرسانة الدور الأرضي" };

const withCost = (cost: string): ReportFormState => ({ ...base, cost });

describe("MVT-4 — cost reaches the wire without drift", () => {
  it('"12500.50" → 12500.5, serialises as 12500.5, round-trips to "12500.50"', () => {
    const body = mapReportFormToBody(withCost("12500.50"));

    expect(body.cost).toBe(12500.5);
    expect(JSON.stringify(body)).toContain('"cost":12500.5');
    expect(body.cost!.toFixed(2)).toBe("12500.50");
  });

  it('max accepted value "999999999.99" survives with no drift', () => {
    const body = mapReportFormToBody(withCost("999999999.99"));

    expect(body.cost).toBe(999999999.99);
    expect(JSON.stringify(body)).toContain('"cost":999999999.99');
    expect(body.cost!.toFixed(2)).toBe("999999999.99");
  });

  it("small amounts keep both decimals", () => {
    const body = mapReportFormToBody(withCost("0.01"));
    expect(body.cost).toBe(0.01);
    expect(body.cost!.toFixed(2)).toBe("0.01");
  });

  // Surrounding whitespace is TRIMMED, not rejected — a paste from a phone
  // keyboard routinely carries it, and trimming cannot change the amount. The
  // plan listed this input as a rejection; that was wrong and is corrected here
  // (coder report, deviation 3). What matters is proven instead: the trimmed
  // amount arrives exactly, with no drift.
  it('" 12500.50 " is trimmed and arrives exactly, not rejected', () => {
    const body = mapReportFormToBody(withCost(" 12500.50 "));

    expect(body.cost).toBe(12500.5);
    expect(body.cost!.toFixed(2)).toBe("12500.50");
    expect(validateReportForm(withCost(" 12500.50 ")).cost).toBeUndefined();
  });

  // An INNER space is a different story: it means the text was never a single
  // well-formed amount, so it must not be guessed at.
  it('"12 500.50" (inner space) is rejected', () => {
    const form = withCost("12 500.50");
    expect(mapReportFormToBody(form)).not.toHaveProperty("cost");
    expect(validateReportForm(form).cost).toBeDefined();
  });

  // ── Negative witness: the shapes that must never reach the network ──
  it.each([
    ["12,500.50", "thousands separator"],
    ["12500.555", "three decimals — the column would round it silently"],
    ["1e5", "scientific notation"],
    ["-5", "negative"],
    ["1000000000", "one digit over the DTO max"],
    ["abc", "not a number"],
    ["١٢٥٠٠", "Arabic-Indic digits"],
  ])("rejects %s (%s): no cost key, and the form is invalid", (raw) => {
    const form = withCost(raw);

    expect(mapReportFormToBody(form)).not.toHaveProperty("cost");
    expect(validateReportForm(form).cost).toBeDefined();
  });

  it("empty cost is simply absent — not 0, not an error", () => {
    const form = withCost("");
    expect(mapReportFormToBody(form)).not.toHaveProperty("cost");
    expect(validateReportForm(form).cost).toBeUndefined();
  });
});

describe("body shape — optional fields are ABSENT, never empty strings", () => {
  it("omits every untouched optional field", () => {
    const body = mapReportFormToBody(base);

    expect(body).toEqual({ title: "صبّ خرسانة الدور الأرضي" });
  });

  it("sends the other numerics as numbers within DTO bounds", () => {
    const body = mapReportFormToBody({
      ...base,
      workersCount: "12",
      workHours: "7.5",
      progressIncrement: "15",
      workDone: "  تم الصبّ  ",
    });

    expect(body.workersCount).toBe(12);
    expect(body.workHours).toBe(7.5);
    expect(body.progressIncrement).toBe(15);
    expect(body.workDone).toBe("تم الصبّ");
  });
});

describe("validation mirrors the DTO bounds", () => {
  it("title shorter than 5 is rejected, exactly 5 is accepted", () => {
    expect(validateReportForm({ ...base, title: "abcd" }).title).toBeDefined();
    expect(validateReportForm({ ...base, title: "abcde" }).title).toBeUndefined();
  });

  it("workHours over 24 rejected, 24 accepted", () => {
    expect(validateReportForm({ ...base, workHours: "24.01" }).workHours).toBeDefined();
    expect(validateReportForm({ ...base, workHours: "24" }).workHours).toBeUndefined();
  });

  it("progressIncrement over 100 rejected, 100 accepted", () => {
    expect(
      validateReportForm({ ...base, progressIncrement: "101" }).progressIncrement,
    ).toBeDefined();
    expect(
      validateReportForm({ ...base, progressIncrement: "100" }).progressIncrement,
    ).toBeUndefined();
  });

  it("workersCount over 1000 rejected, 1000 accepted", () => {
    expect(validateReportForm({ ...base, workersCount: "1001" }).workersCount).toBeDefined();
    expect(validateReportForm({ ...base, workersCount: "1000" }).workersCount).toBeUndefined();
  });

  it("decimals are rejected on the two integer fields", () => {
    expect(validateReportForm({ ...base, workersCount: "12.5" }).workersCount).toBeDefined();
    expect(
      validateReportForm({ ...base, progressIncrement: "15.5" }).progressIncrement,
    ).toBeDefined();
  });
});
