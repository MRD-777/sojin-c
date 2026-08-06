// MVT #5 (S3) — map-form-to-create-input: pure form → CreateProjectInput.
//
// Pure function, no DOM, no client → default `node` env. Pins the two contracts
// the Create flow leans on: (a) type→enum passthrough only for valid enums, and
// (b) empty optionals are OMITTED, not sent as "" (which would fail @IsDateString
// / @IsNumber / @IsEnum on the backend).
import { describe, it, expect } from "vitest";
import {
  mapFormToCreateInput,
  type ProjectFormState,
} from "@/lib/projects/map-form-to-create-input";

const base: ProjectFormState = {
  name: "  Tower A  ",
  clientId: "client-1",
  type: "",
  description: "",
  location: "",
  startDate: "",
  expectedEndDate: "",
  totalBudget: "",
  dailyUpdateDeadline: "",
};

describe("mapFormToCreateInput", () => {
  it("keeps required fields, trims name, and OMITS every empty optional (not '')", () => {
    const out = mapFormToCreateInput(base);

    expect(out).toEqual({ name: "Tower A", clientId: "client-1" });
    // explicit: empties are ABSENT, never empty strings.
    expect("type" in out).toBe(false);
    expect("description" in out).toBe(false);
    expect("location" in out).toBe(false);
    expect("startDate" in out).toBe(false);
    expect("expectedEndDate" in out).toBe(false);
    expect("totalBudget" in out).toBe(false);
    expect("dailyUpdateDeadline" in out).toBe(false);
  });

  it("passes type through ONLY when it is a valid enum value", () => {
    expect(mapFormToCreateInput({ ...base, type: "CONSTRUCTION" }).type).toBe(
      "CONSTRUCTION",
    );
    // a stale placeholder / legacy UI value can never reach the wire.
    expect("type" in mapFormToCreateInput({ ...base, type: "residential" })).toBe(
      false,
    );
    expect("type" in mapFormToCreateInput({ ...base, type: "" })).toBe(false);
  });

  it("parses totalBudget to a number and drops blank / NaN budgets", () => {
    expect(mapFormToCreateInput({ ...base, totalBudget: "5000" }).totalBudget).toBe(
      5000,
    );
    expect(
      "totalBudget" in mapFormToCreateInput({ ...base, totalBudget: "   " }),
    ).toBe(false);
    expect(
      "totalBudget" in mapFormToCreateInput({ ...base, totalBudget: "abc" }),
    ).toBe(false);
  });

  it("includes optional strings only when non-empty (after trim)", () => {
    const out = mapFormToCreateInput({
      ...base,
      description: "  hi ",
      location: "site",
      startDate: "2026-01-01",
      dailyUpdateDeadline: "08:30",
    });
    expect(out.description).toBe("hi");
    expect(out.location).toBe("site");
    expect(out.startDate).toBe("2026-01-01");
    expect(out.dailyUpdateDeadline).toBe("08:30");
  });

  // EXTRA (architect suggestion — honest boundary spec, not counted in the MVT-5).
  // The mapper does NOT self-guard the required clientId: it passes an empty
  // clientId straight through. This PINS exactly why the Create page needs its
  // own component-level guard before submit (new/page.tsx:141) — without it an
  // empty clientId would leave the form and hit the backend as a 400. A real
  // component-render test of that guard is deferred (see report §"مناطق محتاجة coverage").
  it("does NOT self-guard clientId — an empty clientId passes through (why the page guard exists)", () => {
    const out = mapFormToCreateInput({ ...base, clientId: "" });
    expect(out.clientId).toBe("");
  });
});
