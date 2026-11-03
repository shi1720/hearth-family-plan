import { identity, load, fail } from "@/lib/server";
import { filtered } from "@/lib/domain";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const u = identity(req),
      x = await load(req, u),
      s = filtered(x.state, x.role, x.access);
    const lines = [
      "HEARTH | FACTUAL BRIEF FOR PROFESSIONAL REVIEW",
      `Prepared ${new Date().toISOString()}`,
      s.fixture
        ? "FICTIONAL DEMONSTRATION | NOT FOR REAL EXECUTION"
        : "DRAFT WORKING PAPERS | NOT A WILL, LEGAL OPINION OR EXECUTED INSTRUCTION",
      "",
      `Person: ${s.household.personName}`,
      `Initial jurisdiction: ${s.household.jurisdiction}`,
      `Recorded stage: ${s.household.stage}`,
      "",
      "PEOPLE AND PROPOSED RESPONSIBILITIES",
      ...s.people.map(
        (p) =>
          `${p.name} | ${p.role} | ${p.status}\nPractical note: ${p.note || "Not recorded"}\nA proposed role or acknowledgment does not establish a legal appointment.`,
      ),
      "",
      "DOCUMENTS AND ORIGINALS",
      ...s.documents.map(
        (d) =>
          `${d.title} | ${d.kind} | recorded ${d.status}\nOriginal location: ${d.originalLocation || "Unknown"}\nReported execution evidence: ${d.executionEvidence || "Not recorded"}\nNotes: ${d.notes || "None"}\nThis record does not certify validity, witnessing, capacity or the absence of a later document.`,
      ),
      "",
      "ACCOUNT AND POLICY RECORDS",
      ...s.accounts.map(
        (a) =>
          `${a.name} | ${a.kind} | ${a.institution} | ending ${a.lastFour || "not recorded"}\nEvidence level: ${a.verification}\nRecorded instruction: ${a.beneficiarySummary || "Unknown"}\nPerson’s recorded wish: ${a.desiredSummary || "Not recorded"}\nEvidence/review notes: ${a.notes || "None"}\nDo not assume a will overrides this institution’s valid beneficiary or ownership record.`,
      ),
      "",
      "OPTIONAL GIVING INTENTIONS",
      ...s.gifts.map(
        (g) =>
          `${g.recipient} | ${g.cause || "Cause not recorded"}\nIdentifier supplied: ${g.registrationId || "Not recorded"}\nRecorded intention: ${g.intention || "Not recorded"}\nProposed route: ${g.route}; stage: ${g.status}\nEvidence: ${g.evidence || "Not recorded"}\nAn app preference alone is not an executed gift or receipt.`,
      ),
      "",
      "OPEN REVIEW AND ADMINISTRATIVE ACTIONS",
      ...s.tasks
        .filter((t) => t.status !== "complete")
        .map(
          (t) =>
            `${t.title}\nResponsible person: ${t.owner || "Not assigned"}\nInstructions: ${t.detail || "Review scope and required completion evidence."}\nRecorded deadline: ${t.dueAt || "None; confirm any actual deadline."}\nSource quote, if any: ${t.sourceQuote || "Not applicable"}`,
        ),
      "",
      "REVIEWER CHECKLIST",
      "Confirm engagement, professional qualifications, applicable jurisdiction, authority and permitted disclosures.",
      "Reconcile the controlling documents, original locations, ownership and current institution records. Verify actual execution and any later changes through the proper process.",
      "Record unresolved interpretations, missing evidence, decisions and the specific authorised institution/signing/filing route. Obtain required signatures or approvals separately.",
      "Hearth did not contact any institution or professional, file documents, determine entitlement, or transfer money when this brief was prepared.",
      "",
      "PRIMARY WORKFLOW SOURCES",
      ...s.sources.map((source) => `${source.title}\n${source.url}`),
      "",
      `Permission-filtered view: ${x.role} / ${x.access}. Private records outside this view are omitted.`,
    ];
    return new Response(lines.join("\n\n"), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="hearth-professional-review-brief.txt"',
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return fail(e);
  }
}
