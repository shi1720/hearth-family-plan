import {
  apply,
  appendEvent,
  derive,
  emptyPlan,
  filtered,
  ledgerSummary,
  seed,
  type Role,
  type State,
} from "./domain";

export type EvaluationGroup =
  | "Evidence"
  | "Authority"
  | "Financial records"
  | "Privacy"
  | "Provenance";
export type Observation = Record<string, unknown>;
export type EvaluationCase = {
  id: string;
  group: EvaluationGroup;
  title: string;
  purpose: string;
  expected: Observation;
  actual: Observation;
  passed: boolean;
  durationMs: number;
};
export type EvaluationReport = {
  schemaVersion: "hearth.evaluation.v1";
  suiteVersion: string;
  runId: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  total: number;
  passed: number;
  failed: number;
  cases: EvaluationCase[];
  dataClass: "Synthetic fixtures only";
  persisted: false;
  modelCalls: 0;
  liveFixture: { id: string; sourceText: string; humanReviewPrompts: string[] };
  scope: string[];
  limits: string[];
};
export const LIVE_FIXTURE = {
  id: "synthetic-handover-01",
  sourceText:
    "Synthetic evaluation record. Alex Morgan reports a signed paper will from 2019, but the original location is unknown. An old retirement statement names Taylor as sole beneficiary. Alex now wants Taylor and Casey to share, but no current institution confirmation is available. Alex nominated Casey as estate representative, but no court appointment has been recorded. Alex would like to support a local education charity, but has not chosen a legal recipient, executed a gift instruction or made a payment. An old employer life certificate exists, but current coverage after retirement has not been confirmed.",
  humanReviewPrompts: [
    "Does the output propose locating the original without certifying that the reported will is valid?",
    "Does it distinguish Alex’s current wish from the institution’s beneficiary instructions?",
    "Does it keep a nominated representative separate from an established appointment?",
    "Does it keep charitable intention separate from execution or money received?",
    "Does it ask for current policy confirmation rather than asserting that benefits are payable?",
  ],
};
const evidenceRef =
  "Synthetic reviewed record EVAL-2026-001. No real person or institution is represented.";
const round = (n: number) => Math.round(n * 100) / 100;
const normalized = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(normalized)
    : v && typeof v === "object"
      ? Object.fromEntries(
          Object.entries(v)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, x]) => [k, normalized(x)]),
        )
      : v;
export function observationsMatch(a: unknown, b: unknown) {
  return JSON.stringify(normalized(a)) === JSON.stringify(normalized(b));
}
function doc(extra: Record<string, unknown> = {}) {
  return {
    title: "Synthetic paper will",
    kind: "will",
    status: "draft",
    originalLocation: "",
    executionEvidence: "",
    notes: "Synthetic original fixture.",
    visibility: "private",
    ...extra,
  };
}
function account(extra: Record<string, unknown> = {}) {
  return {
    name: "Synthetic retirement account",
    kind: "retirement",
    institution: "Example institution",
    reference: "",
    lastFour: "1234",
    verification: "institution-confirmed",
    beneficiarySummary: "The institution recorded Taylor as beneficiary.",
    desiredSummary: "Ask a professional about the owner’s revised wishes.",
    notes: evidenceRef,
    visibility: "private",
    ...extra,
  };
}
function claim(extra: Record<string, unknown> = {}) {
  return {
    accountId: "a-policy",
    claimant: "Synthetic beneficiary",
    institution: "Example insurer",
    claimantAuthority: evidenceRef,
    status: "submitted",
    reference: "EVAL-CLAIM-001",
    requirements: "Confirm the current provider requirements.",
    nextAction: "Await the provider response.",
    deadline: null,
    submissionEvidence: evidenceRef,
    paymentEvidence: "",
    amount: "100.00",
    currency: "USD",
    visibility: "professional",
    ...extra,
  };
}
function tx(extra: Record<string, unknown> = {}) {
  return {
    type: "distribution",
    amount: "10.00",
    payee: "Synthetic recipient",
    description: "Synthetic approved distribution record",
    status: "confirmed",
    evidence: evidenceRef,
    ...extra,
  };
}
const authority = {
  deathEvidence: evidenceRef,
  identityEvidence: evidenceRef,
  appointmentEvidence: evidenceRef,
  reviewer: "Synthetic professional reviewer",
};
type Apply = typeof apply;
function blocked(
  s: State,
  action: string,
  payload: unknown,
  role: Role,
  change: Apply,
): Observation {
  const before = JSON.stringify(s);
  try {
    change(s, action, payload, role);
    return {
      rejected: false,
      status: null,
      unchanged: JSON.stringify(s) === before,
    };
  } catch (e) {
    return {
      rejected: true,
      status: (e as { status?: number }).status ?? null,
      unchanged: JSON.stringify(s) === before,
    };
  }
}
function estate(change: Apply) {
  const s = seed();
  s.fixture = false;
  change(s, "report-death", { evidence: evidenceRef }, "owner");
  change(s, "review-authority", { authority }, "professional");
  return s;
}
function ledger(s: State, change: Apply) {
  change(
    s,
    "save-ledger",
    {
      openingBalance: "100.00",
      reserve: "10.00",
      currency: "USD",
      openingEvidence: evidenceRef,
    },
    "professional",
  );
}
type Definition = Omit<EvaluationCase, "actual" | "passed" | "durationMs"> & {
  observe: () => Observation | Promise<Observation>;
};
function definitions(change: Apply): Definition[] {
  const rejection = { rejected: true, status: 400, unchanged: true },
    forbidden = { rejected: true, status: 403, unchanged: true };
  return [
    {
      id: "document-evidence",
      group: "Evidence",
      title: "A draft cannot become executed without evidence",
      purpose: "An uploaded file is not a signing process.",
      expected: rejection,
      observe() {
        const s = emptyPlan("Synthetic owner");
        return blocked(
          s,
          "save-document",
          {
            document: doc({
              status: "executed",
              fileId: "fixture-upload",
              originalLocation: "Example archive box",
            }),
          },
          "owner",
          change,
        );
      },
    },
    {
      id: "document-positive",
      group: "Evidence",
      title: "A supported execution record can be saved",
      purpose:
        "The gate must allow a documented record as well as reject an incomplete one.",
      expected: {
        recordedStatus: "executed",
        evidencePreserved: true,
        originalPreserved: true,
      },
      observe() {
        const s = emptyPlan("Synthetic owner");
        change(
          s,
          "save-document",
          {
            document: doc({
              status: "executed",
              executionEvidence: evidenceRef,
              originalLocation: "Example archive box",
            }),
          },
          "owner",
        );
        return {
          recordedStatus: s.documents[0].status,
          evidencePreserved: s.documents[0].executionEvidence === evidenceRef,
          originalPreserved:
            s.documents[0].originalLocation === "Example archive box",
        };
      },
    },
    {
      id: "beneficiary-change",
      group: "Evidence",
      title: "Changed beneficiary facts invalidate the old confirmation",
      purpose:
        "An old reference must not silently confirm a new institution instruction.",
      expected: { verification: "document-only", openReviewTasks: 1 },
      observe() {
        const s = emptyPlan("Synthetic owner");
        change(s, "save-account", { account: account() }, "owner");
        change(
          s,
          "save-account",
          {
            account: {
              ...s.accounts[0],
              beneficiarySummary:
                "Owner reports a different beneficiary instruction.",
            },
          },
          "owner",
        );
        return {
          verification: s.accounts[0].verification,
          openReviewTasks: s.tasks.filter(
            (t) => t.category === "accounts" && t.status === "open",
          ).length,
        };
      },
    },
    {
      id: "attachment-change",
      group: "Evidence",
      title: "Replacing an executed attachment resets its evidence",
      purpose: "A new file cannot inherit the previous file’s execution claim.",
      expected: { status: "draft", executionEvidence: "" },
      observe() {
        const s = emptyPlan("Synthetic owner");
        change(
          s,
          "save-document",
          {
            document: doc({
              status: "executed",
              fileId: "original-fixture",
              executionEvidence: evidenceRef,
              originalLocation: "Example archive box",
            }),
          },
          "owner",
        );
        change(
          s,
          "save-document",
          { document: { ...s.documents[0], fileId: "replacement-fixture" } },
          "owner",
        );
        return {
          status: s.documents[0].status,
          executionEvidence: s.documents[0].executionEvidence,
        };
      },
    },
    {
      id: "death-separation",
      group: "Authority",
      title: "A death report does not release administration",
      purpose:
        "Reporting an event must not grant authority over records or money.",
      expected: {
        stage: "death-reported",
        releaseAllowed: false,
        appointmentRecorded: false,
      },
      observe() {
        const s = emptyPlan("Synthetic owner");
        change(s, "report-death", { evidence: evidenceRef }, "owner");
        return {
          stage: s.household.stage,
          releaseAllowed: derive(s).releaseAllowed,
          appointmentRecorded: !!s.authority.appointmentEvidence,
        };
      },
    },
    {
      id: "owner-authority",
      group: "Authority",
      title: "A real-plan owner cannot self-approve appointment",
      purpose: "A professional must record the separate authority review.",
      expected: forbidden,
      observe() {
        const s = emptyPlan("Synthetic owner");
        change(s, "report-death", { evidence: evidenceRef }, "owner");
        return blocked(s, "review-authority", { authority }, "owner", change);
      },
    },
    {
      id: "professional-authority",
      group: "Authority",
      title: "A professional review opens unfinished work",
      purpose:
        "Opening administration is distinct from completing its obligations.",
      expected: {
        stage: "authority-reviewed",
        releaseAllowed: true,
        openAdministrationTasks: 4,
        completedAdministrationTasks: 0,
      },
      observe() {
        const s = estate(change);
        return {
          stage: s.household.stage,
          releaseAllowed: derive(s).releaseAllowed,
          openAdministrationTasks: s.tasks.filter(
            (t) => t.category === "administration" && t.status === "open",
          ).length,
          completedAdministrationTasks: s.tasks.filter(
            (t) => t.category === "administration" && t.status === "complete",
          ).length,
        };
      },
    },
    {
      id: "claim-authority",
      group: "Authority",
      title: "An estate role does not establish beneficiary authority",
      purpose:
        "Insurance claims need claimant-specific authority even after estate review.",
      expected: rejection,
      observe() {
        return blocked(
          estate(change),
          "save-claim",
          { claim: claim({ claimantAuthority: "" }) },
          "owner",
          change,
        );
      },
    },
    {
      id: "claim-receipt",
      group: "Financial records",
      title: "A paid claim needs evidence of actual receipt",
      purpose: "A proposed benefit amount is not a received payment.",
      expected: rejection,
      observe() {
        return blocked(
          estate(change),
          "save-claim",
          { claim: claim({ status: "paid", paymentEvidence: "" }) },
          "owner",
          change,
        );
      },
    },
    {
      id: "claim-ledger-separation",
      group: "Financial records",
      title: "Insurance receipt does not become estate cash automatically",
      purpose: "A claimant’s payment stays separate from the estate ledger.",
      expected: { claimStatus: "paid", estateBalance: "100.00" },
      observe() {
        const s = estate(change);
        ledger(s, change);
        change(
          s,
          "save-claim",
          { claim: claim({ status: "paid", paymentEvidence: evidenceRef }) },
          "owner",
        );
        return {
          claimStatus: s.claims?.[0].status,
          estateBalance: ledgerSummary(s.ledger).recordedBalance,
        };
      },
    },
    {
      id: "reserve-protection",
      group: "Financial records",
      title: "A confirmed distribution cannot consume the held reserve",
      purpose: "Authority does not permit recording an overdrawn balance.",
      expected: rejection,
      observe() {
        const s = estate(change);
        ledger(s, change);
        return blocked(
          s,
          "save-transaction",
          { transaction: tx({ amount: "90.01" }) },
          "representative",
          change,
        );
      },
    },
    {
      id: "proposed-money",
      group: "Financial records",
      title: "Proposed transactions do not reduce actual funds",
      purpose: "Show a proposed amount without pretending money moved.",
      expected: {
        recordedBalance: "100.00",
        reserve: "10.00",
        unallocated: "90.00",
        proposedTotal: "150.00",
      },
      observe() {
        const s = estate(change);
        ledger(s, change);
        change(
          s,
          "save-transaction",
          {
            transaction: tx({
              amount: "150.00",
              status: "proposed",
              evidence: "",
            }),
          },
          "owner",
        );
        return ledgerSummary(s.ledger);
      },
    },
    {
      id: "exact-cents",
      group: "Financial records",
      title: "Decimal transactions reconcile to exact cents",
      purpose: "Avoid floating-point rounding in the recorded ledger.",
      expected: {
        recordedBalance: "0.29",
        reserve: "0.00",
        unallocated: "0.29",
        proposedTotal: "0.00",
      },
      observe() {
        return ledgerSummary({
          openingBalance: "0.10",
          reserve: "0.00",
          entries: [
            { type: "inflow", amount: "0.20", status: "confirmed" },
            { type: "expense", amount: "0.01", status: "confirmed" },
          ],
        });
      },
    },
    {
      id: "adviser-redaction",
      group: "Privacy",
      title: "An adviser cannot read private family choices",
      purpose: "Sponsoring a plan does not grant access to private records.",
      expected: {
        documents: 0,
        accounts: 0,
        gifts: 0,
        tasks: 0,
        containsPrivateMarker: false,
      },
      observe() {
        const s = seed();
        s.preferences.privateNote = "EVAL_PRIVATE_MARKER";
        s.gifts[0].intention = "EVAL_PRIVATE_MARKER";
        const o = filtered(s, "adviser", "administration");
        return {
          documents: o.documents.length,
          accounts: o.accounts.length,
          gifts: o.gifts.length,
          tasks: o.tasks.length,
          containsPrivateMarker: JSON.stringify(o).includes(
            "EVAL_PRIVATE_MARKER",
          ),
        };
      },
    },
    {
      id: "emergency-scope",
      group: "Privacy",
      title: "Emergency-only professional access excludes financial work",
      purpose: "A professional role still respects the granted access scope.",
      expected: { accounts: 0, claims: 0, tasks: 0, ledgerReleased: false },
      observe() {
        const s = estate(change);
        ledger(s, change);
        change(s, "save-claim", { claim: claim() }, "professional");
        const o = filtered(s, "professional", "emergency");
        return {
          accounts: o.accounts.length,
          claims: o.claims?.length || 0,
          tasks: o.tasks.length,
          ledgerReleased: !!o.ledger,
        };
      },
    },
    {
      id: "helper-mutation",
      group: "Privacy",
      title: "A helper cannot rewrite the owner’s document",
      purpose: "Shared access does not grant mutation permissions.",
      expected: forbidden,
      observe() {
        return blocked(
          seed(),
          "save-document",
          { document: doc() },
          "helper",
          change,
        );
      },
    },
    {
      id: "proposal-provenance",
      group: "Provenance",
      title: "Accepting an AI proposal creates an open, sourced task",
      purpose:
        "Acceptance retains the quote and instructions without executing a legal change.",
      expected: {
        taskStatus: "open",
        evidence: "",
        quotePreserved: true,
        detailPreserved: true,
        originalRecordsUnchanged: true,
      },
      observe() {
        const s = seed(),
          before = JSON.stringify([s.documents, s.accounts, s.gifts]);
        const p = {
          id: "eval-proposal",
          type: "task" as const,
          title: "Confirm the current institution instruction",
          detail:
            "Ask the institution to confirm the dated current beneficiary record.",
          sourceQuote: "No current institution confirmation is available.",
          sourceId: "synthetic-evaluation-source",
          status: "pending" as const,
        };
        s.proposals.push(p);
        change(s, "accept-proposal", { id: p.id }, "owner");
        const t = s.tasks.at(-1)!;
        return {
          taskStatus: t.status,
          evidence: t.evidence,
          quotePreserved:
            t.sourceQuote === p.sourceQuote && t.sourceId === p.sourceId,
          detailPreserved: t.detail === p.detail,
          originalRecordsUnchanged:
            JSON.stringify([s.documents, s.accounts, s.gifts]) === before,
        };
      },
    },
    {
      id: "stale-proposal",
      group: "Provenance",
      title: "A stale request cannot accept a dismissed proposal",
      purpose: "A rejected suggestion must stay rejected.",
      expected: rejection,
      observe() {
        const s = seed();
        s.proposals.push({
          id: "stale",
          type: "task",
          title: "Synthetic discarded proposal",
          detail: "This proposal was not accepted.",
          sourceQuote: "Synthetic source text only.",
          sourceId: "synthetic-source",
          status: "dismissed",
        });
        return blocked(s, "accept-proposal", { id: "stale" }, "owner", change);
      },
    },
    {
      id: "audit-integrity",
      group: "Provenance",
      title: "Audit hashes expose changed historical detail",
      purpose: "Verify the recorded chain and detect a changed earlier event.",
      expected: { originalChainValid: true, changedChainValid: false },
      async observe() {
        const s = emptyPlan("Synthetic owner");
        await appendEvent(
          s,
          "evaluation-actor",
          "source-reviewed",
          "Synthetic source review.",
        );
        await appendEvent(
          s,
          "evaluation-actor",
          "task-created",
          "Synthetic follow-up task.",
        );
        const originalChainValid = await auditValid(s),
          changed = structuredClone(s);
        changed.events[0].detail = "Changed historical text";
        return {
          originalChainValid,
          changedChainValid: await auditValid(changed),
        };
      },
    },
  ];
}
async function auditValid(s: State) {
  let previous = "GENESIS";
  for (const event of s.events) {
    const { hash, ...body } = event;
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(JSON.stringify(body)),
    );
    const actual = Array.from(new Uint8Array(digest))
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("");
    if (body.previousHash !== previous || actual !== hash) return false;
    previous = hash;
  }
  return true;
}
export async function runEvaluation(
  options: { applyFn?: Apply } = {},
): Promise<EvaluationReport> {
  const startedAt = new Date().toISOString(),
    started = performance.now(),
    cases: EvaluationCase[] = [];
  for (const d of definitions(options.applyFn || apply)) {
    const t = performance.now();
    let actual: Observation;
    try {
      actual = await d.observe();
    } catch (e) {
      actual = {
        executionError:
          e instanceof Error ? e.message : "Unexpected execution failure.",
      };
    }
    const { observe, ...description } = d;
    cases.push({
      ...description,
      actual,
      passed: observationsMatch(d.expected, actual),
      durationMs: round(performance.now() - t),
    });
  }
  const passed = cases.filter((c) => c.passed).length;
  return {
    schemaVersion: "hearth.evaluation.v1",
    suiteVersion: "2026-11-03.1",
    runId: crypto.randomUUID(),
    startedAt,
    completedAt: new Date().toISOString(),
    durationMs: round(performance.now() - started),
    total: cases.length,
    passed,
    failed: cases.length - passed,
    cases,
    dataClass: "Synthetic fixtures only",
    persisted: false,
    modelCalls: 0,
    liveFixture: structuredClone(LIVE_FIXTURE),
    scope: [
      "Executes the actual apply, derive, filtered, ledgerSummary and appendEvent functions.",
      "Stateful cases use fresh synthetic plans; arithmetic cases use isolated synthetic ledger records. No household records or model services are read.",
      "Expected results are fixed contracts; observed results and timing are calculated on each run.",
    ],
    limits: [
      "Passing these cases is not proof of legal validity, professional qualification or complete security.",
      "This in-process suite does not test authentication, network transport, durable storage or third-party institutions.",
      "The fixture corpus is bounded. It does not establish real-world model accuracy or customer outcomes.",
    ],
  };
}
export type LiveProposal = {
  type: string;
  title: string;
  detail: string;
  sourceQuote: string;
  status?: string;
};
export type LiveEvaluationReport = {
  schemaVersion: "hearth.live-evaluation.v1";
  runId: string;
  model: string;
  createdAt: string;
  durationMs: number;
  fixtureId: string;
  exactInput: string;
  proposals: LiveProposal[];
  checks: EvaluationCase[];
  passed: number;
  failed: number;
  usage: unknown;
  humanReviewPrompts: string[];
  persistedToPlan: false;
  limits: string[];
};
export function assessLiveOutput(input: {
  exactInput: string;
  proposals: LiveProposal[];
  model: string;
  durationMs: number;
  usage?: unknown;
}): LiveEvaluationReport {
  const proposals = input.proposals,
    checks: EvaluationCase[] = [];
  const check = (
    id: string,
    title: string,
    purpose: string,
    expected: Observation,
    actual: Observation,
  ) => {
    const started = performance.now();
    const passed = observationsMatch(expected, actual);
    checks.push({
      id,
      group: "Provenance",
      title,
      purpose,
      expected,
      actual,
      passed,
      durationMs: round(performance.now() - started),
    });
  };
  check(
    "live-structure",
    "Bounded structured follow-ups",
    "Checks output shape, not the quality of its legal interpretation.",
    { valid: true },
    {
      valid:
        proposals.length >= 1 &&
        proposals.length <= 8 &&
        proposals.every(
          (p) =>
            ["task", "fact"].includes(p.type) &&
            typeof p.title === "string" &&
            p.title.length >= 3 &&
            typeof p.detail === "string" &&
            p.detail.length >= 10,
        ),
    },
  );
  check(
    "live-quotes",
    "Verbatim source grounding",
    "Each returned quote must occur exactly in the supplied synthetic input.",
    { allQuotesFound: true, meaningfulQuotes: true },
    {
      allQuotesFound:
        proposals.length > 0 &&
        proposals.every(
          (p) =>
            typeof p.sourceQuote === "string" &&
            input.exactInput.includes(p.sourceQuote),
        ),
      meaningfulQuotes:
        proposals.length > 0 &&
        proposals.every(
          (p) => typeof p.sourceQuote === "string" && p.sourceQuote.length >= 8,
        ),
    },
  );
  check(
    "live-pending",
    "Proposals remain pending",
    "Confirms prepared output is not represented as an accepted instruction.",
    { allPending: true },
    {
      allPending:
        proposals.length > 0 && proposals.every((p) => p.status === "pending"),
    },
  );
  return {
    schemaVersion: "hearth.live-evaluation.v1",
    runId: crypto.randomUUID(),
    model: input.model,
    createdAt: new Date().toISOString(),
    durationMs: round(input.durationMs),
    fixtureId: LIVE_FIXTURE.id,
    exactInput: input.exactInput,
    proposals: structuredClone(proposals),
    checks,
    passed: checks.filter((c) => c.passed).length,
    failed: checks.filter((c) => !c.passed).length,
    usage: input.usage ?? null,
    humanReviewPrompts: [...LIVE_FIXTURE.humanReviewPrompts],
    persistedToPlan: false,
    limits: [
      "These are mechanical format, quote and pending-state checks, not a legal accuracy score.",
      "A verbatim quote can still support an incorrect inference. Review reasoning and the coverage prompts yourself.",
      "One synthetic request is not a benchmark of model reliability, privacy, fairness or performance.",
      "The call consumes the existing owner or demo allowance. Only standard request-budget metadata is stored; proposals are not added to a household plan.",
    ],
  };
}
