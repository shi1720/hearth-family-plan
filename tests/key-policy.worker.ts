/** Local-only test harness. Not a product route and not imported by the app. */
import { db, getKey, hasKey, identity, putKey } from "../lib/server";
import { emptyPlan } from "../lib/domain";
const shared = "SYNTHETIC_SHARED_KEY_NEVER_CALL_A_MODEL";
const own = "SYNTHETIC_PERSONAL_KEY_NEVER_CALL_A_MODEL";
const fixtures: Array<{
  owner: string;
  email: string;
  fixture: boolean;
  role?: string;
}> = [
  {
    owner: "firebase:operator-fixture",
    email: "operator@hearth.test",
    fixture: false,
  },
  {
    owner: "firebase:operator-professional-only",
    email: "operator@hearth.test",
    fixture: true,
    role: "professional",
  },
  {
    owner: "firebase:ordinary-real",
    email: "ordinary-real@hearth.test",
    fixture: false,
  },
  {
    owner: "firebase:ordinary-fixture",
    email: "ordinary-fixture@hearth.test",
    fixture: true,
  },
  {
    owner: "firebase:demo-real",
    email: "demo-real@demo.hearth.invalid",
    fixture: false,
  },
  {
    owner: "untrusted-demo-id",
    email: "untrusted-demo-id@demo.hearth.invalid",
    fixture: true,
  },
  {
    owner: "firebase:legitimate-guest",
    email: "legitimate-guest@demo.hearth.invalid",
    fixture: true,
  },
  {
    owner: "firebase:personal-key",
    email: "personal-key@hearth.test",
    fixture: false,
  },
  ...Array.from({ length: 32 }, (_, i) => ({
    owner: `firebase:quota-${i}`,
    email: `quota-${i}@demo.hearth.invalid`,
    fixture: true,
  })),
];
function classify(value: string) {
  return value === shared
    ? "shared"
    : value === own
      ? "personal"
      : "unexpected";
}
async function count() {
  const row: any = await db()
    .prepare("SELECT count(*) AS count FROM model_runs WHERE household=?")
    .bind("__public_demo__")
    .first();
  return Number(row.count);
}
export default {
  async fetch(req: Request, env: any) {
    if (
      !["127.0.0.1", "localhost", "[::1]"].includes(
        new URL(req.url).hostname,
      ) ||
      env.HEARTH_KEY_POLICY_TEST !== "synthetic-loopback-only"
    )
      return new Response("Local synthetic test only.", { status: 403 });
    const path = new URL(req.url).pathname;
    try {
      if (path === "/health")
        return Response.json({ fixture: "hearth-isolated-key-policy-test" });
      if (path === "/setup" && req.method === "POST") {
        await db().batch(
          [
            "DELETE FROM model_runs",
            "DELETE FROM credentials",
            "DELETE FROM members",
            "DELETE FROM households",
          ].map((sql) => db().prepare(sql)),
        );
        for (const f of fixtures) {
          const s = emptyPlan("Synthetic key policy fixture");
          s.fixture = f.fixture;
          const household = `fixture-${f.owner.replaceAll(":", "-")}`;
          await db().batch([
            db()
              .prepare(
                "INSERT INTO households(id,owner,state,revision,updated_at) VALUES(?,?,?,1,?)",
              )
              .bind(
                household,
                f.owner,
                JSON.stringify(s),
                new Date().toISOString(),
              ),
            db()
              .prepare(
                "INSERT INTO members(household,user,role,access,email) VALUES(?,?,?,?,?)",
              )
              .bind(
                household,
                f.owner,
                f.role || "owner",
                "administration",
                f.email,
              ),
          ]);
        }
        await putKey("firebase:personal-key", own);
        return Response.json({
          fixtures: fixtures.length,
          externalModelCalls: 0,
        });
      }
      if (path === "/identity") {
        const u = identity(req);
        return Response.json({ id: u.id, email: u.email, isDemo: u.isDemo });
      }
      if (req.method !== "POST")
        return new Response("Not found.", { status: 404 });
      const input: any = await req.json();
      if (path === "/lookup" || path === "/availability") {
        if (!fixtures.some((f) => f.owner === input.owner))
          return new Response("Unknown synthetic fixture.", { status: 400 });
        const configured = await hasKey(input.owner);
        if (path === "/availability") return Response.json({ configured });
        const key = await getKey(input.owner);
        return Response.json({
          configured,
          keyKind: classify(key),
          globalReserved: await count(),
          externalModelCalls: 0,
        });
      }
      if (path === "/personal-ciphertext") {
        const row: any = await db()
          .prepare("SELECT ciphertext,iv FROM credentials WHERE owner=?")
          .bind("firebase:personal-key")
          .first();
        return Response.json({
          encrypted:
            !!row && row.ciphertext !== own && atob(row.ciphertext) !== own,
          ivPresent: typeof row?.iv === "string" && row.iv.length > 0,
        });
      }
      if (path === "/concurrent-budget") {
        await db()
          .prepare("DELETE FROM model_runs WHERE household=?")
          .bind("__public_demo__")
          .run();
        const results = await Promise.all(
          fixtures
            .filter((f) => f.owner.startsWith("firebase:quota-"))
            .map(async (f) => {
              try {
                return {
                  owner: f.owner,
                  success: true,
                  keyKind: classify(await getKey(f.owner)),
                  status: 200,
                };
              } catch (e) {
                return {
                  owner: f.owner,
                  success: false,
                  keyKind: null,
                  status: (e as { status?: number }).status ?? 500,
                };
              }
            }),
        );
        return Response.json({
          results,
          globalReserved: await count(),
          externalModelCalls: 0,
        });
      }
      return new Response("Not found.", { status: 404 });
    } catch (e) {
      return Response.json(
        {
          error: (e as Error).message,
          status: (e as { status?: number }).status ?? 500,
          keyReturned: false,
        },
        { status: (e as { status?: number }).status ?? 500 },
      );
    }
  },
};
