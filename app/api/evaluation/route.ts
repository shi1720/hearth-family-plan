import {
  runEvaluation,
  assessLiveOutput,
  LIVE_FIXTURE,
} from "@/lib/evaluation";
import { analyze, reviewPlan } from "@/lib/ai";
import { body, fail, identity, load } from "@/lib/server";
import { assertRole, DomainError } from "@/lib/domain";
export const dynamic = "force-dynamic";

// Public and synthetic only. GET never loads a visitor's household or calls a model.
export async function GET() {
  try {
    return Response.json(await runEvaluation(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return fail(error);
  }
}
export async function POST(req: Request) {
  try {
    const user = identity(req),
      input = await body(req, 4000);
    if (input.consent !== true)
      throw new DomainError(
        "Confirm permission to send the displayed synthetic evaluation source to Meta.",
      );
    if (input.model !== "spark" && input.model !== "wonder")
      throw new DomainError(
        "Choose Muse Spark or Muse Wonder for this evaluation.",
      );
    const workspace = await load(req, user);
    assertRole(workspace.role, ["owner"]);
    const started = performance.now();
    // Do not accept client-supplied source or household records. The fixed fixture
    // uses the same credential lookup, quote validation and request budget as the app.
    const records = {
      fixture: true,
      evaluationSource: LIVE_FIXTURE.sourceText,
    };
    const result =
      input.model === "wonder"
        ? await reviewPlan(workspace.owner, workspace.state.id, records)
        : await analyze(
            workspace.owner,
            workspace.state.id,
            LIVE_FIXTURE.sourceText,
          );
    return Response.json(
      assessLiveOutput({
        exactInput:
          input.model === "wonder"
            ? JSON.stringify(records)
            : LIVE_FIXTURE.sourceText,
        proposals: result.proposals,
        model: result.model,
        usage: result.usage,
        durationMs: performance.now() - started,
      }),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return fail(error);
  }
}
