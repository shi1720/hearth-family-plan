import test from "node:test";
import assert from "node:assert/strict";
import {
  signBridgeRequest,
  verifyBridgeRequest,
  digestBody,
  type BridgeUser,
} from "../gateway/bridge-auth.mjs";

const secret = "synthetic-bridge-test-secret-only-0123456789abcdef";
const wrongSecret = "different-synthetic-test-secret-0123456789abcdef";
const now = 1793696400000;
const validUser: BridgeUser = {
  uid: "synthetic-user-1",
  email: "owner@hearth.test",
  name: "Synthetic owner",
  isDemo: false,
  emailVerified: true,
};
const bytes = new TextEncoder().encode(
  '{"action":"save-preferences","revision":1}',
);
async function assertion(
  options: {
    user?: BridgeUser;
    time?: number;
    body?: Uint8Array;
    url?: string;
    method?: string;
    contentType?: string;
  } = {},
) {
  const url =
    options.url || "https://gateway.hearth.test/api/workspace?example=1";
  const body = options.body || bytes,
    method = options.method || "POST";
  const headers = { "content-type": options.contentType || "application/json" };
  const target = new Request(url, {
    method,
    headers,
    body: Uint8Array.from(body),
  });
  const signed = await signBridgeRequest(
    target,
    body,
    options.user || validUser,
    secret,
    options.time ?? now,
  );
  return new Request(url, {
    method,
    headers: { ...headers, ...signed },
    body: Uint8Array.from(body),
  });
}
function changed(
  req: Request,
  options: {
    url?: string;
    method?: string;
    headers?: Headers;
    body?: Uint8Array;
  } = {},
) {
  return new Request(options.url || req.url, {
    method: options.method || req.method,
    headers: options.headers || new Headers(req.headers),
    body: Uint8Array.from(options.body || bytes),
  });
}

test("valid signed identity verifies while the original request body remains available to the application", async () => {
  const req = await assertion();
  const user = await verifyBridgeRequest(req, secret, now);
  assert.deepEqual(user, validUser);
  assert.deepEqual(new Uint8Array(await req.arrayBuffer()), bytes);
});

test("every required assertion header is necessary", async () => {
  for (const name of [
    "x-hearth-identity",
    "x-hearth-timestamp",
    "x-hearth-nonce",
    "x-hearth-body-sha256",
    "x-hearth-signature",
  ]) {
    const req = await assertion(),
      headers = new Headers(req.headers);
    headers.delete(name);
    await assert.rejects(
      verifyBridgeRequest(changed(req, { headers }), secret, now),
      /invalid|expired/i,
      name,
    );
  }
});

test("expired and too-far-future assertions are rejected even when correctly signed", async () => {
  for (const time of [now - 31000, now + 31000]) {
    await assert.rejects(
      verifyBridgeRequest(await assertion({ time }), secret, now),
      /expired|invalid/i,
    );
  }
});

test("a wrong or absent bridge secret cannot verify an otherwise valid assertion", async () => {
  await assert.rejects(
    verifyBridgeRequest(await assertion(), wrongSecret, now),
    /signature/i,
  );
  await assert.rejects(
    verifyBridgeRequest(await assertion(), "", now),
    /configured/i,
  );
});

test("signed path and query cannot be changed to invoke a different action", async () => {
  const req = await assertion();
  for (const url of [
    "https://gateway.hearth.test/api/access?example=1",
    "https://gateway.hearth.test/api/workspace?example=2",
  ]) {
    await assert.rejects(
      verifyBridgeRequest(changed(req, { url }), secret, now),
      /signature/i,
    );
  }
});

test("method and content type are integrity-bound to the assertion", async () => {
  const req = await assertion();
  await assert.rejects(
    verifyBridgeRequest(changed(req, { method: "PUT" }), secret, now),
    /signature/i,
  );
  const headers = new Headers(req.headers);
  headers.set("content-type", "text/plain");
  await assert.rejects(
    verifyBridgeRequest(changed(req, { headers }), secret, now),
    /signature/i,
  );
});

test("body bytes are verified rather than trusting the signed digest header alone", async () => {
  const req = await assertion();
  const other = new TextEncoder().encode('{"action":"new-plan","revision":1}');
  await assert.rejects(
    verifyBridgeRequest(changed(req, { body: other }), secret, now),
    /integrity/i,
  );
});

test("a modified identity payload or nonce cannot reuse an old signature", async () => {
  const req = await assertion(),
    headers = new Headers(req.headers);
  headers.set(
    "x-hearth-identity",
    Buffer.from(
      JSON.stringify({
        ...validUser,
        uid: "another-user",
        issuer: "hearth-firebase-v1",
      }),
    ).toString("base64url"),
  );
  await assert.rejects(
    verifyBridgeRequest(changed(req, { headers }), secret, now),
    /signature/i,
  );
  const nonceHeaders = new Headers(req.headers);
  nonceHeaders.set("x-hearth-nonce", crypto.randomUUID());
  await assert.rejects(
    verifyBridgeRequest(changed(req, { headers: nonceHeaders }), secret, now),
    /signature/i,
  );
});

test("unverified non-demo accounts are rejected after signature verification", async () => {
  const req = await assertion({ user: { ...validUser, emailVerified: false } });
  await assert.rejects(verifyBridgeRequest(req, secret, now), /unverified/i);
});

test("demo identity is bound to its exact Firebase UID and cannot claim an operator email", async () => {
  const demo: BridgeUser = {
    uid: "anonymous-test-1",
    email: "anonymous-test-1@demo.hearth.invalid",
    name: "Private sample",
    isDemo: true,
    emailVerified: false,
  };
  assert.deepEqual(
    await verifyBridgeRequest(await assertion({ user: demo }), secret, now),
    demo,
  );
  for (const email of [
    "another-user@demo.hearth.invalid",
    "operator@hearth.test",
  ]) {
    await assert.rejects(
      verifyBridgeRequest(
        await assertion({ user: { ...demo, email } }),
        secret,
        now,
      ),
      /unverified/i,
    );
  }
});

test("unsigned demo and display-name markers cannot change the verified identity", async () => {
  const req = await assertion(),
    headers = new Headers(req.headers);
  headers.set("x-hearth-bridge-demo", "1");
  headers.set("x-hearth-bridge-verified", "1");
  headers.set("x-hearth-display-name", "Forged operator");
  const user = await verifyBridgeRequest(
    changed(req, { headers }),
    secret,
    now,
  );
  assert.equal(user.isDemo, false);
  assert.equal(user.name, validUser.name);
  assert.equal(user.uid, validUser.uid);
});

test("a body exceeding the bridge allowance is rejected without forwarding its content", async () => {
  const body = new Uint8Array(6 * 1024 * 1024 + 1);
  body.fill(65);
  const req = await assertion({ body });
  try {
    await assert.rejects(verifyBridgeRequest(req, secret, now), /allowance/i);
  } finally {
    await req.body?.cancel().catch(() => {});
  }
});

test("empty-body signatures work for read-only requests", async () => {
  const target = new Request("https://gateway.hearth.test/api/workspace");
  const signed = await signBridgeRequest(
    target,
    new Uint8Array(),
    validUser,
    secret,
    now,
  );
  const verified = await verifyBridgeRequest(
    new Request(target.url, { headers: signed }),
    secret,
    now,
  );
  assert.equal(verified.uid, validUser.uid);
  assert.equal(
    await digestBody(new Uint8Array()),
    signed["x-hearth-body-sha256"],
  );
});

test("display-name truncation preserves valid Unicode for the downstream encoded header", async () => {
  const name = "a".repeat(99) + "🌿";
  const user = await verifyBridgeRequest(
    await assertion({ user: { ...validUser, name } }),
    secret,
    now,
  );
  assert.doesNotThrow(() => encodeURIComponent(user.name!));
  assert.ok(Array.from(user.name!).length <= 100);
});
