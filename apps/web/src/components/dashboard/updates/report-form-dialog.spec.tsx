// @vitest-environment jsdom
// ============================================
// MVT-1 / MVT-2 / MVT-3 — the authoring flow under a flaky network (Session A)
//
// These drive the REAL PhaseReportButton → ReportFormDialog pair (not a stub),
// mocking only the module boundary (updates-client). That boundary is where the
// guarantees live: how many times `create` is called, which id `submit` gets,
// and whether what the user typed survives.
//
// Each spec carries a PAIRED assertion (rule #4) — the call that was made AND
// the user-visible consequence, because either one alone can be green while the
// feature is broken.
// ============================================
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";

const { createUpdate, editUpdate, submitUpdate, listPhaseUpdates, getUpdate } =
  vi.hoisted(() => ({
    createUpdate: vi.fn(),
    editUpdate: vi.fn(),
    submitUpdate: vi.fn(),
    listPhaseUpdates: vi.fn(),
    getUpdate: vi.fn(),
  }));

vi.mock("@/lib/api/updates-client", () => ({
  createUpdate,
  editUpdate,
  submitUpdate,
  listPhaseUpdates,
  getUpdate,
  approveUpdate: vi.fn(),
  rejectUpdate: vi.fn(),
  forceCancelUpdate: vi.fn(),
}));

import { PhaseReportButton } from "./phase-report-button";
import { mapAuthError } from "@/lib/api/map-auth-error";
import messages from "../../../../messages/ar.json";
import type { UpdateListItem } from "@/types/update";

// 🔴 Rejections are built by running the REAL mapAuthError over a real
// axios-shaped error, never hand-written. client.ts:96-97 rejects with
// `{...mapAuthError(e), sessionDisposition}` and nothing else, so a literal of
// our own invention could be a stimulus production cannot emit — the failure
// mode recorded as انحراف (هـ) in session 2026-08-08. The shape itself is
// proven independently in lib/api/updates-client.conflict-shape.spec.ts
// (status:409 + the Arabic message + sessionDisposition).

/** The duplicate-guard conflict, as the real pipeline normalises it. */
const conflictRejection = () =>
  mapAuthError({
    isAxiosError: true,
    response: {
      status: 409,
      data: {
        success: false,
        code: "COMMON_BIZ_409",
        message: "لديك تحديث مسودة على هذه المرحلة اليوم.",
        requestId: "req-1",
      },
    },
    request: {},
  });

/** A lost connection: a request was made, no response ever came back. */
const networkRejection = () =>
  mapAuthError({ isAxiosError: true, request: {}, message: "Network Error" });

const USER_ID = "user-1";
const PHASE = { id: "phase-1", name: "الأساسات" };

function row(over: Partial<UpdateListItem> = {}): UpdateListItem {
  return {
    id: "upd-1",
    title: "عنوان من السيرفر",
    description: null,
    workDone: null,
    workersCount: 0,
    workHours: "0",
    cost: "0",
    progressIncrement: 0,
    status: "DRAFT",
    rejectionReason: null,
    isLocked: false,
    submittedAt: null,
    reviewedAt: null,
    createdAt: new Date("2026-10-15T08:00:00Z").toISOString(),
    submitter: { id: USER_ID, name: "محمد", role: "SITE_ENGINEER", avatar: null },
    reviewer: null,
    _count: { media: 0, comments: 0 },
    ...over,
  };
}

const page = (items: UpdateListItem[]) => ({
  items,
  total: items.length,
  page: 1,
  limit: 20,
  totalPages: 1,
});

function renderButton() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <NextIntlClientProvider locale="ar" messages={messages} timeZone="Africa/Cairo">
      <QueryClientProvider client={queryClient}>
        <PhaseReportButton
          phase={PHASE}
          projectId="proj-1"
          userId={USER_ID}
          active
        />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

/** Open the dialog and type a valid title + an amount. */
async function openAndFill(title = "صبّ خرسانة الدور الأرضي", cost = "12500.50") {
  fireEvent.click(await screen.findByRole("button", { name: /تقرير يومي/ }));
  const titleInput = await screen.findByLabelText(/عنوان التقرير/);
  fireEvent.change(titleInput, { target: { value: title } });
  fireEvent.change(screen.getByLabelText(/تكلفة الأعمال المنفذة اليوم/), {
    target: { value: cost },
  });
  return titleInput;
}

const send = () =>
  fireEvent.click(screen.getByRole("button", { name: /إرسال للمراجعة/ }));

beforeEach(() => {
  vi.clearAllMocks();
  listPhaseUpdates.mockResolvedValue(page([]));
  getUpdate.mockResolvedValue(undefined);
});

afterEach(cleanup);

describe("MVT-1 — sending a report", () => {
  it("calls submit with the created id AND the row badge turns PENDING", async () => {
    // The fixture models the SERVER: each mutation moves the stored row, and the
    // list read returns whatever is stored at that moment. Swapping the list
    // mock after the fact would be meaningless — the invalidation refetch has
    // already happened by then.
    let stored: UpdateListItem[] = [];
    listPhaseUpdates.mockImplementation(async () => page(stored));
    createUpdate.mockImplementation(async () => {
      stored = [row({ id: "upd-new", status: "DRAFT" })];
      return { id: "upd-new", status: "DRAFT" };
    });
    submitUpdate.mockImplementation(async () => {
      stored = [row({ id: "upd-new", status: "PENDING" })];
      return { id: "upd-new", status: "PENDING" };
    });

    renderButton();
    await openAndFill();
    send();

    // (a) the call that was made
    await waitFor(() => expect(submitUpdate).toHaveBeenCalledWith("upd-new"));
    expect(createUpdate).toHaveBeenCalledTimes(1);
    expect(createUpdate).toHaveBeenCalledWith(
      PHASE.id,
      expect.objectContaining({ title: "صبّ خرسانة الدور الأرضي", cost: 12500.5 }),
    );

    // (b) the consequence the user sees on the phase row, via the real
    // invalidate → refetch path.
    await waitFor(() => expect(screen.getByText("قيد المراجعة")).toBeInTheDocument());
  });
});

describe("MVT-2 — 409 on create (the response was lost, not the request)", () => {
  it("switches to continue-mode AND keeps the locally typed values", async () => {
    createUpdate.mockRejectedValue(conflictRejection());

    renderButton();
    const titleInput = await openAndFill("عنواني المحلي المكتوب");

    // The server's row carries a DIFFERENT title on purpose: if the form were
    // re-hydrated from the server, this assertion would catch it.
    listPhaseUpdates.mockResolvedValue(
      page([row({ id: "upd-existing", status: "DRAFT", title: "عنوان من السيرفر" })]),
    );

    send();

    // (a) adopted the existing row and told the user what to do
    await waitFor(() =>
      expect(screen.getByText(/اضغط إرسال تاني/)).toBeInTheDocument(),
    );
    // (b) nothing the user typed was touched
    expect(titleInput).toHaveValue("عنواني المحلي المكتوب");
    expect(screen.getByLabelText(/تكلفة الأعمال المنفذة اليوم/)).toHaveValue(
      "12500.50",
    );

    // and the next press continues that row instead of creating again
    editUpdate.mockResolvedValue({ id: "upd-existing", status: "DRAFT" });
    submitUpdate.mockResolvedValue({ id: "upd-existing", status: "PENDING" });
    send();
    await waitFor(() => expect(submitUpdate).toHaveBeenCalledWith("upd-existing"));
    expect(createUpdate).toHaveBeenCalledTimes(1);
  });

  it("locks the form when the blocking report is already PENDING", async () => {
    createUpdate.mockRejectedValue(conflictRejection());

    renderButton();
    await openAndFill();

    listPhaseUpdates.mockResolvedValue(
      page([row({ id: "upd-pending", status: "PENDING" })]),
    );
    send();

    await waitFor(() =>
      expect(screen.getByText(/حالة تقرير النهاردة/)).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("button", { name: /إرسال للمراجعة/ }),
    ).not.toBeInTheDocument();
  });
});

describe("MVT-3 — create succeeded, submit failed", () => {
  it("the second press re-submits the SAME id and never creates again", async () => {
    createUpdate.mockResolvedValue({ id: "upd-new", status: "DRAFT" });
    submitUpdate.mockRejectedValueOnce(networkRejection());

    renderButton();
    await openAndFill();

    // The row exists server-side as a DRAFT, so the failure is transient and
    // the dialog must stay open in continue-mode.
    listPhaseUpdates.mockResolvedValue(
      page([row({ id: "upd-new", status: "DRAFT" })]),
    );

    send();
    await waitFor(() => expect(submitUpdate).toHaveBeenCalledTimes(1));
    expect(createUpdate).toHaveBeenCalledTimes(1);

    submitUpdate.mockResolvedValue({ id: "upd-new", status: "PENDING" });
    send();

    await waitFor(() => expect(submitUpdate).toHaveBeenCalledTimes(2));
    // (a) create was NOT repeated …
    expect(createUpdate).toHaveBeenCalledTimes(1);
    // (b) … and both submits targeted the same id
    expect(submitUpdate.mock.calls.map((c) => c[0])).toEqual(["upd-new", "upd-new"]);
  });
});

describe("saving a draft (no submit)", () => {
  it("creates once, keeps the dialog open and keeps the typed values", async () => {
    createUpdate.mockResolvedValue({ id: "upd-draft", status: "DRAFT" });

    renderButton();
    const titleInput = await openAndFill("مسودة نص اليوم");
    fireEvent.click(screen.getByRole("button", { name: /حفظ كمسودة/ }));

    // (a) exactly one create, and NO submit — a draft must not reach review
    await waitFor(() => expect(createUpdate).toHaveBeenCalledTimes(1));
    expect(submitUpdate).not.toHaveBeenCalled();

    // (b) the dialog is still there with the same values, so the engineer can
    //     keep typing (the form is the only place that text exists on a phone)
    expect(titleInput).toHaveValue("مسودة نص اليوم");
    expect(screen.getByLabelText(/تكلفة الأعمال المنفذة اليوم/)).toHaveValue("12500.50");

    // and pressing save again edits that row instead of creating a second one
    editUpdate.mockResolvedValue({ id: "upd-draft", status: "DRAFT" });
    fireEvent.click(screen.getByRole("button", { name: /حفظ كمسودة/ }));
    await waitFor(() => expect(editUpdate).toHaveBeenCalledTimes(1));
    expect(createUpdate).toHaveBeenCalledTimes(1);
    expect(editUpdate.mock.calls[0][0]).toBe("upd-draft");
  });
});

describe("request cost of the Phases tab (measurement, not a gate)", () => {
  it("issues one list request per phase — 15 phases ⇒ 15 parallel requests", async () => {
    listPhaseUpdates.mockResolvedValue(page([]));
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const phases = Array.from({ length: 15 }, (_, i) => ({
      id: `phase-${i + 1}`,
      name: `مرحلة ${i + 1}`,
    }));

    render(
      <NextIntlClientProvider locale="ar" messages={messages} timeZone="Africa/Cairo">
        <QueryClientProvider client={queryClient}>
          {phases.map((p) => (
            <PhaseReportButton
              key={p.id}
              phase={p}
              projectId="proj-1"
              userId={USER_ID}
              active
            />
          ))}
        </QueryClientProvider>
      </NextIntlClientProvider>,
    );

    await waitFor(() => expect(listPhaseUpdates).toHaveBeenCalledTimes(15));
    // One per phase, each with its own key — no accidental duplication.
    expect(new Set(listPhaseUpdates.mock.calls.map((c) => c[0])).size).toBe(15);
  });

  it("issues ZERO requests when the tab is inactive", async () => {
    listPhaseUpdates.mockResolvedValue(page([]));
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <NextIntlClientProvider locale="ar" messages={messages} timeZone="Africa/Cairo">
        <QueryClientProvider client={queryClient}>
          <PhaseReportButton
            phase={PHASE}
            projectId="proj-1"
            userId={USER_ID}
            active={false}
          />
        </QueryClientProvider>
      </NextIntlClientProvider>,
    );

    await waitFor(() => expect(screen.getByRole("button")).toBeInTheDocument());
    expect(listPhaseUpdates).not.toHaveBeenCalled();
  });
});
