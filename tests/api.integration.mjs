import assert from "node:assert/strict";
const networkFetch = globalThis.fetch;
const fetch = (url, init = {}) =>
  networkFetch(url, { signal: AbortSignal.timeout(15000), ...init });
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:5176";
if (!["127.0.0.1", "localhost", "::1"].includes(new URL(base).hostname))
  throw new Error(
    "Synthetic integration tests must target a local Worker, never production.",
  );
const suffix = Date.now();
const owner = {
    id: `test-owner-${suffix}`,
    email: `owner-${suffix}@hearth.test`,
  },
  helper = {
    id: `test-helper-${suffix}`,
    email: `helper-${suffix}@hearth.test`,
  },
  other = { id: `test-other-${suffix}`, email: `other-${suffix}@hearth.test` },
  prof = { id: `test-prof-${suffix}`, email: `prof-${suffix}@hearth.test` };
let passed = 0;
function headers(u, extra = {}) {
  return {
    ...(u
      ? {
          "oai-authenticated-user-id": u.id,
          "oai-authenticated-user-email": u.email,
        }
      : {}),
    ...extra,
  };
}
async function request(path, u, body, extra = {}) {
  const r = await fetch(base + path, {
    method: body ? "POST" : "GET",
    headers: headers(u, {
      ...(body ? { "content-type": "application/json" } : {}),
      ...extra,
    }),
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let j;
  try {
    j = await r.json();
  } catch {
    j = {};
  }
  return { r, j };
}
function check(name, fn) {
  fn();
  passed++;
  console.log(`PASS ${name}`);
}
let x = await request("/api/workspace");
check("anonymous API access denied", () => assert.equal(x.r.status, 401));
x = await request("/api/workspace", owner);
check("owner receives private fictional workspace", () => {
  assert.equal(x.r.status, 200);
  assert.equal(x.j.user.role, "owner");
  assert.equal(x.j.state.fixture, true);
});
let state = x.j;
async function mutate(action, p = {}) {
  const q = await request("/api/workspace", owner, {
    action,
    revision: state.revision,
    ...p,
  });
  if (q.r.ok) state = q.j;
  return q;
}
x = await request("/api/workspace", owner, {
  action: "save-preferences",
  revision: 0,
  preferences: { contactFrequency: "Only when I ask", privateNote: "x" },
});
check("stale revision rejected", () => assert.equal(x.r.status, 409));
x = await request(
  "/api/workspace",
  owner,
  {
    action: "save-preferences",
    revision: state.revision,
    preferences: { contactFrequency: "Only when I ask", privateNote: "x" },
  },
  { origin: "https://attacker.test" },
);
check("cross-origin mutation rejected", () => assert.equal(x.r.status, 403));
x = await request("/api/workspace?previewRole=adviser", owner);
check("server adviser preview hides private records and source text", () => {
  assert.deepEqual(x.j.state.accounts, []);
  assert.deepEqual(x.j.state.gifts, []);
  assert.deepEqual(x.j.state.proposals, []);
  assert.equal(x.j.state.preferences.privateNote, "");
});
x = await mutate("invite", {
  email: helper.email,
  role: "helper",
  access: "emergency",
});
const token = new URL(x.j.invitation.url).searchParams.get("invite");
x = await request("/api/invitations?token=" + token, other);
check("invitation rejects a different signed-in email", () =>
  assert.equal(x.r.status, 403),
);
x = await request("/api/invitations", helper, { token });
check("intended signed-in helper can accept", () =>
  assert.equal(x.r.status, 200),
);
const cookie = x.r.headers.get("set-cookie").split(";")[0];
x = await request("/api/workspace", helper, null, { cookie });
check("helper sees only permission-filtered emergency records", () => {
  assert.equal(x.j.user.role, "helper");
  assert.equal(x.j.state.id, state.state.id);
  assert.ok(x.j.state.documents.every((d) => d.kind === "care"));
  assert.deepEqual(x.j.state.accounts, []);
});
x = await request(
  "/api/workspace",
  helper,
  { action: "review-authority", revision: state.revision, authority: {} },
  { cookie },
);
check("helper cannot approve authority", () => assert.equal(x.r.status, 403));
x = await request("/api/export", helper, null, { cookie });
check("export uses same permission boundary", () => {
  assert.deepEqual(x.j.state.accounts, []);
  assert.deepEqual(x.j.state.gifts, []);
});
x = await request("/api/history", helper, null, { cookie });
check("helper cannot retrieve prior private versions", () =>
  assert.equal(x.r.status, 403),
);
x = await request("/api/invitations", helper, { token });
check("invitation replay rejected", () => assert.equal(x.r.status, 400));
const form = new FormData();
const content =
  "Fictional test record. Maria has an old will. This is not an executed legal instrument.";
form.append(
  "file",
  new File([content], "test-record.txt", { type: "text/plain" }),
);
let response = await fetch(base + "/api/files", {
  method: "POST",
  headers: headers(owner),
  body: form,
});
const uploaded = await response.json();
check("private file upload succeeds", () => assert.equal(response.status, 200));
x = await mutate("save-document", {
  document: {
    title: "Private source",
    kind: "other",
    status: "draft",
    originalLocation: "",
    executionEvidence: "",
    notes: "Private synthetic integration fixture.",
    visibility: "private",
    fileId: uploaded.fileId,
  },
});
check("file can be attached to household document", () =>
  assert.equal(x.r.status, 200),
);
response = await fetch(base + "/api/files?id=" + uploaded.fileId, {
  headers: headers(owner),
});
check("owner receives decrypted original bytes", () =>
  assert.equal(response.status, 200),
);
const decrypted = await response.text();
check("decrypted file content unchanged", () =>
  assert.equal(decrypted, content),
);
x = await request("/api/files?id=" + uploaded.fileId, helper, null, { cookie });
check("helper cannot retrieve unshared file by ID", () =>
  assert.equal(x.r.status, 403),
);
x = await request("/api/access", owner);
const member = x.j.members.find((m) => m.user === helper.id);
check("owner can inspect actual accepted membership", () => assert.ok(member));
x = await request("/api/access", owner, {
  action: "remove-member",
  userId: helper.id,
  revision: state.revision,
});
check("owner can revoke accepted membership", () =>
  assert.equal(x.r.status, 200),
);
x = await request("/api/workspace", helper, null, { cookie });
check("revocation removes access despite existing selection cookie", () =>
  assert.notEqual(x.j.state.id, state.state.id),
);
state = (await request("/api/workspace", owner)).j;
x = await mutate("invite", {
  email: prof.email,
  role: "professional",
  access: "emergency",
});
const profToken = new URL(x.j.invitation.url).searchParams.get("invite");
x = await request("/api/invitations", prof, { token: profToken });
const profCookie = x.r.headers.get("set-cookie").split(";")[0];
x = await request(
  "/api/workspace",
  prof,
  { action: "review-authority", revision: state.revision, authority: {} },
  { cookie: profCookie },
);
check("limited professional cannot use administration permissions", () =>
  assert.equal(x.r.status, 403),
);
x = await mutate("analyze", { text: content, consent: false });
check("source cannot be sent to model without consent", () =>
  assert.equal(x.r.status, 400),
);
x = await mutate("report-death", {
  evidence: "Synthetic certificate reference for integration exercise only.",
});
check("death report records event without unlocking authority", () => {
  assert.equal(x.r.status, 200);
  assert.equal(x.j.state.household.stage, "death-reported");
  assert.equal(x.j.derived.releaseAllowed, false);
});
x = await mutate("save-ledger", {
  openingBalance: "100.00",
  reserve: "10.00",
  currency: "USD",
  openingEvidence: "Synthetic bank opening statement integration reference.",
});
check("ledger opening record preserves exact amounts", () => {
  assert.equal(x.r.status, 200);
  assert.equal(x.j.derived.ledger.recordedBalance, "100.00");
});
x = await mutate("save-transaction", {
  transaction: {
    type: "distribution",
    amount: "10.00",
    payee: "Test beneficiary",
    description: "Recorded test distribution",
    status: "confirmed",
    evidence: "Synthetic bank confirmation integration reference.",
  },
});
check("distribution confirmation blocked without reviewed authority", () =>
  assert.equal(x.r.status, 400),
);
x = await request("/api/history", owner);
check("prior plan versions preserved for owner", () => {
  assert.equal(x.r.status, 200);
  assert.ok(x.j.versions.length >= 4);
  assert.ok(x.j.versions.some((v) => v.state.household.stage === "living"));
});

x = await mutate("review-authority", {
  authority: {
    deathEvidence: "Synthetic death certificate reviewed for test.",
    identityEvidence: "Synthetic identity record matched for test.",
    appointmentEvidence: "Synthetic court appointment reviewed for test.",
    reviewer: "Fictional professional · test only",
  },
});
check("fictional authority exercise opens the administration workflow", () => {
  assert.equal(x.r.status, 200);
  assert.equal(x.j.state.household.stage, "authority-reviewed");
});
x = await mutate("save-transaction", {
  transaction: {
    type: "expense",
    amount: "0.10",
    payee: "Test provider",
    description: "Synthetic small expense",
    status: "confirmed",
    evidence: "Synthetic bank confirmation for ten cents.",
  },
});
check("confirmed ledger transaction reconciles exact cents", () => {
  assert.equal(x.r.status, 200);
  assert.equal(x.j.derived.ledger.recordedBalance, "99.90");
});
x = await mutate("save-transaction", {
  transaction: {
    type: "distribution",
    amount: "100.00",
    payee: "Test recipient",
    description: "Synthetic overdraw attempt",
    status: "confirmed",
    evidence: "Synthetic bank reference not enough to overdraw.",
  },
});
check("reviewed authority does not bypass reserve protection", () =>
  assert.equal(x.r.status, 400),
);
const claim = {
  accountId: "a-policy",
  claimant: "Elena Ellis · fictional",
  institution: "Fictional Orchard Life",
  claimantAuthority:
    "Synthetic beneficiary authority record reviewed separately.",
  status: "submitted",
  reference: "DEMO-CLAIM-001",
  requirements: "Synthetic insurer requirements checklist recorded.",
  nextAction: "Await provider receipt.",
  deadline: null,
  submissionEvidence: "Synthetic insurer submission receipt DEMO-CLAIM-001.",
  paymentEvidence: "",
  amount: "100000.00",
  currency: "USD",
  visibility: "professional",
};
x = await mutate("save-claim", { claim });
check("claim records separate beneficiary authority and submission", () =>
  assert.equal(x.r.status, 200),
);
const claimId = x.j.state.claims.at(-1).id;
response = await fetch(base + "/api/packet?claim=" + claimId, {
  headers: headers(owner),
});
const packet = await response.text();
check("claim packet is real downloadable draft with receipt references", () => {
  assert.equal(response.status, 200);
  assert.ok(packet.includes("DEMO-CLAIM-001"));
  assert.ok(packet.includes("FICTIONAL DEMONSTRATION"));
});
x = await mutate("save-claim", {
  claim: {
    ...claim,
    id: claimId,
    status: "paid",
    paymentEvidence:
      "Synthetic insurer payment confirmation and recipient bank record.",
  },
});
check(
  "paid claim evidence persists without adding insurance money to estate ledger",
  () => {
    assert.equal(x.r.status, 200);
    assert.equal(x.j.state.claims.at(-1).status, "paid");
    assert.equal(x.j.derived.ledger.recordedBalance, "99.90");
  },
);
x = await request("/api/export?previewRole=adviser", owner);
check("owner preview export obeys the chosen filtered role", () => {
  assert.deepEqual(x.j.state.accounts, []);
  assert.deepEqual(x.j.state.claims, []);
  assert.equal(x.j.state.ledger, undefined);
});
x = await mutate("invite", {
  email: other.email,
  role: "helper",
  access: "documents",
});
const revokedToken = new URL(x.j.invitation.url).searchParams.get("invite");
let access = (await request("/api/access", owner)).j;
const pending = access.invitations.find(
  (i) => i.email === other.email && !i.acceptedBy,
);
x = await request("/api/access", owner, {
  action: "revoke-invitation",
  tokenHash: pending.tokenHash,
  revision: state.revision,
});
check("unused invitation can be revoked", () => assert.equal(x.r.status, 200));
x = await request("/api/invitations", other, { token: revokedToken });
check("revoked link can no longer grant access", () =>
  assert.equal(x.r.status, 400),
);

console.log(
  JSON.stringify({
    passed,
    failed: 0,
    scope:
      "Local downstream identity, D1, R2 and API authorization; not a test of hosted sign-in or professional credential verification.",
  }),
);
