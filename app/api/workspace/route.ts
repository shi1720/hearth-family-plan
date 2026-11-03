import type { PlanEffect } from "@/lib/server";
import {
  identity,
  load,
  save,
  payload,
  fail,
  body,
  db,
  sha,
  runtime,
  decrypt,
} from "@/lib/server";
import {
  apply,
  appendEvent,
  DomainError,
  seed,
  emptyPlan,
  assertRole,
  filtered,
  type Role,
} from "@/lib/domain";
import { analyze, reviewPlan, extractDocument } from "@/lib/ai";
import { z } from "zod";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const user = identity(req),
      x = await load(req, user);
    const query = new URL(req.url).searchParams,
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
      const requested = query.get("access");
      access =
        requested &&
        ["emergency", "documents", "administration"].includes(requested)
          ? requested
          : "emergency";
    }
    return Response.json(
      {
        ...(await payload(
          x.state,
          x.revision,
          user,
          selected,
          access,
          x.owner,
        )),
        previewRole: preview || null,
        actualRole: x.role,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return fail(e);
  }
}
export async function POST(req: Request) {
  try {
    const user = identity(req),
      p = await body(req),
      x = await load(req, user);
    let { state, revision } = x;
    if (user.isDemo && (["new-plan", "invite"].includes(p.action) || !state.fixture))
      throw Object.assign(new Error("Sign in with a verified account to create your own plan or invite other people. This private sample is for fictional information."), { status: 403 });
    if (
      x.role === "professional" &&
      x.access !== "administration" &&
      [
        "review-authority",
        "report-death",
        "record-administration",
        "save-ledger",
        "save-claim",
        "save-transaction",
      ].includes(p.action)
    )
      throw Object.assign(
        new Error(
          "This action requires an administration-scoped professional membership.",
        ),
        { status: 403 },
      );
    if (x.role === "professional" && p.action === "save-task") {
      const visible = filtered(state, x.role, x.access).tasks;
      if (p.task?.id && !visible.some((t) => t.id === p.task.id))
        throw Object.assign(
          new Error("That task is outside your permitted professional scope."),
          { status: 403 },
        );
      if (!p.task?.id && x.access === "emergency")
        throw Object.assign(
          new Error("Emergency-only membership cannot create planning tasks."),
          { status: 403 },
        );
    }
    if (x.role === "representative" && x.access !== "administration")
      throw Object.assign(new Error("Administration access is required."), {
        status: 403,
      });
    if (p.revision !== revision)
      throw Object.assign(
        new Error("The plan changed in another tab. Reload before saving."),
        { status: 409 },
      );
    if (state.events.length >= 5000)
      throw new DomainError(
        "Plan history capacity reached. Export and contact the operator.",
      );
    let invitation;
    let effect: PlanEffect | undefined;
    if (p.action === "analyze") {
      assertRole(x.role, ["owner"]);
      if (p.consent !== true)
        throw new DomainError(
          "Confirm permission to send this text to Meta for analysis.",
        );
      if (
        typeof p.text !== "string" ||
        p.text.length < 40 ||
        p.text.length > 30000
      )
        throw new DomainError("Provide 40-30,000 characters of source text.");
      const r = await analyze(x.owner, state.id, p.text);
      const sourceId = crypto.randomUUID();
      state.intakes = [
        ...(state.intakes || []),
        {
          id: sourceId,
          text: p.text,
          sha256: await sha(p.text),
          model: r.model,
          usage: r.usage,
          at: r.createdAt,
        },
      ].slice(-30);
      state.proposals = [
        ...state.proposals,
        ...r.proposals.map((q) => ({ ...q, sourceId })),
      ].slice(-100);
    } else if (p.action === "extract-document") {
      assertRole(x.role, ["owner"]);
      if (p.consent !== true)
        throw new DomainError(
          "Consent is required before sending the attached document to Meta.",
        );
      const d = state.documents.find((d) => d.id === p.id);
      if (!d?.fileId) throw new DomainError("Attach and save a file first.");
      const f: any = await db()
        .prepare("SELECT * FROM files WHERE id=? AND household=?")
        .bind(d.fileId, state.id)
        .first();
      if (!f) throw new DomainError("Private document file not found.");
      const object = await runtime().BUCKET.get(`${state.id}/${d.fileId}`);
      if (!object) throw new DomainError("Original file unavailable.");
      const data = await decrypt(
        new Uint8Array(await object.arrayBuffer()),
        f.iv,
        `file:${state.id}:${d.fileId}`,
      );
      d.extraction = await extractDocument(x.owner, state.id, {
        mime: f.mime,
        name: f.name,
        data,
      });
    } else if (p.action === "accept-transcription") {
      assertRole(x.role, ["owner"]);
      const d = state.documents.find((d) => d.id === p.id);
      if (!d?.extraction || p.confirmed !== true)
        throw new DomainError(
          "Check the transcription against the original before confirming it.",
        );
      if (typeof p.correctedText === "string") {
        if (!p.correctedText.trim() || p.correctedText.length > 30000)
          throw new DomainError("Corrected text must be 1-30,000 characters.");
        d.extraction.text = p.correctedText;
      }
      d.sourceText = d.extraction.text;
      d.extraction.status = "accepted";
    } else if (p.action === "analyze-document") {
      assertRole(x.role, ["owner"]);
      const d = state.documents.find((d) => d.id === p.id);
      if (!d?.sourceText || p.consent !== true)
        throw new DomainError(
          "Confirm the source text and consent to review first.",
        );
      const r = await analyze(x.owner, state.id, d.sourceText);
      const sourceId = crypto.randomUUID();
      state.intakes = [
        ...(state.intakes || []),
        {
          id: sourceId,
          text: d.sourceText,
          sha256: await sha(d.sourceText),
          model: r.model,
          usage: r.usage,
          at: r.createdAt,
        },
      ].slice(-30);
      state.proposals = [
        ...state.proposals,
        ...r.proposals.map((q) => ({ ...q, sourceId })),
      ].slice(-100);
    } else if (p.action === "review-plan") {
      assertRole(x.role, ["owner"]);
      if (p.consent !== true)
        throw new DomainError(
          "Confirm permission to send the plan records to Meta for review.",
        );
      const records = {
        household: state.household,
        people: state.people,
        documents: state.documents.map(({ fileId, ...d }) => d),
        accounts: state.accounts,
        gifts: state.gifts,
        tasks: state.tasks,
      };
      const r = await reviewPlan(x.owner, state.id, records);
      const text = JSON.stringify(records),
        sourceId = crypto.randomUUID();
      state.intakes = [
        ...(state.intakes || []),
        {
          id: sourceId,
          text,
          sha256: await sha(text),
          model: r.model,
          usage: r.usage,
          at: r.createdAt,
        },
      ].slice(-30);
      state.proposals = [
        ...state.proposals,
        ...r.proposals.map((q) => ({ ...q, sourceId })),
      ].slice(-100);
    } else if (p.action === "new-plan") {
      assertRole(x.role, ["owner"]);
      if (p.confirm !== "CREATE MY PLAN")
        throw new DomainError(
          "Confirm CREATE MY PLAN before replacing the current plan.",
        );
      if (!state.fixture)
        throw new DomainError(
          "A personal plan already exists. Edit it instead of replacing it.",
        );
      const q = z
        .object({
          name: z.string().min(2).max(120),
          mode: z.enum(["planning", "helping", "bereaved"]),
        })
        .parse(p);
      const next = emptyPlan(q.name, q.mode);
      next.id = state.id;
      next.events = state.events;
      state = next;
    } else if (p.action === "reset-demo") {
      assertRole(x.role, ["owner"]);
      if (!state.fixture || p.confirm !== "RESET DEMO")
        throw new DomainError("Only the fictional demo can be reset.");
      const next = seed();
      next.id = state.id;
      next.events = state.events;
      state = next;
    } else if (p.action === "invite") {
      assertRole(x.role, ["owner"]);
      const q = z
        .object({
          email: z.string().email(),
          role: z.enum(["helper", "professional", "adviser", "representative"]),
          access: z.enum(["emergency", "documents", "administration"]),
        })
        .parse(p);
      if (
        q.role === "representative" &&
        state.household.stage !== "authority-reviewed"
      )
        throw new DomainError(
          "Review appointment authority before inviting a representative.",
        );
      const token = crypto.randomUUID() + crypto.randomUUID();
      const hash = await sha(token),
        expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
      effect = {
        type: "invite",
        tokenHash: hash,
        email: q.email.toLowerCase(),
        role: q.role,
        access: q.access,
        expiresAt,
      };
      invitation = {
        url: `${new URL(req.url).origin}/?invite=${token}`,
        expiresAt,
      };
    } else {
      if (p.action === "save-document" && p.document?.fileId) {
        const file = await db()
          .prepare("SELECT id FROM files WHERE id=? AND household=?")
          .bind(p.document.fileId, state.id)
          .first();
        if (!file)
          throw new DomainError("That file is not part of this household.");
      }
      state = apply(state, p.action, p, x.role);
    }
    await appendEvent(
      state,
      user.email,
      p.action,
      p.action === "analyze"
        ? "Prepared source-quoted AI proposals; none changes legal or institutional records."
        : p.action === "invite"
          ? "Created a seven-day invitation link; it has not been sent."
          : `Recorded ${String(p.action).replaceAll("-", " ")}.`,
    );
    const nextRevision = await save(state, revision, effect);
    return Response.json(
      {
        ...(await payload(
          state,
          nextRevision,
          user,
          x.role,
          x.access,
          x.owner,
        )),
        ...(invitation ? { invitation } : {}),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e: any) {
    if (e instanceof z.ZodError)
      return fail(
        new DomainError(e.issues.map((i: any) => i.message).join(" ")),
      );
    return fail(e);
  }
}
