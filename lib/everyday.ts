export const pageFragments = {
  Home: "home",
  People: "people",
  Documents: "documents",
  "Accounts & policies": "accounts",
  Giving: "giving",
  "When needed": "when-needed",
  Practice: "practice",
} as const;
export type PlanView = keyof typeof pageFragments;
export function viewFromFragment(fragment: string): PlanView | null {
  const slug = fragment.replace(/^#/, "");
  return (Object.keys(pageFragments) as PlanView[]).find(view => pageFragments[view] === slug) || null;
}
type Row = Record<string, any>;
export type FindResult = {
  key: string; label: string; detail: string; view: PlanView;
  kind: "page" | "person" | "document" | "account" | "gift" | "task" | "claim" | "transaction";
  record?: Row;
};
const normalize = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const pageHints: Record<PlanView, string> = {
  Home: "Your family plan",
  People: "Trusted people, roles and access",
  Documents: "Originals, attachments and source reviews",
  "Accounts & policies": "Banking, insurance and beneficiary records",
  Giving: "Causes and optional giving intentions",
  "When needed": "After a death, authority, claims and estate money",
  Practice: "Service, business value and sources",
};
/** Search only the meaningful fields in the already permission-filtered workspace. */
export function findInPlan(state: Row, query: string): FindResult[] {
  const pages: FindResult[] = (Object.keys(pageFragments) as PlanView[]).map(view => ({
    key: "page-" + pageFragments[view], label: view, detail: pageHints[view], kind: "page", view,
  }));
  const q = normalize(query);
  if (!q) return pages;
  const records: FindResult[] = [];
  function add(items: Row[] | undefined, kind: FindResult["kind"], view: PlanView, label: (r: Row) => string, detail: (r: Row) => string) {
    for (const record of items || []) {
      const title = label(record);
      if (title) records.push({key: kind + "-" + record.id, label: title, detail: detail(record), kind, view, record});
    }
  }
  add(state.people, "person", "People", r => r.name, r => ["Person", r.email].filter(Boolean).join(" · "));
  add(state.documents, "document", "Documents", r => r.title, r => ["Document", r.fileName].filter(Boolean).join(" · "));
  add(state.accounts, "account", "Accounts & policies", r => r.name, r => ["Account or policy", r.institution].filter(Boolean).join(" · "));
  add(state.gifts, "gift", "Giving", r => r.recipient, r => ["Giving intention", r.cause].filter(Boolean).join(" · "));
  add(state.tasks, "task", "People", r => r.title, r => ["Next step", r.owner].filter(Boolean).join(" · "));
  for (const result of records) if (result.kind === "task") {
    result.view = ({planning:"People", documents:"Documents", accounts:"Accounts & policies", giving:"Giving", administration:"When needed"} as Record<string, PlanView>)[result.record?.category] || "People";
  }
  add(state.claims, "claim", "When needed", r => r.institution, r => ["Insurance claim", r.claimant].filter(Boolean).join(" · "));
  add(state.ledger?.entries, "transaction", "When needed", r => r.description, r => ["Money record", r.payee].filter(Boolean).join(" · "));
  const terms = q.split(/\s+/);
  return [...pages, ...records].filter(r => terms.every(term => normalize(r.label + " " + r.detail).includes(term)))
    .sort((a,b) => Number(normalize(b.label).startsWith(q)) - Number(normalize(a.label).startsWith(q)))
    .slice(0,12);
}
export function taskTiming(dueAt: string | null | undefined, status: string, now: Date): "overdue" | "today" | "upcoming" | null {
  if (!dueAt || status === "complete") return null;
  const due = new Date(dueAt);
  if (!Number.isFinite(due.getTime())) return null;
  if (due.getTime() < now.getTime()) return "overdue";
  return due.getFullYear() === now.getFullYear() && due.getMonth() === now.getMonth() && due.getDate() === now.getDate() ? "today" : "upcoming";
}
