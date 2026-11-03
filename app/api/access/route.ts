import type { PlanEffect } from "@/lib/server";
import { identity, load, db, body, fail, save } from "@/lib/server";
import { assertRole, appendEvent, DomainError } from "@/lib/domain";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const u = identity(req),
      x = await load(req, u);
    assertRole(x.role, ["owner"]);
    const [members, invitations] = await Promise.all([
      db()
        .prepare("SELECT user,email,role,access FROM members WHERE household=?")
        .bind(x.state.id)
        .all(),
      db()
        .prepare(
          "SELECT token_hash AS tokenHash,email,role,access,expires_at AS expiresAt,accepted_by AS acceptedBy FROM invitations WHERE household=?",
        )
        .bind(x.state.id)
        .all(),
    ]);
    return Response.json(
      { members: members.results, invitations: invitations.results },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return fail(e);
  }
}
export async function POST(req: Request) {
  try {
    const u = identity(req),
      x = await load(req, u),
      p = await body(req);
    assertRole(x.role, ["owner"]);
    if (p.revision !== x.revision)
      throw Object.assign(
        new Error("Plan revision changed. Reload before changing access."),
        { status: 409 },
      );
    let effect: PlanEffect;
    if (p.action === "revoke-invitation") {
      if (typeof p.tokenHash !== "string" || p.tokenHash.length !== 64)
        throw new DomainError("Invalid invitation identifier.");
      effect = { type: "revoke-invitation", tokenHash: p.tokenHash };
    } else if (p.action === "remove-member") {
      if (typeof p.userId !== "string" || p.userId === x.owner)
        throw new DomainError("The owner cannot be removed.");
      effect = { type: "remove-member", userId: p.userId };
    } else throw new DomainError("Unsupported access change.");
    await appendEvent(
      x.state,
      u.email,
      p.action,
      "Owner revoked the specified access; no message was sent.",
    );
    await save(x.state, x.revision, effect);
    return Response.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return fail(e);
  }
}
