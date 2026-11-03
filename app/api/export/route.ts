import { identity, load, fail } from "@/lib/server";
import {
  filtered,
  derive,
  assertRole,
  DomainError,
  type Role,
} from "@/lib/domain";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const u = identity(req),
      x = await load(req, u),
      query = new URL(req.url).searchParams,
      preview = query.get("previewRole");
    let selected = x.role,
      access = x.access;
    if (preview && preview !== "owner") {
      assertRole(x.role, ["owner"]);
      if (
        !["helper", "professional", "adviser", "representative"].includes(
          preview,
        )
      )
        throw new DomainError("Invalid preview role.");
      selected = preview as Role;
      access = query.get("access") || "emergency";
    }
    const s = filtered(x.state, selected, access);
    return Response.json(
      {
        format: "hearth.family-plan.v1",
        exportedAt: new Date().toISOString(),
        revision: x.revision,
        state: s,
        summary: derive(s),
        limitations: [
          "Recorded execution is not a legal-validity certification.",
          "A saved wish does not change a beneficiary designation or execute a gift.",
          "No will, court filing, insurance claim, payment or distribution is submitted by this app.",
          "Professional roles are invited roles, not independent qualification checks.",
          "Keep originals and independent export copies; service continuity is not guaranteed.",
        ],
      },
      {
        headers: {
          "Content-Disposition":
            'attachment; filename="hearth-family-plan.json"',
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (e) {
    return fail(e);
  }
}
