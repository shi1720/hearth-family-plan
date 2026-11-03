const encoder = new TextEncoder();
const b64 = (bytes) =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
const unb64 = (value) =>
  Uint8Array.from(atob(value.replaceAll("-", "+").replaceAll("_", "/")), (c) =>
    c.charCodeAt(0),
  );
export async function digestBody(body = new Uint8Array()) {
  return b64(new Uint8Array(await crypto.subtle.digest("SHA-256", body)));
}
async function key(secret, usage) {
  if (!secret || secret.length < 32)
    throw Error("Bridge credential is not configured.");
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usage,
  );
}
function canonical(request, timestamp, nonce, payload, digest) {
  const url = new URL(request.url);
  return encoder.encode(
    [
      timestamp,
      nonce,
      request.method.toUpperCase(),
      url.pathname + url.search,
      request.headers.get("content-type") || "",
      payload,
      digest,
    ].join("\n"),
  );
}
export async function signBridgeRequest(
  request,
  body,
  user,
  secret,
  now = Date.now(),
) {
  const timestamp = String(Math.floor(now / 1000));
  const nonce = crypto.randomUUID();
  const payload = b64(
    encoder.encode(JSON.stringify({ ...user, issuer: "hearth-firebase-v1" })),
  );
  const digest = await digestBody(body);
  const signature = b64(
    new Uint8Array(
      await crypto.subtle.sign(
        "HMAC",
        await key(secret, ["sign"]),
        canonical(request, timestamp, nonce, payload, digest),
      ),
    ),
  );
  return {
    "x-hearth-identity": payload,
    "x-hearth-timestamp": timestamp,
    "x-hearth-nonce": nonce,
    "x-hearth-body-sha256": digest,
    "x-hearth-signature": signature,
  };
}
export async function verifyBridgeRequest(request, secret, now = Date.now()) {
  const payload = request.headers.get("x-hearth-identity") || "";
  const timestamp = request.headers.get("x-hearth-timestamp") || "";
  const nonce = request.headers.get("x-hearth-nonce") || "";
  const digest = request.headers.get("x-hearth-body-sha256") || "";
  const signature = request.headers.get("x-hearth-signature") || "";
  if (
    payload.length > 3000 ||
    !/^\d{10}$/.test(timestamp) ||
    Math.abs(now / 1000 - Number(timestamp)) > 30 ||
    !/^[a-f0-9-]{36}$/.test(nonce) ||
    !/^[A-Za-z0-9_-]{43}$/.test(digest) ||
    !/^[A-Za-z0-9_-]{43}$/.test(signature)
  )
    throw Error("Invalid or expired identity assertion.");
  const valid = await crypto.subtle.verify(
    "HMAC",
    await key(secret, ["verify"]),
    unb64(signature),
    canonical(request, timestamp, nonce, payload, digest),
  );
  if (!valid) throw Error("Invalid identity signature.");
  let user;
  try {
    user = JSON.parse(new TextDecoder().decode(unb64(payload)));
  } catch {
    throw Error("Invalid identity payload.");
  }
  if (
    user.issuer !== "hearth-firebase-v1" ||
    typeof user.uid !== "string" ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(user.uid) ||
    typeof user.email !== "string" ||
    user.email.length > 254 ||
    !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(user.email) ||
    typeof user.isDemo !== "boolean" ||
    typeof user.emailVerified !== "boolean" ||
    (!user.isDemo && !user.emailVerified) ||
    (user.isDemo && user.email !== `${user.uid}@demo.hearth.invalid`)
  )
    throw Error("Unverified identity.");
  const reader = request.clone().body?.getReader();
  let parts = [],
    size = 0;
  if (reader) {
    let timer;
    const limit = new Promise((_, reject) => {
      timer = setTimeout(() => reject(Error("Request read timed out.")), 10000);
    });
    try {
      for (;;) {
        const item = await Promise.race([reader.read(), limit]);
        if (item.done) break;
        size += item.value.byteLength;
        if (size > 6 * 1024 * 1024)
          throw Error("Request exceeds the bridge allowance.");
        parts.push(item.value);
      }
    } catch (error) {
      void reader.cancel().catch(() => {});
      throw error;
    } finally {
      clearTimeout(timer);
      try {
        reader.releaseLock();
      } catch {}
    }
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.byteLength;
  }
  if ((await digestBody(bytes)) !== digest)
    throw Error("Request integrity check failed.");
  return {
    uid: user.uid,
    email: user.email.toLowerCase(),
    name:
      typeof user.name === "string"
        ? Array.from(user.name).slice(0, 100).join("")
        : user.isDemo
          ? "Private sample"
          : user.email,
    isDemo: user.isDemo,
    emailVerified: user.emailVerified,
  };
}
