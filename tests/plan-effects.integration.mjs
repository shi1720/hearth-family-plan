/** Actual lib/server credential policy, executed in an isolated local D1 Worker. */
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import net from "node:net";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporary = await mkdtemp(path.join(tmpdir(), "hearth-plan-effects-"));
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
    await readFile(path.join(root, "tests/plan-effects.wrangler.json"), "utf8"),
  );
  config.main = path.join(root, "tests/plan-effects.worker.ts");

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
      path.join(root, "tests/plan-effects.schema.sql"),
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
      if (j.fixture === "hearth-isolated-plan-effects-test") break;
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
  const call = await start("unused", "isolated");
  for (const scenario of [
    "stale-invite",
    "stale-revoke",
    "stale-member",
    "accepted-revoke",
    "missing-member",
    "owner-removal",
    "duplicate-invite",
    "valid-invite",
    "valid-revoke",
    "valid-member",
  ]) {
    const result = await call("/run", { scenario });
    assert.equal(result.status, 200, JSON.stringify(result.json));
    const j = result.json;
    const stale = scenario.startsWith("stale-"),
      valid = scenario.startsWith("valid-");
    check(
      scenario + " preserves atomic state, snapshot, audit and access effects",
      () => {
        assert.equal(
          j.status,
          valid ? 200 : scenario === "duplicate-invite" ? 500 : 409,
        );
        assert.equal(j.revision, stale || valid ? 2 : 1);
        assert.deepEqual(
          j.state,
          stale ? j.winner : valid ? j.proposed : j.original,
        );
        assert.equal(j.snapshots.length, stale || valid ? 1 : 0);
        if (j.snapshots.length) {
          assert.equal(j.snapshots[0].revision, 1);
          assert.deepEqual(JSON.parse(j.snapshots[0].state), j.original);
        }
        assert.deepEqual(
          j.audit.map((a) => a.id),
          stale
            ? [j.winner.events.at(-1).id]
            : valid
              ? [j.proposed.events.at(-1).id]
              : [],
        );
        assert.equal(
          j.invitations.some((i) => i.token_hash === "new-token"),
          scenario === "valid-invite",
        );
        assert.equal(
          j.invitations.find((i) => i.token_hash === "pending-token")
            .accepted_by,
          scenario === "valid-revoke"
            ? "REVOKED"
            : scenario === "accepted-revoke"
              ? "other-member"
              : null,
        );
        assert.equal(
          j.members.some((m) => m.user === "synthetic-member"),
          !["valid-member", "missing-member"].includes(scenario),
        );
        assert.equal(
          j.members.some((m) => m.user === "synthetic-owner"),
          true,
        );
        assert.equal(
          j.invitations.find((i) => i.token_hash === "accepted-token")
            .accepted_by,
          scenario === "valid-member" ? "REVOKED" : "synthetic-member",
        );
      },
    );
  }
  console.log(
    JSON.stringify({
      passed,
      failed: 0,
      scope:
        "Actual save() in isolated local D1. Competing saves intentionally preload identical revisions; no Meta or production state.",
    }),
  );
} catch (error) {
  console.error(error);
  console.error("Synthetic Worker diagnostics:", logs);
  process.exitCode = 1;
} finally {
  kill();
  await rm(temporary, { recursive: true, force: true });
}
