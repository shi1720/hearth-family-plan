/** Isolated local fixture: forces competing saves from the same preloaded revision. */
import { db, save, type PlanEffect } from "../lib/server";
import { appendEvent, emptyPlan } from "../lib/domain";
export default {
  async fetch(req: Request, env: any) {
    if (
      new URL(req.url).hostname !== "127.0.0.1" ||
      env.HEARTH_PLAN_EFFECTS_TEST !== "synthetic-loopback-only"
    )
      return new Response("Local only", { status: 403 });
    if (new URL(req.url).pathname === "/health")
      return Response.json({ fixture: "hearth-isolated-plan-effects-test" });
    try {
      const { scenario } = (await req.json()) as { scenario: string };
      await db().batch(
        ["audit", "revisions", "invitations", "members", "households"].map(
          (t) => db().prepare(`DELETE FROM ${t}`),
        ),
      );
      const original = emptyPlan("Synthetic transaction fixture");
      original.id = "synthetic-household";
      await db()
        .prepare("INSERT INTO households VALUES(?,?,?,1,?)")
        .bind(
          original.id,
          "synthetic-owner",
          JSON.stringify(original),
          new Date().toISOString(),
        )
        .run();
      await db()
        .prepare("INSERT INTO members VALUES(?,?,'helper','documents',?)")
        .bind(original.id, "synthetic-member", "member@hearth.test")
        .run();
      await db()
        .prepare(
          "INSERT INTO invitations VALUES(?,?,?,'helper','documents',?,NULL)",
        )
        .bind(
          "pending-token",
          original.id,
          "member@hearth.test",
          new Date(Date.now() + 86400000).toISOString(),
        )
        .run();
      await db()
        .prepare(
          "INSERT INTO invitations VALUES(?,?,?,'helper','documents',?,?)",
        )
        .bind(
          "accepted-token",
          original.id,
          "member@hearth.test",
          new Date(Date.now() + 86400000).toISOString(),
          "synthetic-member",
        )
        .run();
      await db()
        .prepare("INSERT INTO members VALUES(?,?,'owner','administration',?)")
        .bind(original.id, "synthetic-owner", "owner@hearth.test")
        .run();
      const invite: PlanEffect = {
        type: "invite",
        tokenHash: "new-token",
        email: "new@hearth.test",
        role: "helper",
        access: "documents",
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      };
      const revoke: PlanEffect = {
        type: "revoke-invitation",
        tokenHash: "pending-token",
      };
      const remove: PlanEffect = {
        type: "remove-member",
        userId: "synthetic-member",
      };
      let effect: PlanEffect | undefined;
      if (scenario.includes("invite") && !scenario.includes("revoke"))
        effect = invite;
      if (scenario.includes("revoke")) effect = revoke;
      if (scenario.includes("member")) effect = remove;
      if (scenario === "owner-removal")
        effect = { type: "remove-member", userId: "synthetic-owner" };
      const winner = structuredClone(original),
        proposed = structuredClone(original);
      await appendEvent(
        winner,
        "owner@hearth.test",
        "winner",
        "Committed winner",
      );
      await appendEvent(
        proposed,
        "owner@hearth.test",
        "proposed",
        "Proposed access change",
      );
      if (scenario.startsWith("stale-")) await save(winner, 1);
      if (scenario === "accepted-revoke")
        await db()
          .prepare(
            "UPDATE invitations SET accepted_by='other-member' WHERE token_hash='pending-token'",
          )
          .run();
      if (scenario === "missing-member")
        await db()
          .prepare("DELETE FROM members WHERE user='synthetic-member'")
          .run();
      if (scenario === "duplicate-invite")
        effect = { ...invite, tokenHash: "pending-token" };
      let status = 200;
      try {
        await save(proposed, 1, effect);
      } catch (error: any) {
        status = error.status || 500;
      }
      const row: any = await db()
        .prepare("SELECT state,revision FROM households WHERE id=?")
        .bind(original.id)
        .first();
      const audit = await db().prepare("SELECT id,event FROM audit").all();
      const snapshots = await db()
        .prepare("SELECT revision,state FROM revisions")
        .all();
      const invitations = await db()
        .prepare(
          "SELECT token_hash,accepted_by FROM invitations ORDER BY token_hash",
        )
        .all();
      const members = await db().prepare("SELECT user FROM members").all();
      return Response.json({
        status,
        revision: row.revision,
        state: JSON.parse(row.state),
        original,
        winner,
        proposed,
        audit: audit.results,
        snapshots: snapshots.results,
        invitations: invitations.results,
        members: members.results,
      });
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 500 });
    }
  },
};
