import test from "node:test";
import assert from "node:assert/strict";
import { apply, seed } from "../lib/domain";
import {
  assessLiveOutput,
  LIVE_FIXTURE,
  observationsMatch,
  runEvaluation,
  type LiveProposal,
} from "../lib/evaluation";

const proposals = (): LiveProposal[] => [
  {
    type: "task",
    title: "Confirm the current institution record",
    detail:
      "Ask the institution to confirm its current instructions before making a change.",
    sourceQuote: "no current institution confirmation is available",
    status: "pending",
  },
];
const live = (items = proposals(), exactInput = LIVE_FIXTURE.sourceText) =>
  assessLiveOutput({
    exactInput,
    proposals: items,
    model: "synthetic-test-model",
    durationMs: 12.5,
    usage: { input_tokens: 100, output_tokens: 30 },
  });

test("the actual rule suite executes all synthetic contracts with observed outputs", async () => {
  const r = await runEvaluation();
  assert.equal(r.schemaVersion, "hearth.evaluation.v1");
  assert.equal(r.total, r.cases.length);
  assert.ok(r.total >= 18);
  assert.equal(r.failed, 0);
  assert.equal(r.passed, r.total);
  assert.equal(r.modelCalls, 0);
  assert.equal(r.persisted, false);
  assert.equal(r.dataClass, "Synthetic fixtures only");
  assert.equal(new Set(r.cases.map((c) => c.id)).size, r.total);
  assert.deepEqual([...new Set(r.cases.map((c) => c.group))].sort(), [
    "Authority",
    "Evidence",
    "Financial records",
    "Privacy",
    "Provenance",
  ]);
  for (const c of r.cases) {
    assert.ok(c.title && c.purpose);
    assert.equal(c.passed, observationsMatch(c.expected, c.actual));
    assert.ok(c.durationMs >= 0);
  }
  assert.equal(
    r.cases.find((c) => c.id === "claim-ledger-separation")?.actual
      .estateBalance,
    "100.00",
  );
  assert.equal(
    r.cases.find((c) => c.id === "exact-cents")?.actual.recordedBalance,
    "0.29",
  );
});

test("fresh runs have their own identities and do not mutate the reusable domain fixture", async () => {
  const fixture = seed();
  const original = structuredClone(fixture);
  const first = await runEvaluation(),
    second = await runEvaluation();
  assert.notEqual(first.runId, second.runId);
  assert.deepEqual(
    first.cases.map((c) => c.actual),
    second.cases.map((c) => c.actual),
  );
  assert.deepEqual(fixture, original);
  assert.ok(!JSON.stringify(second).includes("local-owner"));
});

test("the evaluator detects a deliberately weakened execution-evidence gate", async () => {
  const r = await runEvaluation({
    applyFn: (s, action, p, role) => {
      if (
        action === "save-document" &&
        p.document.status === "executed" &&
        !p.document.executionEvidence
      )
        return s;
      return apply(s, action, p, role);
    },
  });
  const affected = r.cases.find((c) => c.id === "document-evidence")!;
  assert.equal(affected.passed, false);
  assert.equal(affected.actual.rejected, false);
  assert.ok(
    r.failed > 0,
    "a broken rule must never receive the normal green report",
  );
  assert.equal(
    r.cases.find((c) => c.id === "document-positive")?.passed,
    true,
    "the positive control still runs independently",
  );
});

test("unexpected case errors become visible failed observations and do not skip the rest", async () => {
  const r = await runEvaluation({
    applyFn: () => {
      throw new Error("Synthetic implementation failure.");
    },
  });
  assert.ok(r.failed > 0);
  assert.ok(
    r.cases.some(
      (c) => c.actual.executionError === "Synthetic implementation failure.",
    ),
  );
  assert.equal(
    r.cases.at(-1)?.id,
    "audit-integrity",
    "the runner must continue after a failed transition",
  );
  assert.equal(r.cases.find((c) => c.id === "audit-integrity")?.passed, true);
  assert.equal(r.passed + r.failed, r.total);
});

test("provenance checks detect lost instructions rather than merely a task count", async () => {
  const r = await runEvaluation({
    applyFn: (s, action, p, role) => {
      const result = apply(s, action, p, role);
      if (action === "accept-proposal") delete result.tasks.at(-1)!.detail;
      return result;
    },
  });
  const c = r.cases.find((c) => c.id === "proposal-provenance")!;
  assert.equal(c.passed, false);
  assert.equal(c.actual.detailPreserved, false);
  assert.equal(c.actual.quotePreserved, true);
});

test("observation comparison is key-order independent and value-sensitive", () => {
  assert.equal(
    observationsMatch(
      { a: 1, b: { x: false, y: "0.00" } },
      { b: { y: "0.00", x: false }, a: 1 },
    ),
    true,
  );
  assert.equal(observationsMatch({ allowed: false }, { allowed: true }), false);
  assert.equal(observationsMatch({ amount: "0.10" }, { amount: 0.1 }), false);
  assert.equal(observationsMatch({ order: [1, 2] }, { order: [2, 1] }), false);
});

test("valid synthetic model output passes mechanical checks without claiming semantic accuracy", () => {
  const r = live();
  assert.equal(r.passed, 3);
  assert.equal(r.failed, 0);
  assert.equal(r.model, "synthetic-test-model");
  assert.equal(r.durationMs, 12.5);
  assert.equal(r.persistedToPlan, false);
  assert.ok(r.limits.some((t) => t.includes("not a legal accuracy score")));
  assert.ok(r.humanReviewPrompts.length >= 5);
  assert.equal(r.exactInput, LIVE_FIXTURE.sourceText);
  assert.ok(!("accuracy" in r));
});

test("a paraphrased or fabricated model quote fails exact grounding", () => {
  const r = live(
    proposals().map((p) => ({
      ...p,
      sourceQuote: "The bank has definitely confirmed the new beneficiaries.",
    })),
  );
  const grounded = r.checks.find((c) => c.id === "live-quotes")!;
  assert.equal(grounded.passed, false);
  assert.equal(grounded.actual.allQuotesFound, false);
  assert.equal(r.failed, 1);
});

test("empty quotes cannot obtain a vacuous source-grounding pass", () => {
  const r = live(proposals().map((p) => ({ ...p, sourceQuote: "" })));
  assert.equal(r.checks.find((c) => c.id === "live-quotes")?.passed, false);
});

test("output represented as already accepted fails the pending-state check", () => {
  const r = live(proposals().map((p) => ({ ...p, status: "accepted" })));
  assert.equal(r.checks.find((c) => c.id === "live-pending")?.passed, false);
  assert.equal(r.persistedToPlan, false);
});

test("an empty model response fails every mechanical check", () => {
  const r = live([]);
  assert.equal(r.passed, 0);
  assert.equal(r.failed, r.checks.length);
});

test("too many follow-ups fail the declared output bound", () => {
  const r = live(Array.from({ length: 9 }, () => proposals()[0]));
  assert.equal(r.checks.find((c) => c.id === "live-structure")?.passed, false);
});

test("live reports copy proposals so inspecting output cannot mutate its input", () => {
  const input = proposals(),
    before = structuredClone(input);
  const r = live(input);
  r.proposals[0].detail = "Changed by the report consumer.";
  assert.deepEqual(input, before);
});
