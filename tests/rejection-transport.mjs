/**
 * Bounded, no-retry probe for the previously intermittent Linux Worker transport.
 * Mode changes only the rejected POST's connection lifetime; all domain checks
 * and the subsequent successful request are identical. Synthetic loopback only.
 */
import assert from "node:assert/strict";
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:5176";
if (!["127.0.0.1", "localhost", "::1"].includes(new URL(base).hostname)) {
  throw new Error(
    "Transport probes must target a local Worker, never production.",
  );
}
const mode = process.env.TEST_REJECTION_TRANSPORT || "pooled";
if (!["pooled", "close-rejected"].includes(mode))
  throw new Error("Unknown transport probe mode.");
const iterations = 50;
const suffix = `${Date.now()}-${mode}`;
const identity = {
  "oai-authenticated-user-id": `transport-probe-${suffix}`,
  "oai-authenticated-user-email": `transport-probe-${suffix}@hearth.test`,
};
const started = performance.now();
let completedPairs = 0;
let phase = "initial owner workspace";
let currentIteration = 0;
let longestPairMs = 0;
async function call(path, init = {}) {
  const response = await fetch(base + path, {
    ...init,
    signal: AbortSignal.timeout(3000),
    headers: { ...identity, ...(init.headers || {}) },
  });
  // Consume every response fully, including deliberate rejections.
  const text = await response.text();
  return { status: response.status, text };
}
try {
  const initial = await call("/api/workspace");
  assert.equal(initial.status, 200, "synthetic owner setup");
  const original = JSON.parse(initial.text);
  for (
    currentIteration = 1;
    currentIteration <= iterations;
    currentIteration++
  ) {
    const pairStarted = performance.now();
    phase = "forbidden-origin POST";
    const rejected = await call("/api/workspace", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://attacker.test",
        ...(mode === "close-rejected" ? { connection: "close" } : {}),
      },
      body: JSON.stringify({
        action: "save-preferences",
        revision: original.revision,
        preferences: {
          contactFrequency: "Only when I ask",
          privateNote: "Synthetic rejected transport-probe content.",
        },
      }),
    });
    assert.equal(
      rejected.status,
      403,
      "forbidden-origin mutation must remain rejected",
    );
    phase = "following adviser GET";
    const next = await call("/api/workspace?previewRole=adviser");
    assert.equal(next.status, 200, "normal request after rejection");
    const data = JSON.parse(next.text);
    assert.equal(
      data.state.id,
      original.state.id,
      "probe must remain in the original synthetic household",
    );
    assert.equal(
      data.revision,
      original.revision,
      "rejected mutation must never persist",
    );
    assert.equal(data.user.role, "adviser");
    assert.deepEqual(data.state.documents, []);
    assert.deepEqual(data.state.accounts, []);
    assert.deepEqual(data.state.gifts, []);
    const durationMs = Math.round(performance.now() - pairStarted);
    longestPairMs = Math.max(longestPairMs, durationMs);
    completedPairs++;
  }
  console.log(
    JSON.stringify({
      probe: "forbidden-origin-post-followed-by-adviser-get",
      mode,
      result: "passed",
      iterations,
      completedPairs,
      durationMs: Math.round(performance.now() - started),
      longestPairMs,
      nodeVersion: process.version,
      scope:
        "Synthetic local Worker transport and unchanged domain authorization; no model calls and no retries.",
    }),
  );
} catch (error) {
  console.error(
    JSON.stringify({
      probe: "forbidden-origin-post-followed-by-adviser-get",
      mode,
      result: "failed",
      iterations,
      completedPairs,
      failedIteration: currentIteration,
      phase,
      durationMs: Math.round(performance.now() - started),
      longestPairMs,
      nodeVersion: process.version,
      error: {
        name: error.name,
        message: error.message,
        cause: error.cause?.code || null,
      },
      scope:
        "No retry was performed. A failure in either mode must fail the CI job.",
    }),
  );
  process.exitCode = 1;
}
