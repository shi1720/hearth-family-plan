/** Actual lib/server credential policy, executed in an isolated local D1 Worker. */
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import net from "node:net";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporary = await mkdtemp(path.join(tmpdir(), "hearth-key-policy-"));
let child = null,
  logs = "",
  passed = 0;
const check = (name, fn) => {
  fn();
  passed++;
  console.log(`PASS ${name}`);
};
function kill() {
  if (!child?.pid) return;
  try {
    if (process.platform !== "win32") process.kill(-child.pid, "SIGTERM");
    else child.kill("SIGTERM");
  } catch {}
  child = null;
}
async function port() {
  return await new Promise((resolve, reject) => {
    const socket = net.createServer();
    socket.once("error", reject);
    socket.listen(0, "127.0.0.1", () => {
      const p = socket.address().port;
      socket.close(() => resolve(p));
    });
  });
}
async function start(limit, label) {
  const directory = path.join(temporary, label);
  await import("node:fs/promises").then((fs) =>
    fs.mkdir(directory, { recursive: true }),
  );
  const config = JSON.parse(
    await readFile(path.join(root, "tests/key-policy.wrangler.json"), "utf8"),
  );
  config.main = path.join(root, "tests/key-policy.worker.ts");
  config.vars.PUBLIC_DEMO_AI_DAILY_LIMIT = limit;
  const configPath = path.join(directory, "wrangler.json");
  await writeFile(configPath, JSON.stringify(config));
  // Explicit fake values live beside the temporary config, isolating root .dev.vars.
  await writeFile(
    path.join(directory, ".dev.vars"),
    Object.entries(config.vars)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n") + "\n",
  );
  const persist = path.join(directory, "persist");
  const wrangler = path.join(root, "node_modules/wrangler/bin/wrangler.js");
  const setup = spawnSync(
    process.execPath,
    [
      "--import",
      path.join(root, "scripts/sites-env.mjs"),
      wrangler,
      "d1",
      "execute",
      "DB",
      "--local",
      "--config",
      configPath,
      "--persist-to",
      persist,
      "--file",
      path.join(root, "tests/key-policy.schema.sql"),
    ],
    {
      cwd: root,
      encoding: "utf8",
      timeout: 30000,
      env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
    },
  );
  if (setup.status !== 0)
    throw new Error(
      `Synthetic D1 setup failed: ${(setup.stderr || setup.stdout).slice(-4000)}`,
    );
  const chosen = await port(),
    base = `http://127.0.0.1:${chosen}`;
  child = spawn(
    process.execPath,
    [
      "--import",
      path.join(root, "scripts/sites-env.mjs"),
      wrangler,
      "dev",
      "--config",
      configPath,
      "--local",
      "--persist-to",
      persist,
      "--ip",
      "127.0.0.1",
      "--port",
      String(chosen),
      "--inspector-port",
      "0",
      "--log-level",
      "warn",
    ],
    {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
      detached: process.platform !== "win32",
      env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
    },
  );
  child.stdout.on("data", (data) => {
    logs = (logs + data).slice(-6000);
  });
  child.stderr.on("data", (data) => {
    logs = (logs + data).slice(-6000);
  });
  const until = Date.now() + 15000;
  for (;;) {
    if (child.exitCode !== null)
      throw new Error(`Local policy Worker exited: ${logs}`);
    try {
      const r = await fetch(base + "/health", {
        signal: AbortSignal.timeout(1000),
      });
      const j = await r.json();
      if (j.fixture === "hearth-isolated-key-policy-test") break;
    } catch {}
    if (Date.now() > until)
      throw new Error(`Local policy Worker did not become ready: ${logs}`);
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  return async (endpoint, body = {}) => {
    const r = await fetch(base + endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    return { status: r.status, json: await r.json() };
  };
}
try {
  let call = await start("12", "normal");
  await call("/setup");
  let result = await call("/identity");
  check("anonymous request has no downstream identity", () =>
    assert.equal(result.status, 401),
  );
  result = await call("/lookup", { owner: "firebase:operator-fixture" });
  check(
    "allowlisted operator receives the configured shared fixture key",
    () => {
      assert.equal(result.status, 200);
      assert.equal(result.json.keyKind, "shared");
      assert.equal(result.json.globalReserved, 0);
    },
  );
  for (const owner of [
    "firebase:ordinary-real",
    "firebase:ordinary-fixture",
    "firebase:demo-real",
    "untrusted-demo-id",
    "firebase:operator-professional-only",
  ]) {
    const availability = await call("/availability", { owner });
    result = await call("/lookup", { owner });
    check(`noneligible ${owner} cannot use the shared key`, () => {
      assert.equal(availability.json.configured, false);
      assert.equal(result.status, 400);
      assert.equal(result.json.keyReturned, false);
    });
  }
  result = await call("/lookup", { owner: "firebase:legitimate-guest" });
  check("legitimate Firebase demo fixture reserves one global request", () => {
    assert.equal(result.status, 200);
    assert.equal(result.json.keyKind, "shared");
    assert.equal(result.json.globalReserved, 1);
  });
  result = await call("/lookup", { owner: "firebase:personal-key" });
  check("ordinary owner can decrypt their own stored credential", () => {
    assert.equal(result.status, 200);
    assert.equal(result.json.keyKind, "personal");
    assert.equal(result.json.globalReserved, 1);
  });
  result = await call("/personal-ciphertext");
  check("the personal fixture credential is stored encrypted", () => {
    assert.equal(result.json.encrypted, true);
    assert.equal(result.json.ivPresent, true);
  });
  result = await call("/concurrent-budget");
  check(
    "32 concurrent sample owners receive exactly 12 global reservations",
    () => {
      assert.equal(result.status, 200);
      assert.equal(result.json.results.length, 32);
      assert.equal(result.json.results.filter((x) => x.success).length, 12);
      assert.equal(
        result.json.results.filter((x) => x.status === 429).length,
        20,
      );
      assert.equal(result.json.globalReserved, 12);
      assert.ok(
        result.json.results
          .filter((x) => x.success)
          .every((x) => x.keyKind === "shared"),
      );
      assert.equal(result.json.externalModelCalls, 0);
    },
  );
  result = await call("/lookup", { owner: "firebase:legitimate-guest" });
  check("exhausted global quota rejects another sample owner", () => {
    assert.equal(result.status, 429);
    assert.equal(result.json.keyReturned, false);
  });
  result = await call("/lookup", { owner: "firebase:personal-key" });
  check(
    "global demo exhaustion does not block an owner’s own credential",
    () => {
      assert.equal(result.status, 200);
      assert.equal(result.json.keyKind, "personal");
      assert.equal(result.json.globalReserved, 12);
    },
  );
  kill();
  call = await start("not-a-number", "invalid-limit");
  await call("/setup");
  result = await call("/lookup", { owner: "firebase:legitimate-guest" });
  check(
    "an invalid configured demo limit fails closed without returning a key",
    () => {
      assert.equal(result.status, 503);
      assert.match(result.json.error, /temporarily unavailable/i);
      assert.equal(result.json.keyReturned, false);
      assert.ok(!("keyKind" in result.json));
    },
  );
  console.log(
    JSON.stringify({
      passed,
      failed: 0,
      scope:
        "Actual getKey/hasKey/putKey in an isolated local Worker and fresh D1. Synthetic keys only; zero model calls. Does not test Firebase verification, hosted HMAC routing or production configuration.",
    }),
  );
} catch (error) {
  console.error(error);
  console.error("Synthetic test Worker diagnostics:", logs);
  process.exitCode = 1;
} finally {
  kill();
  await rm(temporary, { recursive: true, force: true });
}
