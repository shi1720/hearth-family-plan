import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  seed,
  emptyPlan,
  apply,
  derive,
  filtered,
  appendEvent,
  personSchema,
  documentSchema,
  accountSchema,
  giftSchema,
  taskSchema,
  claimSchema,
  transactionSchema,
  ledgerSummary,
  cents,
} from "../lib/domain";
import type { State, Role } from "../lib/domain";

const signedEvidence =
  "Signed paper original reviewed with the drafting professional on 2026-11-03.";
const reference =
  "Institution confirmation reference REF-2026-118, received 2026-11-03.";
const document = (overrides: Record<string, unknown> = {}) => ({
  title: "Existing paper will",
  kind: "will",
  status: "draft",
  originalLocation: "",
  executionEvidence: "",
  notes: "A draft uploaded for review only.",
  visibility: "private",
  ...overrides,
});
const account = (overrides: Record<string, unknown> = {}) => ({
  name: "Retirement plan",
  kind: "retirement",
  institution: "Example institution",
  reference: "",
  lastFour: "1122",
  verification: "document-only",
  beneficiarySummary: "Old record names one child.",
  desiredSummary:
    "Owner wants professional review of the beneficiary instruction.",
  notes: "",
  visibility: "private",
  ...overrides,
});
const gift = (overrides: Record<string, unknown> = {}) => ({
  recipient: "Example education charity",
  registrationId: "",
  url: "https://example.org/",
  cause: "Education",
  intention: "I may leave a gift after discussing my family needs.",
  route: "undecided",
  status: "intention",
  evidence: "",
  visibility: "private",
  ...overrides,
});
const person = (overrides: Record<string, unknown> = {}) => ({
  name: "Trusted Helper",
  email: "",
  role: "helper",
  status: "proposed",
  access: "emergency",
  note: "",
  ...overrides,
});
const task = (overrides: Record<string, unknown> = {}) => ({
  title: "Locate an existing original document",
  category: "documents",
  owner: "Plan owner",
  status: "open",
  evidence: "",
  dueAt: null,
  ...overrides,
});
const authority = (overrides: Record<string, unknown> = {}) => ({
  deathEvidence: "Certified death record reference DR-2026-101 reviewed.",
  identityEvidence:
    "Reviewer recorded identity evidence reference ID-2026-102.",
  appointmentEvidence:
    "Professional recorded appointment order reference AP-2026-103.",
  reviewer: "Independent estate professional",
  ...overrides,
});
const throwsWithoutMutation = (
  s: State,
  action: string,
  payload: unknown,
  role: Role,
  pattern?: RegExp,
) => {
  const before = structuredClone(s);
  const attempt = () => apply(s, action, payload, role);
  if (pattern) assert.throws(attempt, pattern);
  else assert.throws(attempt);
  assert.deepEqual(
    s,
    before,
    "rejected action must not partially mutate the plan",
  );
};
const reportedPlan = () => {
  const s = emptyPlan("Sam");
  apply(
    s,
    "report-death",
    { evidence: "Reported death record reference REPORT-2026-101." },
    "owner",
  );
  return s;
};

// These tests exercise legal/operational boundaries; they do not establish legal validity.
test("a new plan starts without fabricated appointments, executions, confirmations or receipts", () => {
  const s = emptyPlan("Sam");
  assert.equal(s.fixture, false);
  assert.equal(s.household.stage, "living");
  assert.deepEqual(derive(s).readiness, {
    people: 0,
    documents: 0,
    accounts: 0,
    giving: 0,
  });
  assert.equal(derive(s).releaseAllowed, false);
  assert.equal(s.authority.reviewedAt, null);
  const bereaved = emptyPlan("Sam", "bereaved");
  assert.equal(bereaved.household.stage, "death-reported");
  assert.equal(
    derive(bereaved).releaseAllowed,
    false,
    "selecting bereavement must not establish authority",
  );
});

test("sample data remains a fictional scenario with unresolved institution and giving status", () => {
  const s = seed();
  assert.equal(s.fixture, true);
  assert.equal(s.household.stage, "living");
  assert.equal(derive(s).readiness.accounts, 0);
  assert.equal(derive(s).readiness.giving, 0);
  assert.ok(
    s.accounts.every((item) => item.verification !== "institution-confirmed"),
  );
  assert.ok(derive(s).nextSteps.some((item) => item.id === "original"));
});

test("uploading a draft cannot execute a will without execution evidence and original location", () => {
  const s = emptyPlan("Sam");
  apply(
    s,
    "save-document",
    { document: document({ fileId: "uploaded-copy-001" }) },
    "owner",
  );
  const saved = s.documents[0];
  assert.equal(saved.status, "draft");
  assert.equal(derive(s).readiness.documents, 0);
  throwsWithoutMutation(
    s,
    "save-document",
    { document: { ...saved, status: "executed" } },
    "owner",
    /execution evidence|execute/i,
  );
  throwsWithoutMutation(
    s,
    "save-document",
    {
      document: {
        ...saved,
        status: "executed",
        executionEvidence: signedEvidence,
      },
    },
    "owner",
    /original|executed record/i,
  );
  apply(
    s,
    "save-document",
    {
      document: {
        ...saved,
        status: "executed",
        executionEvidence: signedEvidence,
        originalLocation: "Drafting lawyer, archive box 4",
      },
    },
    "owner",
  );
  assert.equal(s.documents[0].status, "executed");
  assert.equal(derive(s).readiness.documents, 1);
});

test("institution confirmation requires a meaningful reference and preserves the separate desired instruction", () => {
  const s = emptyPlan("Sam");
  apply(s, "save-account", { account: account() }, "owner");
  const saved = s.accounts[0];
  throwsWithoutMutation(
    s,
    "save-account",
    { account: { ...saved, verification: "institution-confirmed", notes: "" } },
    "owner",
    /confirmation reference/i,
  );
  assert.equal(derive(s).readiness.accounts, 0);
  apply(
    s,
    "save-account",
    {
      account: {
        ...saved,
        verification: "institution-confirmed",
        notes: reference,
      },
    },
    "owner",
  );
  assert.equal(derive(s).readiness.accounts, 1);
  assert.equal(
    s.accounts[0].desiredSummary,
    saved.desiredSummary,
    "confirmation must not implement the owner’s wishes automatically",
  );
});

test("a saved charitable intention is not counted as a completed donation", () => {
  const s = emptyPlan("Sam");
  apply(s, "save-gift", { gift: gift() }, "owner");
  assert.equal(derive(s).readiness.giving, 0);
  const saved = s.gifts[0];
  throwsWithoutMutation(
    s,
    "save-gift",
    { gift: { ...saved, status: "received" } },
    "owner",
    /receipt|evidence|intention/i,
  );
  throwsWithoutMutation(
    s,
    "save-gift",
    { gift: { ...saved, status: "executed", evidence: signedEvidence } },
    "owner",
    /route/i,
  );
  apply(
    s,
    "save-gift",
    {
      gift: {
        ...saved,
        route: "will",
        status: "executed",
        evidence: signedEvidence,
      },
    },
    "owner",
  );
  assert.equal(
    derive(s).readiness.giving,
    0,
    "even an executed instruction is not money received",
  );
  apply(
    s,
    "save-gift",
    {
      gift: {
        ...s.gifts[0],
        status: "received",
        evidence:
          "Recipient receipt REC-2026-104 confirms an authorised gift was received.",
      },
    },
    "owner",
  );
  assert.equal(derive(s).readiness.giving, 1);
});

test("a received gift must have a chosen implemented route, not an undecided intention", () => {
  const result = giftSchema.safeParse(
    gift({
      status: "received",
      route: "undecided",
      evidence:
        "Receipt reference REC-2026-104, reviewed by the authorised payer.",
    }),
  );
  assert.equal(
    result.success,
    false,
    "a received gift with no chosen route is an inconsistent operational state",
  );
});

test("ordinary task completion needs evidence and administration cannot complete before authority review", () => {
  const s = emptyPlan("Sam");
  throwsWithoutMutation(
    s,
    "save-task",
    { task: task({ status: "complete" }) },
    "owner",
    /evidence/i,
  );
  throwsWithoutMutation(
    s,
    "save-task",
    {
      task: task({
        category: "administration",
        status: "complete",
        evidence: reference,
      }),
    },
    "owner",
    /authority review/i,
  );
  apply(
    s,
    "save-task",
    {
      task: task({
        status: "complete",
        evidence:
          "Original located in the lawyer’s records; reference ORIGINAL-001.",
      }),
    },
    "owner",
  );
  assert.equal(s.tasks[0].status, "complete");
});

test("a death report changes the queue but never grants authority or distribution access", () => {
  const s = seed();
  const peopleBefore = structuredClone(s.people);
  apply(
    s,
    "report-death",
    {
      evidence:
        "Fictional death report supplied for a guided scenario exercise.",
    },
    "owner",
  );
  assert.equal(s.household.stage, "death-reported");
  assert.equal(derive(s).releaseAllowed, false);
  assert.equal(s.authority.reviewedAt, null);
  assert.equal(s.authority.appointmentEvidence, "");
  assert.deepEqual(
    s.people,
    peopleBefore,
    "a nominated representative must not silently become appointed",
  );
  assert.equal(derive(s).nextSteps[0].id, "authority");
  throwsWithoutMutation(
    s,
    "record-administration",
    { taskId: "any", evidence: reference },
    "owner",
    /authority review/i,
  );
  throwsWithoutMutation(
    s,
    "report-death",
    { evidence: reference },
    "owner",
    /already recorded/i,
  );
});

test("an owner cannot self-approve authority for a real plan", () => {
  const s = reportedPlan();
  throwsWithoutMutation(
    s,
    "review-authority",
    { authority: authority() },
    "owner",
    /role|permit/i,
  );
  assert.equal(derive(s).releaseAllowed, false);
});

test("professional authority review requires death, identity and appointment evidence separately", () => {
  for (const key of [
    "deathEvidence",
    "identityEvidence",
    "appointmentEvidence",
  ] as const) {
    const s = reportedPlan();
    throwsWithoutMutation(
      s,
      "review-authority",
      { authority: authority({ [key]: "" }) },
      "professional",
      /evidence reference/i,
    );
  }
  const living = emptyPlan("Sam");
  throwsWithoutMutation(
    living,
    "review-authority",
    { authority: authority() },
    "professional",
    /death report/i,
  );
});

test("a professional can record authority and open unfinished administration work", () => {
  const s = reportedPlan();
  apply(s, "review-authority", { authority: authority() }, "professional");
  assert.equal(s.household.stage, "authority-reviewed");
  assert.equal(derive(s).releaseAllowed, true);
  assert.ok(s.authority.reviewedAt);
  assert.ok(s.tasks.length >= 4);
  assert.ok(
    s.tasks.every(
      (item) => item.category === "administration" && item.status === "open",
    ),
  );
  const first = s.tasks[0];
  throwsWithoutMutation(
    s,
    "record-administration",
    { taskId: first.id, evidence: "" },
    "professional",
    /evidence reference/i,
  );
  apply(
    s,
    "record-administration",
    {
      taskId: first.id,
      evidence:
        "Professional completion reference ADMIN-001 and institution acknowledgement.",
    },
    "professional",
  );
  assert.equal(s.tasks[0].status, "complete");
  assert.ok(
    s.tasks.slice(1).every((item) => item.status === "open"),
    "one completed action does not close the estate",
  );
});

test("read-only collaborators cannot mutate documents, accounts, preferences or authority", () => {
  for (const role of ["helper", "adviser", "representative"] as Role[]) {
    for (const [action, payload] of [
      ["save-document", { document: document() }],
      ["save-account", { account: account() }],
      [
        "save-preferences",
        { preferences: { contactFrequency: "Weekly", privateNote: "private" } },
      ],
      ["report-death", { evidence: reference }],
    ] as const)
      throwsWithoutMutation(seed(), action, payload, role, /role|permit/i);
  }
});

test("a new helper cannot be created as already accepted without acknowledgement", () => {
  const s = emptyPlan("Sam");
  throwsWithoutMutation(
    s,
    "save-person",
    { person: person({ status: "accepted" }) },
    "owner",
    /proposed|acknowledgement/i,
  );
  apply(s, "save-person", { person: person() }, "owner");
  const saved = s.people[0];
  throwsWithoutMutation(
    s,
    "accept-person",
    { id: saved.id, evidence: "" },
    "owner",
    /evidence reference/i,
  );
  apply(
    s,
    "accept-person",
    {
      id: saved.id,
      evidence: "Helper acknowledgement recorded by owner on 2026-11-03.",
    },
    "owner",
  );
  assert.equal(s.people[0].status, "accepted");
});

test("editing a proposed helper cannot bypass the separate acknowledgement step", () => {
  const s = emptyPlan("Sam");
  apply(s, "save-person", { person: person() }, "owner");
  throwsWithoutMutation(
    s,
    "save-person",
    { person: { ...s.people[0], status: "accepted", note: "" } },
    "owner",
    /acknowledgement|evidence|accept/i,
  );
});

test("an adviser receives no private documents, accounts, gifts, wishes, source text or audit details", async () => {
  const s = seed();
  s.preferences.privateNote = "PRIVATE_OWNER_NOTE_SENTINEL";
  s.documents.find((item) => item.visibility === "private")!.notes =
    "PRIVATE_LETTER_SENTINEL";
  s.accounts.find((item) => item.visibility === "private")!.reference =
    "PRIVATE_ACCOUNT_SENTINEL";
  s.gifts[0].intention = "PRIVATE_GIVING_SENTINEL";
  s.authority.identityEvidence = "PRIVATE_IDENTITY_SENTINEL";
  await appendEvent(
    s,
    "PRIVATE_ACTOR_SENTINEL",
    "save-private-document",
    "PRIVATE_AUDIT_DETAIL_SENTINEL",
  );
  const out = filtered(s, "adviser", "administration");
  assert.deepEqual(out.documents, []);
  assert.deepEqual(out.accounts, []);
  assert.deepEqual(out.gifts, []);
  assert.deepEqual(out.people, []);
  assert.deepEqual(out.tasks, []);
  assert.deepEqual(out.proposals, []);
  assert.equal(out.preferences.privateNote, "");
  assert.doesNotMatch(JSON.stringify(out), /PRIVATE_[A-Z_]+_SENTINEL/);
});

test("emergency helper access provides care notes without financial records or document source text", () => {
  const s = seed();
  s.documents.find((item) => item.kind === "care")!.sourceText =
    "FULL_SOURCE_TEXT_SENTINEL";
  const out = filtered(s, "helper", "emergency");
  assert.ok(out.documents.length > 0);
  assert.ok(
    out.documents.every(
      (item) => item.kind === "care" && item.visibility === "helper",
    ),
  );
  assert.deepEqual(out.accounts, []);
  assert.deepEqual(out.gifts, []);
  assert.deepEqual(out.tasks, []);
  assert.doesNotMatch(JSON.stringify(out), /FULL_SOURCE_TEXT_SENTINEL/);
  assert.ok(out.people.every((item) => !item.email && !item.note));
});

test("reporting a death temporarily restricts non-emergency helper records even with document access", () => {
  const s = seed();
  s.documents.push({
    ...document({ title: "Helper-shared instructions", visibility: "helper" }),
    id: "shared-other",
    kind: "other",
    status: "draft",
  } as any);
  assert.ok(
    filtered(s, "helper", "documents").accounts.length > 0,
    "living helper can see specifically shared records",
  );
  apply(
    s,
    "report-death",
    {
      evidence: "Fictional death report for a permissions demonstration only.",
    },
    "owner",
  );
  const out = filtered(s, "helper", "documents");
  assert.deepEqual(out.accounts, []);
  assert.deepEqual(out.gifts, []);
  assert.ok(out.documents.every((item) => item.kind === "care"));
});

test("professional access is limited to professional records, not the owner’s private wishes", () => {
  const s = seed();
  const out = filtered(s, "professional", "documents");
  assert.ok(out.documents.length > 0);
  assert.ok(out.documents.every((item) => item.visibility === "professional"));
  assert.ok(out.accounts.every((item) => item.visibility === "professional"));
  assert.ok(out.gifts.every((item) => item.visibility === "professional"));
  assert.equal(out.preferences.privateNote, "");
});

test("permission-filtered views are independent copies and cannot change the original plan", () => {
  const s = seed();
  const before = structuredClone(s);
  const owner = filtered(s, "owner");
  owner.documents[0].notes = "changed outside the domain";
  owner.people.splice(0);
  const helper = filtered(s, "helper", "emergency");
  helper.household.name = "changed household label";
  assert.deepEqual(s, before);
});

test("pending AI proposals are not binding facts, executed documents, institution instructions or gifts", () => {
  const s = seed();
  const originalDocuments = structuredClone(s.documents);
  const originalAccounts = structuredClone(s.accounts);
  const originalGifts = structuredClone(s.gifts);
  const beforeReadiness = derive(s).readiness;
  s.proposals.push({
    id: "ai-1",
    type: "fact",
    title: "Ask counsel to review the reported beneficiary mismatch",
    detail: "Draft interpretation, not a legal decision.",
    sourceQuote: "An old statement names Elena.",
    sourceId: "uploaded-text",
    status: "pending",
  });
  assert.deepEqual(derive(s).readiness, beforeReadiness);
  const tasksBefore = s.tasks.length;
  apply(s, "accept-proposal", { id: "ai-1" }, "owner");
  assert.equal(s.tasks.length, tasksBefore + 1);
  const acceptedTask = s.tasks.at(-1)!;
  assert.equal(acceptedTask.status, "open");
  assert.equal(acceptedTask.evidence, "");
  assert.equal(acceptedTask.sourceId, "uploaded-text");
  assert.equal(acceptedTask.detail, s.proposals[0].detail);
  assert.equal(acceptedTask.sourceQuote, s.proposals[0].sourceQuote);
  assert.equal(s.proposals[0].status, "accepted");
  assert.deepEqual(s.documents, originalDocuments);
  assert.deepEqual(s.accounts, originalAccounts);
  assert.deepEqual(s.gifts, originalGifts);
  assert.deepEqual(derive(s).readiness, beforeReadiness);
  throwsWithoutMutation(
    s,
    "accept-proposal",
    { id: "ai-1" },
    "owner",
    /Pending proposal/i,
  );
});

test("dismissing an AI proposal creates no task and collaborators cannot accept it", () => {
  const s = seed();
  s.proposals.push({
    id: "ai-2",
    type: "task",
    title: "Unconfirmed proposed follow-up",
    detail: "For review.",
    sourceQuote: "A source excerpt.",
    sourceId: "uploaded-text",
    status: "pending",
  });
  throwsWithoutMutation(
    s,
    "accept-proposal",
    { id: "ai-2" },
    "helper",
    /role|permit/i,
  );
  const count = s.tasks.length;
  apply(s, "dismiss-proposal", { id: "ai-2" }, "owner");
  assert.equal(s.tasks.length, count);
  assert.equal(s.proposals[0].status, "dismissed");
});

test("changing household mode preserves the authority stage rather than manufacturing approval", () => {
  const s = seed();
  apply(
    s,
    "save-household",
    { household: { ...s.household, mode: "bereaved", name: "Updated plan" } },
    "owner",
  );
  assert.equal(s.household.stage, "living");
  assert.equal(derive(s).releaseAllowed, false);
});

test("schemas reject unsupported disclosure and completion inputs", () => {
  assert.equal(
    personSchema.safeParse(person({ email: "not an email" })).success,
    false,
  );
  assert.equal(
    documentSchema.safeParse(document({ visibility: "public" })).success,
    false,
  );
  assert.equal(
    accountSchema.safeParse(account({ lastFour: "123456789" })).success,
    false,
  );
  assert.equal(
    giftSchema.safeParse(gift({ url: "javascript:alert(1)" })).success,
    false,
  );
  assert.equal(
    giftSchema.safeParse(gift({ url: "http://example.org" })).success,
    false,
  );
  assert.equal(
    taskSchema.safeParse(task({ status: "complete", evidence: "done" }))
      .success,
    false,
  );
});

function validAuditChain(s: State) {
  let expectedPrevious = "GENESIS";
  for (const event of s.events) {
    const { hash, ...body } = event;
    if (body.previousHash !== expectedPrevious) return false;
    if (
      createHash("sha256").update(JSON.stringify(body)).digest("hex") !== hash
    )
      return false;
    expectedPrevious = hash;
  }
  return true;
}

test("audit events form a verifiable SHA-256 chain and tampering breaks verification", async () => {
  const s = emptyPlan("Sam");
  await appendEvent(s, "owner-1", "save-document", "Recorded a draft only.");
  await appendEvent(
    s,
    "professional-1",
    "review-authority",
    "Recorded a reviewed appointment reference.",
  );
  await appendEvent(
    s,
    "owner-1",
    "record-administration",
    "Recorded one accepted institution request.",
  );
  assert.equal(s.events.length, 3);
  assert.equal(s.events[0].previousHash, "GENESIS");
  assert.equal(s.events[1].previousHash, s.events[0].hash);
  assert.equal(s.events[2].previousHash, s.events[1].hash);
  assert.equal(validAuditChain(s), true);
  const changed = structuredClone(s);
  changed.events[0].detail = "Tampered execution claim.";
  assert.equal(validAuditChain(changed), false);
  const omitted = structuredClone(s);
  omitted.events.splice(1, 1);
  assert.equal(validAuditChain(omitted), false);
  assert.deepEqual(
    s.events.map((item) => item.action),
    ["save-document", "review-authority", "record-administration"],
  );
});

test("a representative can record only reviewed administration work, not rewrite the private plan", () => {
  const s = seed();
  s.fixture = false;
  apply(
    s,
    "report-death",
    {
      evidence:
        "Death record reference DR-2026-201 recorded for this scenario.",
    },
    "owner",
  );
  throwsWithoutMutation(
    s,
    "record-administration",
    { taskId: "t-original", evidence: reference },
    "representative",
    /authority review/i,
  );
  apply(s, "review-authority", { authority: authority() }, "professional");
  const adminTask = s.tasks.find((item) => item.category === "administration")!;
  apply(
    s,
    "record-administration",
    {
      taskId: adminTask.id,
      evidence:
        "Court and institution response recorded, reference ADMIN-REP-001.",
    },
    "representative",
  );
  assert.equal(
    s.tasks.find((item) => item.id === adminTask.id)!.status,
    "complete",
  );
  throwsWithoutMutation(
    s,
    "record-administration",
    { taskId: "t-original", evidence: reference },
    "representative",
    /Administration task not found/i,
  );
  throwsWithoutMutation(
    s,
    "save-task",
    {
      task: task({
        category: "administration",
        evidence: reference,
        status: "complete",
      }),
    },
    "representative",
    /role|permit/i,
  );
  throwsWithoutMutation(
    s,
    "save-gift",
    { gift: gift() },
    "representative",
    /role|permit/i,
  );
  const out = filtered(s, "representative", "administration");
  assert.ok(out.documents.every((item) => item.visibility === "helper"));
  assert.ok(out.accounts.every((item) => item.visibility === "helper"));
  assert.ok(out.gifts.every((item) => item.visibility === "helper"));
  assert.ok(out.tasks.length > 0);
  assert.ok(out.tasks.every((item) => item.category === "administration"));
  assert.equal(out.preferences.privateNote, "");
  assert.equal(out.authority.identityEvidence, "Restricted");
});

test("a dismissed proposal cannot be accepted later by a stale client request", () => {
  const s = seed();
  s.proposals.push({
    id: "stale-proposal",
    type: "task",
    title: "A proposed follow-up awaiting consent",
    detail: "Not an accepted instruction.",
    sourceQuote: "Owner has not decided.",
    sourceId: "uploaded-text",
    status: "pending",
  });
  apply(s, "dismiss-proposal", { id: "stale-proposal" }, "owner");
  const count = s.tasks.length;
  throwsWithoutMutation(
    s,
    "accept-proposal",
    { id: "stale-proposal" },
    "owner",
    /Pending proposal/i,
  );
  assert.equal(s.tasks.length, count);
});

test("changing the institution or account identifier invalidates old confirmation and creates a review task", () => {
  for (const change of [
    { institution: "New receiving institution" },
    { lastFour: "3344" },
  ]) {
    const s = emptyPlan("Sam");
    apply(
      s,
      "save-account",
      {
        account: account({
          verification: "institution-confirmed",
          notes: reference,
        }),
      },
      "owner",
    );
    assert.equal(derive(s).readiness.accounts, 1);
    const original = structuredClone(s.accounts[0]);
    const tasksBefore = s.tasks.length;
    apply(s, "save-account", { account: { ...original, ...change } }, "owner");
    assert.equal(
      s.accounts.length,
      1,
      "the changed record is an update, not another account",
    );
    assert.equal(
      s.accounts[0].verification,
      "document-only",
      "confirmation of the old account must not follow a changed identity",
    );
    assert.equal(derive(s).readiness.accounts, 0);
    assert.equal(s.tasks.length, tasksBefore + 1);
    const followUp = s.tasks.at(-1)!;
    assert.equal(followUp.category, "accounts");
    assert.equal(followUp.status, "open");
    assert.equal(followUp.evidence, "");
    assert.match(followUp.title, /reconfirm.*ownership.*beneficiary/i);
    assert.equal(
      s.accounts[0].beneficiarySummary,
      original.beneficiarySummary,
      "a review task must not silently change recorded beneficiaries",
    );
    assert.equal(s.accounts[0].desiredSummary, original.desiredSummary);
  }
});

const claim = (overrides: Record<string, unknown> = {}) => ({
  accountId: "a-policy",
  claimant: "Named policy beneficiary",
  institution: "Fictional Acorn Employer",
  claimantAuthority: "",
  status: "preparing",
  reference: "",
  requirements: "Confirm current insurer-specific requirements.",
  nextAction: "Obtain claimant authority and the insurer’s claim form.",
  deadline: null,
  submissionEvidence: "",
  paymentEvidence: "",
  amount: "0.00",
  currency: "USD",
  visibility: "professional",
  ...overrides,
});
const transaction = (overrides: Record<string, unknown> = {}) => ({
  type: "expense",
  amount: "10.00",
  payee: "Example provider",
  description: "Approved administrative invoice",
  status: "proposed",
  evidence: "",
  ...overrides,
});
const reviewedEstate = () => {
  const s = seed();
  s.fixture = false;
  apply(
    s,
    "report-death",
    {
      evidence:
        "Death record reference DR-2026-301, recorded for a test scenario.",
    },
    "owner",
  );
  apply(s, "review-authority", { authority: authority() }, "professional");
  return s;
};
const openingLedger = (
  s: State,
  openingBalance = "100.00",
  reserve = "10.00",
) =>
  apply(
    s,
    "save-ledger",
    {
      openingBalance,
      reserve,
      currency: "USD",
      openingEvidence:
        "Estate account opening statement OPEN-2026-301, reviewed by a professional.",
    },
    "professional",
  );

test("probate appointment and a nominated role do not substitute for an insurance claimant’s separate authority", () => {
  const s = reviewedEstate();
  const submitted = claim({
    status: "submitted",
    submissionEvidence:
      "Insurer acknowledgement SUB-2026-301, received by the claimant.",
  });
  throwsWithoutMutation(
    s,
    "save-claim",
    { claim: submitted },
    "owner",
    /claimant.*authority/i,
  );
  throwsWithoutMutation(
    s,
    "save-claim",
    { claim: submitted },
    "professional",
    /claimant.*authority/i,
  );
  assert.equal(s.claims?.length || 0, 0);
  apply(
    s,
    "save-claim",
    {
      claim: {
        ...submitted,
        claimantAuthority:
          "Insurer-confirmed adult beneficiary authority AUTH-2026-301.",
      },
    },
    "owner",
  );
  assert.equal(s.claims?.[0].status, "submitted");
});

test("insurance claims can follow their own beneficiary route after a death report without granting estate authority", () => {
  const s = seed();
  apply(
    s,
    "report-death",
    {
      evidence:
        "Death record reference DR-2026-302, reported for a test scenario.",
    },
    "owner",
  );
  assert.equal(derive(s).releaseAllowed, false);
  apply(
    s,
    "save-claim",
    {
      claim: claim({
        status: "submitted",
        claimantAuthority: "Insurer accepted claimant authority AUTH-2026-302.",
        submissionEvidence: "Provider submission acknowledgement SUB-2026-302.",
      }),
    },
    "owner",
  );
  assert.equal(s.claims?.[0].status, "submitted");
  assert.equal(
    s.household.stage,
    "death-reported",
    "submitting a separate insurance claim does not establish estate authority",
  );
  assert.equal(derive(s).releaseAllowed, false);
});

test("an insurance claim submission requires evidence of actual submission and an insurance-policy record", () => {
  const s = seed();
  apply(
    s,
    "report-death",
    {
      evidence:
        "Death record reference DR-2026-303, reported for a test scenario.",
    },
    "owner",
  );
  throwsWithoutMutation(
    s,
    "save-claim",
    {
      claim: claim({
        status: "submitted",
        claimantAuthority: reference,
        submissionEvidence: "",
      }),
    },
    "owner",
    /submission evidence|case reference/i,
  );
  throwsWithoutMutation(
    s,
    "save-claim",
    { claim: claim({ accountId: "a-bank" }) },
    "owner",
    /insurance policy/i,
  );
  throwsWithoutMutation(
    s,
    "save-claim",
    { claim: claim({ accountId: "not-in-this-plan" }) },
    "owner",
    /insurance policy/i,
  );
  assert.equal(
    claimSchema.safeParse(
      claim({
        status: "submitted",
        claimantAuthority: reference,
        submissionEvidence: "done",
      }),
    ).success,
    false,
  );
});

test("paid insurance status requires both a positive USD amount and a payment receipt", () => {
  const base = claim({
    status: "paid",
    claimantAuthority: reference,
    submissionEvidence: reference,
  });
  assert.equal(
    claimSchema.safeParse({ ...base, amount: "500.00", paymentEvidence: "" })
      .success,
    false,
  );
  assert.equal(
    claimSchema.safeParse({
      ...base,
      amount: "0.00",
      paymentEvidence: reference,
    }).success,
    false,
  );
  assert.equal(
    claimSchema.safeParse({
      ...base,
      amount: "-1.00",
      paymentEvidence: reference,
    }).success,
    false,
  );
  assert.equal(
    claimSchema.safeParse({
      ...base,
      amount: "500.001",
      paymentEvidence: reference,
    }).success,
    false,
  );
  assert.equal(
    claimSchema.safeParse({
      ...base,
      amount: "500.00",
      paymentEvidence:
        "Insurer payment receipt PAY-2026-301 and recipient confirmation.",
    }).success,
    true,
  );
});

test("living plans allow preparation but reject recorded after-death claim progress", () => {
  const s = seed();
  apply(s, "save-claim", { claim: claim() }, "owner");
  const draft = s.claims![0];
  assert.equal(draft.status, "preparing");
  for (const status of [
    "submitted",
    "information-requested",
    "approved",
    "paid",
    "disputed",
  ]) {
    throwsWithoutMutation(
      s,
      "save-claim",
      {
        claim: {
          ...draft,
          status,
          claimantAuthority: reference,
          submissionEvidence: reference,
          paymentEvidence: reference,
          amount: "100.00",
        },
      },
      "owner",
      /death report/i,
    );
  }
});

test("money calculations use exact integer cents for decimal additions and subtraction", () => {
  assert.equal(cents("0.10") + cents("0.20"), 30n);
  assert.equal(cents("100.01") - cents("99.99"), 2n);
  assert.equal(cents("-0.10") + cents("0.20"), 10n);
  assert.equal(cents("999999999999.99"), 99999999999999n);
  const summary = ledgerSummary({
    openingBalance: "0.10",
    reserve: "0.00",
    entries: [
      { type: "inflow", amount: "0.20", status: "confirmed" },
      { type: "expense", amount: "0.01", status: "confirmed" },
    ],
  });
  assert.equal(summary.recordedBalance, "0.29");
  assert.equal(summary.unallocated, "0.29");
  for (const amount of ["0", "0.00", "-1.00", "0.001", "1e2", "NaN"]) {
    assert.equal(
      transactionSchema.safeParse(transaction({ amount })).success,
      false,
      `${amount} must not become a positive posted transaction`,
    );
  }
});

test("confirmed estate transactions require reviewed authority even when opening evidence is recorded", () => {
  const s = seed();
  openingLedger(s);
  const before = ledgerSummary(s.ledger);
  for (const role of ["owner", "professional", "representative"] as Role[]) {
    throwsWithoutMutation(
      s,
      "save-transaction",
      {
        transaction: transaction({ status: "confirmed", evidence: reference }),
      },
      role,
      /authority review/i,
    );
  }
  assert.deepEqual(ledgerSummary(s.ledger), before);
  apply(s, "report-death", { evidence: reference }, "owner");
  throwsWithoutMutation(
    s,
    "save-transaction",
    { transaction: transaction({ status: "confirmed", evidence: reference }) },
    "professional",
    /authority review/i,
  );
});

test("confirmed transactions cannot overdraw recorded funds or consume the protected reserve", () => {
  const s = reviewedEstate();
  openingLedger(s, "100.00", "10.00");
  for (const amount of ["100.01", "90.01"]) {
    throwsWithoutMutation(
      s,
      "save-transaction",
      {
        transaction: transaction({
          type: "distribution",
          amount,
          status: "confirmed",
          evidence: reference,
        }),
      },
      "representative",
      /funds|reserve/i,
    );
  }
  apply(
    s,
    "save-transaction",
    {
      transaction: transaction({
        type: "distribution",
        amount: "90.00",
        status: "confirmed",
        evidence: reference,
      }),
    },
    "representative",
  );
  assert.deepEqual(ledgerSummary(s.ledger), {
    recordedBalance: "10.00",
    reserve: "10.00",
    unallocated: "0.00",
    proposedTotal: "0.00",
  });
  throwsWithoutMutation(
    s,
    "save-ledger",
    {
      openingBalance: "100.00",
      reserve: "10.01",
      currency: "USD",
      openingEvidence: reference,
    },
    "professional",
    /overdraw/i,
  );
  throwsWithoutMutation(
    s,
    "save-transaction",
    {
      transaction: transaction({
        amount: "0.01",
        status: "confirmed",
        evidence: reference,
      }),
    },
    "owner",
    /reserve/i,
  );
});

test("proposed payments remain visible without reducing actual funds or implying a payment happened", () => {
  const s = reviewedEstate();
  openingLedger(s, "100.00", "10.00");
  apply(
    s,
    "save-transaction",
    { transaction: transaction({ type: "distribution", amount: "500.00" }) },
    "owner",
  );
  apply(
    s,
    "save-transaction",
    { transaction: transaction({ type: "expense", amount: "0.10" }) },
    "owner",
  );
  assert.deepEqual(ledgerSummary(s.ledger), {
    recordedBalance: "100.00",
    reserve: "10.00",
    unallocated: "90.00",
    proposedTotal: "500.10",
  });
  assert.ok(
    s.ledger!.entries.every(
      (item) => item.status === "proposed" && !item.evidence,
    ),
  );
});

test("professional emergency-only access excludes task queues, claims and the estate ledger", () => {
  const s = reviewedEstate();
  openingLedger(s);
  apply(
    s,
    "save-claim",
    {
      claim: claim({
        status: "submitted",
        claimantAuthority: reference,
        submissionEvidence: reference,
      }),
    },
    "professional",
  );
  const restricted = filtered(s, "professional", "emergency");
  assert.deepEqual(restricted.tasks, []);
  assert.deepEqual(restricted.claims, []);
  assert.equal(restricted.ledger, undefined);
  assert.deepEqual(restricted.accounts, []);
  const permitted = filtered(s, "professional", "administration");
  assert.ok(permitted.tasks.length > 0);
  assert.equal(permitted.claims?.length, 1);
  assert.ok(permitted.ledger);
});

test("changing a beneficiary instruction cannot reuse old institution confirmation evidence", () => {
  const s = emptyPlan("Sam");
  apply(
    s,
    "save-account",
    {
      account: account({
        verification: "institution-confirmed",
        notes: reference,
      }),
    },
    "owner",
  );
  const original = structuredClone(s.accounts[0]);
  apply(
    s,
    "save-account",
    {
      account: {
        ...original,
        beneficiarySummary:
          "A new recipient instruction reported by the owner.",
      },
    },
    "owner",
  );
  assert.equal(s.accounts[0].verification, "document-only");
  assert.equal(derive(s).readiness.accounts, 0);
  assert.ok(
    s.tasks.some(
      (item) => item.category === "accounts" && item.status === "open",
    ),
  );
  assert.equal(
    s.accounts[0].notes,
    reference,
    "the retained old reference must not be treated as confirmation of changed facts",
  );
});

test("replacing an executed attachment or its source text resets the record to draft and clears stale execution evidence", () => {
  for (const change of [
    { fileId: "replacement-upload-002" },
    { sourceText: "New document contents have not been executed." },
  ]) {
    const s = emptyPlan("Sam");
    apply(
      s,
      "save-document",
      {
        document: document({
          status: "executed",
          fileId: "original-upload-001",
          sourceText: "Original paper document text.",
          executionEvidence: signedEvidence,
          originalLocation: "Lawyer archive box 1",
        }),
      },
      "owner",
    );
    assert.equal(derive(s).readiness.documents, 1);
    const original = structuredClone(s.documents[0]);
    apply(
      s,
      "save-document",
      { document: { ...original, ...change } },
      "owner",
    );
    assert.equal(s.documents[0].status, "draft");
    assert.equal(s.documents[0].executionEvidence, "");
    assert.equal(derive(s).readiness.documents, 0);
    assert.equal(s.documents.length, 1);
  }
});

test("returned professional financial records and ledger do not alias mutable private state", () => {
  const s = reviewedEstate();
  openingLedger(s);
  apply(
    s,
    "save-claim",
    {
      claim: claim({
        status: "submitted",
        claimantAuthority: reference,
        submissionEvidence: reference,
      }),
    },
    "professional",
  );
  apply(
    s,
    "save-gift",
    { gift: gift({ visibility: "professional" }) },
    "owner",
  );
  const original = structuredClone(s);
  const view = filtered(s, "professional", "administration");
  view.accounts[0].beneficiarySummary = "Mutated returned account";
  view.claims![0].claimant = "Mutated returned claim";
  view.gifts[0].intention = "Mutated returned gift";
  view.ledger!.openingBalance = "999999.00";
  assert.deepEqual(s, original);
});
