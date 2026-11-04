"use client";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import charityProfiles from "@/lib/charity-profiles.json";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCheck,
  ChevronRight,
  CircleAlert,
  Clock3,
  Copy,
  FileText,
  FolderHeart,
  Heart,
  Home,
  Leaf,
  LoaderCircle,
  LockKeyhole,
  Menu,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Upload,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Users,
  WalletCards,
  X,
} from "lucide-react";
type Item = Record<string, any>;
const ReadOnlyContext = createContext(false);
async function responseData(response: Response): Promise<any> { try { return await response.json(); } catch { throw new Error(response.status >= 500 ? "The service is temporarily unavailable. Your saved records have not been replaced. Please try again." : "The service returned an unexpected response. Please reload your plan before continuing."); } }
type View =
  | "Home"
  | "People"
  | "Documents"
  | "Accounts & policies"
  | "Giving"
  | "When needed"
  | "Practice";
type Workspace = {
  state: Item;
  revision: number;
  user: { name: string; email: string; role: string; isDemo?: boolean };
  provider: { configured: boolean; model: string };
  derived: Item;
};
const nav = [
  ["Home", Home],
  ["People", Users],
  ["Documents", FileText],
  ["Accounts & policies", WalletCards],
  ["Giving", Leaf],
  ["When needed", FolderHeart],
  ["Practice", BookOpen],
] as const;
const statusLabels: Record<string, string> = {
  "document-only": "From a document",
  "owner-confirmed": "Owner confirmed",
  "institution-confirmed": "Institution confirmed",
  draft: "Draft recorded",
  executed: "Execution recorded",
  superseded: "Superseded",
  proposed: "Role proposed",
  accepted: "Acknowledgement recorded",
  intention: "Intention saved",
  reviewed: "Review recorded",
  received: "Receipt recorded",
  open: "Next step",
  "professional-review": "Professional review",
  complete: "Evidence recorded",
  private: "Only you",
  helper: "Permitted helper",
  professional: "Professional only",
  "death-reported": "Death reported",
  "authority-reviewed": "Authority review recorded",
  living: "Planning ahead",
  preparing: "Preparing claim",
  submitted: "Submission recorded",
  "information-requested": "Information requested",
  approved: "Insurer approval recorded",
  paid: "Payment recorded",
  disputed: "Disputed outcome",
  confirmed: "Confirmed record",
};
const localInput = (v?: string | null) =>
  v
    ? new Date(new Date(v).getTime() - new Date(v).getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
    : "";
const money = (v: string | number | undefined, currency = "USD") => {
  try {
    return Number(v || 0).toLocaleString(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    return `${currency} ${v || "0.00"}`;
  }
};
const date = (v?: string) =>
  v
    ? new Date(v).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Not recorded";
const defaultForms: Record<string, Item> = {
  person: {
    name: "",
    email: "",
    role: "helper",
    status: "proposed",
    access: "emergency",
    note: "",
  },
  document: {
    title: "",
    kind: "will",
    status: "draft",
    originalLocation: "",
    executionEvidence: "",
    notes: "",
    visibility: "private",
    sourceText: "",
  },
  account: {
    name: "",
    kind: "bank",
    institution: "",
    reference: "",
    lastFour: "",
    verification: "document-only",
    beneficiarySummary: "",
    desiredSummary: "",
    notes: "",
    visibility: "private",
  },
  gift: {
    recipient: "",
    registrationId: "",
    url: "",
    cause: "",
    intention: "",
    route: "undecided",
    status: "intention",
    evidence: "",
    visibility: "private",
  },
  task: {
    title: "",
    category: "planning",
    owner: "",
    status: "open",
    evidence: "",
    dueAt: "",
  },
  invite: { email: "", role: "helper", access: "emergency" },
  death: { evidence: "" },
  authority: {
    deathEvidence: "",
    identityEvidence: "",
    appointmentEvidence: "",
    reviewer: "",
  },
  extract: { id: "", consent: false },
  "read-doc": { id: "", confirmed: false },
  "analyze-doc": { id: "", consent: false },
  review: { consent: false },
  analysis: { text: "", consent: false },
  acknowledge: { id: "", evidence: "" },
  new: {
    name: "",
    jurisdiction: "Florida",
    mode: "planning",
    confirm: "CREATE MY PLAN",
  },
  preferences: { contactFrequency: "Only when I ask", privateNote: "" },
  claim: {
    accountId: "",
    claimant: "",
    institution: "",
    claimantAuthority: "",
    status: "preparing",
    reference: "",
    requirements: "",
    nextAction: "",
    deadline: "",
    submissionEvidence: "",
    paymentEvidence: "",
    amount: "0.00",
    currency: "USD",
    visibility: "private",
  },
  ledger: {
    openingBalance: "0.00",
    currency: "USD",
    openingEvidence: "",
    reserve: "0.00",
  },
  transaction: {
    type: "expense",
    amount: "0.00",
    payee: "",
    description: "",
    status: "proposed",
    evidence: "",
  },
  provider: { apiKey: "" },
};
function Badge({ value, children }: { value?: string; children?: ReactNode }) {
  return (
    <span className={`badge ${value || "neutral"}`}>
      <i />
      {children || statusLabels[value || ""] || value}
    </span>
  );
}
function Panel({
  title,
  eyebrow,
  action,
  children,
  className = "",
}: {
  title?: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {(title || action) && (
        <div className="panel-head">
          <div>
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <h2>{title}</h2>
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
function Button({
  children,
  onClick,
  secondary = false,
  disabled = false,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  secondary?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      className={`button ${secondary ? "secondary" : ""}`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
function Visibility({ value }: { value: string }) {
  return (
    <span className="visibility">
      <LockKeyhole size={11} />
      {statusLabels[value] || value}
    </span>
  );
}
function Empty({
  icon: Icon,
  title,
  text,
  action,
}: {
  icon: any;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span>
        <Icon size={27} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
function Field({
  label,
  name,
  form,
  setForm,
  kind = "text",
  options,
  help,
  required = false,
}: {
  label: string;
  name: string;
  form: Item;
  setForm: (v: Item) => void;
  kind?: string;
  options?: [string, string][];
  help?: string;
  required?: boolean;
}) {
  const readOnly = useContext(ReadOnlyContext);
  const id = `field-${name}`;
  return (
    <label className="field" htmlFor={id}>
      <span>
        {label}
        {required && <em> *</em>}
      </span>
      {options ? (
        <select
          id={id}
          value={form[name] ?? ""}
          disabled={readOnly}
          onChange={(e) => setForm({ ...form, [name]: e.target.value })}
        >
          {options.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      ) : kind === "textarea" ? (
        <textarea
          id={id}
          rows={3}
          required={required}
          value={form[name] ?? ""}
          readOnly={readOnly}
          onChange={(e) => setForm({ ...form, [name]: e.target.value })}
        />
      ) : (
        <input
          id={id}
          type={kind}
          required={required}
          value={form[name] ?? ""}
          readOnly={readOnly}
          onChange={(e) => setForm({ ...form, [name]: e.target.value })}
        />
      )}{" "}
      {help && <small>{help}</small>}
    </label>
  );
}
const visibilityOptions: [string, string][] = [
  ["private", "Only me"],
  ["helper", "Permitted helper"],
  ["professional", "Professional only"],
];
export default function Hearth() {
  const [data, setData] = useState<Workspace | null>(null),
    [view, setView] = useState<View>("Home"),
    [busy, setBusy] = useState("load"),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [authRequired, setAuthRequired] = useState(false),
    [modal, setModal] = useState(""),
    [form, setForm] = useState<Item>({}),
    [mobile, setMobile] = useState(false),
    [search, setSearch] = useState(""),
    [invite, setInvite] = useState<Item | null>(null),
    [inviteToken, setInviteToken] = useState(""),
    [invitationUrl, setInvitationUrl] = useState(""),
    [uploading, setUploading] = useState(false),
    [fee, setFee] = useState(18000),
    [hourly, setHourly] = useState(60),
    [beforeHours, setBeforeHours] = useState(500),
    [afterHours, setAfterHours] = useState(180);
  const [accessData, setAccessData] = useState<Item>({
      members: [],
      invitations: [],
    }),
    [accessBusy, setAccessBusy] = useState(""),
    [accessConfirm, setAccessConfirm] = useState<Item | null>(null);
  const [compactNav, setCompactNav] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [discardPrompt, setDiscardPrompt] = useState(false);
  const [draggingFile, setDraggingFile] = useState(false);
  const [offline, setOffline] = useState(false);
  const originalForm = useRef("");
  const closeFormRef = useRef<() => void>(() => {});
  const hasUnsavedChanges = useRef(false);
  useEffect(() => {
    try { setCollapsed(localStorage.getItem("hearth.sidebar.collapsed") === "true"); } catch {}
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    const beforeLeave = (event: BeforeUnloadEvent) => {
      if (hasUnsavedChanges.current) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", beforeLeave);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      window.removeEventListener("beforeunload", beforeLeave);
    };
  }, []);
  function toggleSidebar() {
    setCollapsed(value => {
      const next = !value;
      try { localStorage.setItem("hearth.sidebar.collapsed", String(next)); } catch {}
      return next;
    });
  }
  const [previewRole, setPreviewRole] = useState("owner"),
    [previewAccess, setPreviewAccess] = useState("documents"),
    [ownerAccess, setOwnerAccess] = useState(false);
  useEffect(()=>{const media=window.matchMedia("(max-width: 1000px)");const update=()=>{setCompactNav(media.matches);if(!media.matches)setMobile(false);};update();media.addEventListener("change",update);return()=>media.removeEventListener("change",update);},[]);
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(""), 8000); return () => window.clearTimeout(timer); }, [notice]);
  const fileRef = useRef<HTMLInputElement>(null);
  const loadSequence = useRef(0);
  const menuRef = useRef<HTMLButtonElement>(null);
  const navigationTrigger = useRef<HTMLButtonElement | null>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  function closeNavigation() {
    setMobile(false);
    window.setTimeout(() => (navigationTrigger.current || menuRef.current)?.focus(), 0);
  }
  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement as HTMLElement | null;
    const timer = window.setTimeout(() => {
      const dialog = document.querySelector<HTMLElement>(".modal");
      const target = dialog?.querySelector<HTMLElement>("input:not([type=file]):not([disabled]),textarea:not([disabled]),select:not([disabled])") || dialog?.querySelector<HTMLElement>("button:not([disabled])");
      target?.focus();
    }, 0);
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") {
        closeFormRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const nodes = Array.from(
        document.querySelectorAll<HTMLElement>(
          ".modal button:not([disabled]),.modal input:not([type=file]):not([disabled]),.modal textarea:not([disabled]),.modal select:not([disabled]),.modal a[href]",
        ),
      );
      const first = nodes[0],
        last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener("keydown", key);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", key);
      if (previous?.isConnected && previous.getClientRects().length) previous.focus(); else menuRef.current?.focus();
    };
  }, [modal]);
  function showSignIn() {
    setAuthRequired(true);
    setData(null);
    setOwnerAccess(false);
    setError("");
    setNotice("");
    setModal("");
    setInvite(null);
  }
  async function load(roleOverride?: string, accessOverride?: string) {
    const requestId = ++loadSequence.current;
    const selected = roleOverride || previewRole,
      access = accessOverride || previewAccess;
    if (roleOverride || accessOverride) setData(null);
    setBusy("load");
    setError("");
    try {
      const path =
        selected === "owner"
          ? "/api/workspace"
          : `/api/workspace?previewRole=${encodeURIComponent(selected)}&access=${encodeURIComponent(access)}`;
      const r = await fetch(path, { cache: "no-store", signal: AbortSignal.timeout(30000) });
      if (requestId !== loadSequence.current) return;
      if (r.status === 401) {
        showSignIn();
        return;
      }
      const j: any = await responseData(r);
      if (!r.ok) throw Error(j.error || "Your plan could not be opened.");
      setAuthRequired(false);
      if (requestId !== loadSequence.current) return;
      setData(j);
      if (selected === "owner") setOwnerAccess(j.user?.role === "owner");
    } catch (e) {
      if (requestId === loadSequence.current) setError(e instanceof Error && e.name === "TimeoutError" ? "Your plan is taking longer than expected to load. Please try again." : e instanceof Error ? e.message : "Connection unavailable");
    } finally {
      if (requestId === loadSequence.current) setBusy("");
    }
  }
  useEffect(() => {
    load();
    const token = new URLSearchParams(location.search).get("invite");
    if (token) {
      setInviteToken(token);
      fetch(`/api/invitations?token=${encodeURIComponent(token)}`)
        .then(async (r) => {
          if (r.status === 401) {
            showSignIn();
            return;
          }
          const j: any = await responseData(r);
          if (!r.ok) throw Error(j.error || "Invitation unavailable");
          setInvite(j);
        })
        .catch((e) => setError(e.message));
    }
  }, []);
  async function action(name: string, payload: Item = {}): Promise<boolean> {
    if (!data || busy) return false;
    if (offline) { setError("You are offline. Reconnect before saving a change."); return false; }
    if (previewRole !== "owner") {
      setError(
        "This is a read-only permission preview. Return to your own view before making changes.",
      );
      return false;
    }
    setBusy(name);
    setError("");
    setNotice("");
    try {
      const r = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: name,
          revision: data?.revision,
          ...payload,
        }),
      });
      if (r.status === 401) {
        showSignIn();
        return false;
      }
      const j: any = await responseData(r);
      if (!r.ok) throw Error(j.error || "This change could not be saved.");
      setData(j);
      if (name === "new-plan") { setView("Home"); setSearch(""); }
      if (j.invitation) setInvitationUrl(j.invitation.url);
      setNotice(j.message || "Saved to your private family plan.");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save this change");
      return false;
    } finally {
      setBusy("");
    }
  }
  function open(name: string, value: Item = {}) {
    if (!data) return;
    setMobile(false);
    if (data.user.isDemo && ["new", "invite"].includes(name)) { setError("Sign in with Google or a verified email to create your own plan or share it. Your private sample remains available to explore."); return; }
    const d =
      name === "read-doc" ? documents.find((d) => d.id === value.id) : null;
    const initialForm = {
      ...defaultForms[name],
      ...(d?.extraction ? { correctedText: d.extraction.text } : {}),
      ...value,
      ...(name === "task" && value.dueAt ? {dueAt:localInput(value.dueAt)} : {}),
      ...(name === "claim" && value.deadline ? {deadline:localInput(value.deadline)} : {}),
    };
    originalForm.current = JSON.stringify(initialForm);
    setDiscardPrompt(false);
    setDraggingFile(false);
    setForm(initialForm);
    setModal(name);
    setError("");
    setInvitationUrl("");
  }
  function navigate(next: string) {
    const mapped: Record<string, View> = {
      home: "Home",
      people: "People",
      documents: "Documents",
      accounts: "Accounts & policies",
      giving: "Giving",
      administration: "When needed",
      whenNeeded: "When needed",
      "when-needed": "When needed",
      practice: "Practice",
    };
    next = mapped[next] || next;
    if (nav.some(([n]) => n === next)) setView(next as View);
    setMobile(false);
    setSearch("");
    window.scrollTo({top:0,behavior:"instant"});
    if (mobile) window.setTimeout(() => document.getElementById("main")?.focus({preventScroll:true}), 0);
  }
  const state: Item = data?.state || {},
    derived: Item = data?.derived || {},
    people: Item[] = state.people || [],
    documents: Item[] = state.documents || [],
    accounts: Item[] = state.accounts || [],
    claims: Item[] = state.claims || [],
    gifts: Item[] = state.gifts || [],
    tasks: Item[] = state.tasks || [],
    events: Item[] = state.events || [];
  const household = state.household || {},
    personName = household.personName || "your family",
    firstName = personName.split(" ")[0],
    role = data?.user?.role || "owner",
    isDemo = !!data?.user?.isDemo,
    owner = role === "owner" && previewRole === "owner",
    canReview =
      previewRole === "owner" && ["owner", "professional"].includes(role),
    effectiveRole = previewRole !== "owner" ? previewRole : role,
    ledgerVisible = ["owner", "professional", "representative"].includes(
      effectiveRole,
    ),
    canRecordMoney =
      previewRole === "owner" &&
      ["owner", "professional", "representative"].includes(role);
  const ledger: Item = state.ledger || {},
    ledgerDerived: Item = derived.ledger || {},
    transactions: Item[] = ledger.entries || [];
  const activeDocument = documents.find((d) => d.id === form.id);
  const canReviewAuthority = previewRole === "owner" && household.stage === "death-reported" && (role === "professional" || (state.fixture && role === "owner"));
  const modalEditable = !!data && previewRole === "owner" && (modal === "authority" ? canReviewAuthority : ["claim","ledger"].includes(modal) ? canReview : modal === "transaction" ? canRecordMoney : modal === "task" ? ["owner","professional"].includes(role) || (role === "representative" && form.category === "administration" && household.stage === "authority-reviewed") : owner) && !(isDemo && ["new","invite"].includes(modal));
  hasUnsavedChanges.current = !!modal && modalEditable && !["extract", "review", "analyze-doc"].includes(modal) && !(modal === "read-doc" && activeDocument?.extraction?.status === "accepted") && !(modal === "invite" && invitationUrl) && JSON.stringify(form) !== originalForm.current;
  closeFormRef.current = () => {
    if (busy || uploading) return;
    if (discardPrompt) { setDiscardPrompt(false); return; }
    if (hasUnsavedChanges.current) {
      setDiscardPrompt(true);
      window.setTimeout(() => document.querySelector<HTMLButtonElement>(".discard-confirmation button:last-child")?.focus(), 0);
      return;
    }
    setModal("");
  };
  const signInPath = `/sign-in?return_to=${encodeURIComponent(inviteToken ? `/?invite=${encodeURIComponent(inviteToken)}` : "/")}`;
  async function signOut(){setBusy("sign-out");setError("");try{const r=await fetch("/api/auth/sign-out",{method:"POST"});if(!r.ok)throw Error("We could not sign you out. Please try again.");window.location.assign("/sign-in");}catch(e){setError(e instanceof Error?e.message:"Sign-out is unavailable. Please retry.");}finally{setBusy("");}}
  useEffect(()=>{if(!mobile&&!modal)return;const previous=document.body.style.overflow;document.body.style.overflow="hidden";return()=>{document.body.style.overflow=previous;};},[mobile,modal]);
  useEffect(()=>{if(!mobile)return;const node=sidebarRef.current;const first=node?.querySelector<HTMLElement>("button:not([disabled]),a[href]");const timer=window.setTimeout(()=>first?.focus(),0);function key(e:KeyboardEvent){if(e.key==="Escape"){closeNavigation();return;}if(e.key!=="Tab")return;const nodes=Array.from(node?.querySelectorAll<HTMLElement>("button:not([disabled]),a[href]")||[]);const start=nodes[0],end=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===start){e.preventDefault();end?.focus();}else if(!e.shiftKey&&document.activeElement===end){e.preventDefault();start?.focus();}}document.addEventListener("keydown",key);return()=>{clearTimeout(timer);document.removeEventListener("keydown",key);};},[mobile]);
  async function loadAccess() {
    if (!owner || isDemo || previewRole !== "owner") return;
    setAccessBusy("load");
    try {
      const r = await fetch("/api/access", { cache: "no-store" });
      const j: any = await responseData(r);
      if (!r.ok) throw Error(j.error || "Access records could not be loaded.");
      setAccessData(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Access records unavailable");
    } finally {
      setAccessBusy("");
    }
  }
  useEffect(() => {
    if (view === "People" && owner && !isDemo && previewRole === "owner") loadAccess();
  }, [view, owner, isDemo, previewRole, data?.revision]);
  async function changeAccess() {
    if (!accessConfirm || !owner || isDemo || previewRole !== "owner") return;
    setAccessBusy(accessConfirm.action);
    setError("");
    try {
      const r = await fetch("/api/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...accessConfirm, revision: data?.revision }),
      });
      const j: any = await responseData(r);
      if (!r.ok) throw Error(j.error || "Access could not be changed.");
      setAccessConfirm(null);
      await load();
      await loadAccess();
      setNotice(
        "Workspace access updated. This does not change any legal appointment.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Access change failed");
    } finally {
      setAccessBusy("");
    }
  }
  const filtered = (list: Item[]) =>
    list.filter((v) =>
      JSON.stringify(v).toLowerCase().includes(search.toLowerCase()),
    );
  async function saveForm(e: React.FormEvent) {
    e.preventDefault();
    if (offline) { setError("You are offline. Reconnect to save these changes. Your draft is still here."); return; }
    if (!modalEditable || busy || uploading) {
      setError(previewRole !== "owner" ? "Return to your own view to make changes." : "This record is read only for your current role.");
      return;
    }
    let ok = false;
    if (
      [
        "person",
        "document",
        "account",
        "gift",
        "task",
        "claim",
        "transaction",
      ].includes(modal)
    ) {
      const payload = { ...form };
      if ((modal === "claim" && payload.deadline && Number.isNaN(new Date(payload.deadline).getTime())) || (modal === "task" && payload.dueAt && Number.isNaN(new Date(payload.dueAt).getTime()))) { setError("Enter a valid date and time, or leave the optional deadline empty."); return; }
      if (modal === "claim")
        payload.deadline = payload.deadline
          ? new Date(payload.deadline).toISOString()
          : null;
      if (modal === "task" && payload.dueAt)
        payload.dueAt = new Date(payload.dueAt).toISOString();
      if (modal === "task" && !payload.dueAt) payload.dueAt = null;
      ok = modal === "task" && role === "representative" && payload.category === "administration" ? await action("record-administration",{taskId:payload.id,evidence:payload.evidence,status:payload.status}) : await action(`save-${modal}`, { [modal]: payload });
    } else if (modal === "ledger")
      ok = await action("save-ledger", {
        openingBalance: form.openingBalance,
        reserve: form.reserve,
        currency: form.currency,
        openingEvidence: form.openingEvidence,
      });
    else if (modal === "new") ok = await action("new-plan", form);
    else if (modal === "extract") {
      ok = await action("extract-document", {
        id: form.id,
        consent: form.consent,
      });
      if (ok) open("read-doc", { id: form.id });
      return;
    } else if (modal === "read-doc") {
      ok = await action("accept-transcription", {
        id: form.id,
        confirmed: form.confirmed,
        correctedText: form.correctedText ?? activeDocument?.extraction?.text,
      });
      if (ok) {
        setForm((v) => ({ ...v, confirmed: false }));
        setNotice(
          "Transcription acceptance recorded. Document execution status has not been changed.",
        );
      }
      return;
    } else if (modal === "analyze-doc") {
      ok = await action("analyze-document", {
        id: form.id,
        consent: form.consent,
      });
      if (ok) setView("Documents");
    } else if (modal === "analysis") ok = await action("analyze", form);
    else if (modal === "review")
      ok = await action("review-plan", { consent: form.consent });
    else if (modal === "invite") {
      ok = await action("invite", form);
      return;
    } else if (modal === "acknowledge")
      ok = await action("accept-person", form);
    else if (modal === "death") ok = await action("report-death", form);
    else if (modal === "authority")
      ok = await action("review-authority", { authority: form });
    else if (modal === "preferences")
      ok = await action("save-preferences", { preferences: form });
    else if (modal === "provider") {
      setBusy("provider");
      setError("");
      try {
        const r = await fetch("/api/provider", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey: form.apiKey }),
        });
        const j: any = await responseData(r);
        if (!r.ok) throw Error(j.error || "Connection could not be saved");
        ok = true;
        await load();
        setNotice(
          "Meta connection saved securely. Your key is never included in exports.",
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Connection unavailable");
      } finally {
        setBusy("");
      }
    }
    if (ok) setModal("");
  }
  async function upload(file: File) {
    if (previewRole !== "owner") {
      setError("File uploads are disabled in a permission preview.");
      return;
    }
    if (uploading) return;
    setError("");
    if (!file.size || file.size > 5 * 1024 * 1024) {
      setError("Choose a non-empty file up to 5 MB.");
      return;
    }
    if (!["application/pdf", "image/png", "image/jpeg", "text/plain"].includes(file.type)) {
      setError("Choose a PDF, PNG, JPEG or plain text file. Other formats are not supported yet.");
      return;
    }
    if (offline) { setError("You are offline. Reconnect before attaching a file."); return; }
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const r = await fetch("/api/files", { method: "POST", body });
      const j: any = await responseData(r);
      if (!r.ok) throw Error(j.error || "Upload failed");
      setForm((v) => ({ ...v, fileId: j.fileId, fileName: j.name.slice(0,180), ...(v.title ? {} : {title: j.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ")}) }));
      setNotice(
        "File uploaded. Save the document record to attach it to your plan.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }
  async function acceptInvitation() {
    setBusy("invitation");
    try {
      const r = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: inviteToken }),
      });
      const j: any = await responseData(r);
      if (!r.ok) throw Error(j.error || "Could not accept invitation");
      setInvite(null);
      history.replaceState({}, "", location.pathname);
      await load();
      setNotice(
        "Invitation accepted. You can see only the records permitted for your role.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to accept");
    } finally {
      setBusy("");
    }
  }
  const modalTitles: Record<string, string> = {
    person: "Someone you can count on.",
    document: "Keep the important things findable.",
    account: "A clearer picture, one account at a time.",
    gift: "A cause that matters to you.",
    task: "One useful next step.",
    invite: "Share only what is needed.",
    analysis: "A second pair of eyes.",
    review: "See how the pieces fit together.",
    acknowledge: "Record their acknowledgement.",
    death: "Let’s take this one step at a time.",
    authority: "Check the authority for each role.",
    new: "Make room for your own plan.",
    preferences: "On your terms.",
    claim: "One claim. A clear next step.",
    ledger: "Establish the estate money record.",
    transaction: "Record the evidence, not a transfer.",
    extract: "Read the attachment, with your permission.",
    "read-doc": "Check the words against the original.",
    "analyze-doc": "Review the text you confirmed.",
    provider: "Connect your private AI assistant.",
  };
  return (
    <div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
      <a className="skip-link" href="#main">
        Skip to your plan
      </a>
      {mobile && (
        <button
          className="scrim"
          aria-label="Close navigation"
          onClick={() => {closeNavigation();}}
        />
      )}
      <aside id="primary-sidebar" ref={sidebarRef} className={`sidebar ${mobile ? "open" : ""}`} aria-label="Family plan navigation" inert={!!modal || (compactNav && !mobile) ? true : undefined} aria-hidden={!!modal || (compactNav && !mobile) ? true : undefined}>
        <button className="icon-button mobile-sidebar-close" aria-label="Close navigation" onClick={()=>{closeNavigation();}}><X size={20}/></button>
        <div className="sidebar-scroll">
        <button
          className="brand"
          onClick={() => navigate("Home")}
          aria-label="Hearth home"
        >
          <span className="brand-icon">
            <Heart size={21} strokeWidth={1.7} />
          </span>
          <span className="brand-wordmark">hearth<span className="brand-period">.</span></span>
        </button>
        <p className="brand-caption">FOR THE PEOPLE WHO MATTER</p>
        <div className="family-switch">
          <span>{firstName.slice(0, 1)}</span>
          <div>
            <strong>{household.name || "Your family plan"}</strong>
            <small>{household.jurisdiction || "A place to begin"}</small>
          </div>
          <LockKeyhole size={12} />
        </div>
        <p className="nav-label">YOUR PLAN</p>
        <nav aria-label="Main navigation">
          {nav.map(([name, Icon]) => (
            <button
              key={name}
              aria-label={name}
              title={collapsed && !compactNav ? name : undefined}
              className={`nav-item ${view === name ? "active" : ""}`}
              aria-current={view === name ? "page" : undefined}
              onClick={() => navigate(name)}
              disabled={!data}
            >
              <Icon size={17} />
              <span>{name}</span>
              {name === "When needed" && <span className="nav-note">↗</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span>
            <Leaf size={20} />
          </span>
          <p>
            You don’t have to figure
            <br />
            everything out today.
          </p>
          <button
            disabled={!data}
            onClick={() => open("preferences", state.preferences)}
          >
            Set your pace <ArrowRight size={12} />
          </button>
        </div>
        </div>
        <div className="sidebar-bottom">
          <button
            className="privacy-link"
            aria-label="Privacy and preferences"
            title={collapsed && !compactNav ? "Privacy and preferences" : undefined}
            disabled={!data}
            onClick={() => open("preferences", state.preferences)}
          >
            <LockKeyhole size={13} /><span>Private, and in your control</span>
          </button>
          <button
            className="user-profile"
            aria-label="Account and preferences"
            title={collapsed && !compactNav ? "Account and preferences" : undefined}
            disabled={!data}
            onClick={() => open("preferences", state.preferences)}
          >
            <span className="avatar">{(data?.user?.name || "H")[0]}</span>
            <span>
              <strong>{data?.user?.name || "Private family workspace"}</strong>
              <small>
                {!data
                  ? "Sign in to begin"
                  : role === "owner"
                    ? "Plan owner"
                    : role}
              </small>
            </span>
            <Settings2 size={15} />
          </button>
        </div>
      </aside>
      <div className="main-shell" inert={mobile || !!modal ? true : undefined}>
        <header className="topbar">
          <div className="breadcrumb">
            <button
              ref={menuRef}
              className="icon-button mobile-menu"
              aria-label={compactNav ? "More navigation and settings" : "Open navigation"}
              aria-expanded={mobile}
              aria-controls="primary-sidebar"
              onClick={(event) => {navigationTrigger.current=event.currentTarget;setMobile(true);}}
            >
              <Menu size={20} />
            </button>
            <button className="icon-button desktop-sidebar-toggle" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} aria-controls="primary-sidebar" onClick={toggleSidebar} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
              {collapsed ? <PanelLeftOpen size={19}/> : <PanelLeftClose size={19}/>}
            </button>
            <span>{household.name || "Your family plan"}</span>
            <ChevronRight size={12} />
            <strong>{view}</strong>
          </div>
          <div className="top-actions">
            {state.fixture && (
              <span className="sample-label">Illustrative family</span>
            )}
            <button
              className="icon-button"
              onClick={() => load()}
              aria-label="Refresh plan"
              disabled={!!busy || !data}
            >
              <Clock3 size={17} />
            </button>
            {data && (
              <a
                className="export-link"
                href={
                  previewRole === "owner"
                    ? "/api/export"
                    : `/api/export?previewRole=${previewRole}&access=${previewAccess}`
                }
              >
                <ArrowDownToLine size={14} /> Export plan
              </a>
            )}
          </div>
        </header>
        <main
          id="main"
          tabIndex={-1}
          className={`content ${authRequired && !data ? "signed-out-content" : ""}`}
        >
          {ownerAccess && (
            <details className="permission-preview-disclosure" open={previewRole !== "owner" || undefined} onToggle={(event) => { if (previewRole !== "owner" && !event.currentTarget.open) event.currentTarget.open = true; }}>
              <summary><ShieldCheck size={14} /> Preview what someone can see</summary>
            <div className="role-preview">
              <div>
                <ShieldCheck size={15} />
                <span>
                  <strong>Permission preview</strong>
                  <small>
                    Previewing does not share anything or change membership.
                  </small>
                </span>
              </div>
              <label className="sr-only" htmlFor="preview-role">
                Preview a role
              </label>
              <select
                id="preview-role"
                value={previewRole}
                disabled={!!busy}
                onChange={(e) => {
                  const next = e.target.value;
                  setPreviewRole(next);
                  setView("Home");
                  load(next, previewAccess);
                }}
              >
                <option value="owner">My owner view</option>
                <option value="helper">Trusted helper view</option>
                <option value="adviser">Adviser view</option>
                <option value="professional">Professional view</option>
                <option value="representative">Representative view</option>
              </select>
              {previewRole !== "owner" && previewRole !== "adviser" && (
                <>
                  <label className="sr-only" htmlFor="preview-access">
                    Preview access scope
                  </label>
                  <select
                    id="preview-access"
                    value={previewAccess}
                    disabled={!!busy}
                    onChange={(e) => {
                      setPreviewAccess(e.target.value);
                      load(previewRole, e.target.value);
                    }}
                  >
                    <option value="emergency">Emergency information</option>
                    <option value="documents">Permitted documents</option>
                    <option value="administration">Administration</option>
                  </select>
                </>
              )}
              {previewRole !== "owner" && (
                <span className="read-only-label">
                  <LockKeyhole size={11} /> Read only
                </span>
              )}
            </div>
            </details>
          )}

          {offline && <div className="offline-notice" role="status"><CircleAlert size={17}/><span>You are offline. Your loaded plan is still here. Reconnect to save changes or review with AI.</span></div>}
          {error && (
            <div className="alert error" role="alert">
              <CircleAlert size={18} />
              <div>
                <strong>Something needs attention</strong>
                <p>{error}</p>
                {/401|sign.?in|unauth/i.test(error) && (
                  <a target="_top" href={signInPath}>
                    Sign in to Hearth
                  </a>
                )}
                {/revision/i.test(error) && (
                  <button className="text-button" onClick={() => load()}>
                    Reload the latest plan <ArrowRight size={12} />
                  </button>
                )}
              </div>
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div className="alert success" role="status">
              <CheckCheck size={17} />
              <span>{notice}</span>
              <button
                aria-label="Dismiss notification"
                onClick={() => setNotice("")}
              >
                <X size={15} />
              </button>
            </div>
          )}
          {invite && (
            <Panel
              title="You’ve been invited to a family plan"
              eyebrow="PRIVATE INVITATION"
            >
              <p className="muted">
                This invitation is checked against your signed-in email.
                Accepting gives only the role and records permitted by the plan
                owner.
              </p>
              <dl className="invitation-summary">
                <div><dt>Invited email</dt><dd>{invite.email}</dd></div>
                <div><dt>Your role</dt><dd>{invite.role === "representative" ? "Estate representative" : invite.role === "professional" ? "Professional" : "Trusted helper"}</dd></div>
                <div><dt>Shared information</dt><dd>{invite.access === "administration" ? "Administration records" : invite.access === "emergency" ? "Emergency information" : "Permitted documents"}</dd></div>
                <div><dt>Accept by</dt><dd>{date(invite.expiresAt)}</dd></div>
              </dl>
              <Button onClick={acceptInvitation} disabled={!!busy}>
                {busy ? (
                  <LoaderCircle className="spin" size={15} />
                ) : (
                  <Check size={15} />
                )}{" "}
                Accept invitation
              </Button>
            </Panel>
          )}
          {!data ? (
            authRequired ? (
              <section
                className="signed-out-welcome"
                aria-labelledby="welcome-title"
              >
                <div className="welcome-private">
                  <LockKeyhole size={13} /> PRIVATE FAMILY PLANNING
                </div>
                <div className="signed-out-hero">
                  <div className="signed-out-copy">
                    <p className="eyebrow">
                      A LITTLE CLARITY FOR THE PEOPLE YOU LOVE
                    </p>
                    <h1 id="welcome-title">
                      A plan your
                      <br />
                      people can use.
                    </h1>
                    <p>
                      Bring your wishes, important records, and trusted people
                      into one thoughtful place. Start small. Keep what matters
                      findable. Stay in control of who can see it.
                    </p>
                    <a
                      className="button sign-in-button"
                      href={signInPath}
                      target="_top"
                    >
                      Sign in or explore privately <ArrowRight size={16} />
                    </a>
                    <span className="sign-in-note">
                      <ShieldCheck size={13} /> Your private records load only
                      after you sign in.
                    </span>
                  </div>
                  <div className="signed-out-art" aria-hidden="true">
                    <div className="welcome-orbit" />
                    <KeepsakeIllustration />
                    <span className="welcome-heart">
                      <Heart size={28} strokeWidth={1.2} />
                    </span>
                  </div>
                </div>
                <div className="welcome-benefits">
                  <article>
                    <span>
                      <FileText size={20} />
                    </span>
                    <h2>
                      Make the important
                      <br />
                      things findable.
                    </h2>
                    <p>
                      Keep document locations, account instructions, and
                      practical next steps together.
                    </p>
                  </article>
                  <article>
                    <span>
                      <Users size={20} />
                    </span>
                    <h2>
                      A helping hand.
                      <br />
                      Clear boundaries.
                    </h2>
                    <p>
                      Give trusted people only the information their chosen role
                      needs.
                    </p>
                  </article>
                  <article>
                    <span>
                      <Leaf size={20} />
                    </span>
                    <h2>
                      Your wishes.
                      <br />
                      Your pace.
                    </h2>
                    <p>
                      Prepare for care, inheritance, and optional giving without
                      having to decide everything today.
                    </p>
                  </article>
                </div>
                <div className="welcome-footnote">
                  <span>Hearth · Private family preparation</span><a className="evaluation-link" href="/evaluation">Evaluation <ArrowUpRight size={11}/></a>
                  <span>
                    Thoughtful preparation. Professional judgment where needed.
                  </span>
                </div>
              </section>
            ) : (
              <div className="loading-state">
                <span className="brand-icon">
                  <Heart size={27} />
                </span>
                <h1>
                  {busy
                    ? "A little clarity is on its way."
                    : "Let’s reconnect to your plan."}
                </h1>
                <p>
                  {busy
                    ? "Opening your private family workspace…"
                    : "Your records could not be loaded. Please retry or sign in."}
                </p>
                {busy ? (
                  <LoaderCircle className="spin" size={23} />
                ) : (
                  <Button onClick={() => load()}>
                    Try again <ArrowRight size={15} />
                  </Button>
                )}
              </div>
            )
          ) : (
            <>
              {isDemo && <section className="private-sample-banner"><ShieldCheck size={16}/><p><strong>Your private fictional sample.</strong> Sign in to create your own plan and invite people.</p><a href={signInPath}>Sign in <ArrowRight size={13}/></a></section>}
              {view === "Home" ? (
                <>
                  {!owner && (
                    <div className="shared-note">
                      <LockKeyhole size={15} />
                      <span>
                        {previewRole !== "owner"
                          ? `Read-only preview of the ${previewRole} role. These records were filtered on the server; your actual membership has not changed.`
                          : `You’re viewing this plan as an authorised ${role}. Only permitted records are shown. Membership is not a legal appointment or credential verification.`}
                      </span>
                    </div>
                  )}
                  <div className="page-heading home-heading">
                    <div>
                      <p className="eyebrow">
                        A LITTLE CLARITY. A LITTLE PEACE OF MIND.
                      </p>
                      <h1>
                        {household.mode === "bereaved"
                          ? "We’ll take this one step at a time."
                          : state.fixture && owner ? `Explore ${firstName}’s family plan.` : owner ? "Your family plan, a little clearer." : "A clear view of the family plan."}
                      </h1>
                      <p>
                        Your wishes, the people you trust, and a few things
                        worth putting in place.
                      </p>
                    </div>
                    <span className="private-mark">
                      <ShieldCheck size={14} /> Your private plan
                    </span>
                  </div>
                  <div className="home-grid">
                    <section className="welcome-card">
                      <div className="welcome-copy">
                        <span className="chapter">A LITTLE CARE, PUT INTO PLACE</span>
                        <h2>
                          A little preparation.
                          <br />A lot less left unsaid.
                        </h2>
                        <p>
                          You don’t need every answer. Start with the people who
                          could help, and make the important things easier to
                          find.
                        </p>
                        <Button
                          onClick={() =>
                            navigate(derived.nextSteps?.[0]?.view || "People")
                          }
                        >
                          Take the next small step <ArrowRight size={15} />
                        </Button>
                        <small>
                          No rush. Your progress is saved as you go.
                        </small>
                      </div>
                      <KeepsakeIllustration />
                    </section>
                    <Panel
                      title="Your plan, at a glance"
                      eyebrow="SMALL THINGS, PUT IN PLACE"
                      className="glance-panel"
                    >
                      <Glance
                        icon={Users}
                        title="People you trust"
                        text={`${people.filter((p) => p.status === "accepted").length} acknowledgements recorded`}
                        value={people.length}
                        onClick={() => navigate("People")}
                      />
                      <Glance
                        icon={FileText}
                        title="Important documents"
                        text={`${documents.filter((d) => d.kind === "will" && d.status === "draft").length} wills need execution review`}
                        value={documents.length}
                        onClick={() => navigate("Documents")}
                      />
                      <Glance
                        icon={WalletCards}
                        title="Accounts & policies"
                        text={`${accounts.filter((a) => a.verification !== "institution-confirmed").length} need confirmation`}
                        value={accounts.length}
                        onClick={() => navigate("Accounts & policies")}
                      />
                      <Glance
                        icon={Leaf}
                        title="Causes you care about"
                        text="An intention is not yet a completed gift"
                        value={gifts.length}
                        onClick={() => navigate("Giving")}
                      />
                    </Panel>
                  </div>
                  <div className="two-column home-second">
                    <Panel
                      title="A few useful next steps"
                      eyebrow="ONLY WHAT NEEDS YOUR ATTENTION"
                      action={
                        <span className="soft-count">
                          {derived.counts?.openTasks ??
                            tasks.filter((t) => t.status !== "complete")
                              .length}{" "}
                          open
                        </span>
                      }
                    >
                      <div className="next-steps">
                        {(derived.nextSteps || [])
                          .slice(0, 3)
                          .map((t: Item, i: number) => (
                            <button
                              key={t.id || i}
                              onClick={() => navigate(t.view || "Documents")}
                            >
                              <span className={`next-icon next-${i}`}>
                                {i === 0 ? (
                                  <FileText size={17} />
                                ) : i === 1 ? (
                                  <Users size={17} />
                                ) : (
                                  <WalletCards size={17} />
                                )}
                              </span>
                              <span>
                                <strong>{t.title}</strong>
                                <small>{t.reason}</small>
                              </span>
                              <ArrowRight size={15} />
                            </button>
                          ))}
                        {!derived.nextSteps?.length && (
                          <Empty
                            icon={CheckCheck}
                            title="A little breathing room."
                            text="No new next steps are flagged. You can still review and update your records."
                          />
                        )}
                      </div>
                      <button
                        className="text-button section-end"
                        onClick={() => open("task")}
                      >
                        Add a step of your own <Plus size={13} />
                      </button>
                    </Panel>
                    <Panel
                      title="A helping hand, with clear boundaries"
                      eyebrow="PEOPLE BEFORE PAPERWORK"
                    >
                      <div className="helper-summary">
                        <div className="avatar-stack">
                          {people.slice(0, 3).map((p) => (
                            <span key={p.id}>{p.name?.[0] || "?"}</span>
                          ))}
                        </div>
                        <p>
                          A helper can find what you choose to share. Their
                          invitation does not give legal authority over your
                          wishes, care, or money.
                        </p>
                      </div>
                      <Button
                        secondary
                        disabled={owner && isDemo}
                        onClick={() => owner ? open("invite") : navigate("People")}
                      >
                        <Users size={14} />{" "}
                        {owner
                          ? "Invite someone you trust"
                          : "View people & roles"}
                      </Button>
                      <div className="gentle-note">
                        <LockKeyhole size={13} />
                        <p>
                          You decide who sees what. Private wishes stay private.
                        </p>
                      </div>
                    </Panel>
                  </div>
                  <section className="ai-banner">
                    <span className="ai-icon">
                      <Sparkles size={22} />
                    </span>
                    <div>
                      <p className="eyebrow">A SECOND PAIR OF EYES</p>
                      <h3>Make sense of what you already have.</h3>
                      <p>
                        Bring your own document text. Get source-linked
                        questions and next steps to review.
                      </p>
                    </div>
                    <div className="ai-actions">
                      <Button
                        secondary
                        onClick={() => open("analysis")}
                        disabled={!owner}
                      >
                        Review document text <FileText size={14} />
                      </Button>
                      <Button
                        secondary
                        onClick={() => open("review")}
                        disabled={!owner}
                      >
                        Review my plan <Sparkles size={14} />
                      </Button>
                    </div>
                  </section>
                  <ProposalReview
                    proposals={state.proposals || []}
                    sources={state.intakes || []}
                    canAudit={owner}
                    busy={busy}
                    onAction={action}
                    onOpenTask={(proposal)=>{const task=tasks.find(t=>t.title===proposal.title&&t.sourceId===proposal.sourceId);if(task)open("task",task);else navigate("People");}}
                  />
                  {state.fixture && (
                    <div className="sample-note">
                      <BookOpen size={17} />
                      <p>
                        You’re exploring Maria’s illustrative plan. Create your
                        own to begin with an empty, private workspace.
                      </p>
                      <button
                        className="text-button"
                        onClick={() => open("new")}
                        disabled={isDemo}
                      >
                        Start my plan <ArrowRight size={13} />
                      </button>
                    </div>
                  )}
                  <details className="activity-history">
                    <summary>
                      <Clock3 size={14} /> Recent activity{" "}
                      <span>{events.length} preserved events</span>
                    </summary>
                    <div>
                      {events
                        .slice(-5)
                        .reverse()
                        .map((e) => (
                          <article key={e.id}>
                            <strong>{e.action.replaceAll("-", " ")}</strong>
                            <p>{e.detail}</p>
                            <small>
                              {e.actor} · {date(e.at)}
                            </small>
                          </article>
                        ))}
                    </div>
                  </details>
                  <div className="intake-strip">
                    <p>What brings you here?</p>
                    {[
                      ["planning", "I’m planning ahead"],
                      ["helping", "I’m helping someone"],
                      ["bereaved", "Someone has died"],
                    ].map(([v, l]) => (
                      <button
                        key={v}
                        className={household.mode === v ? "selected" : ""}
                        disabled={!owner || !!busy}
                        onClick={() =>
                          v === "bereaved"
                            ? navigate("When needed")
                            : action("save-household", {
                                household: { ...household, mode: v },
                              })
                        }
                      >
                        {household.mode === v && <Check size={12} />} {l}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="page-heading">
                  <div>
                    <p className="eyebrow">
                      {
                        (
                          {
                            People: "PEOPLE BEFORE PAPERWORK",
                            Documents: "KEEP WHAT MATTERS FINDABLE",
                            "Accounts & policies":
                              "THE DETAILS THAT MAKE A DIFFERENCE",
                            Giving: "THE CAUSES YOU CARE ABOUT",
                            "When needed": "PRACTICAL HELP, WHEN IT MATTERS",
                            Practice:
                              "A THOUGHTFUL SERVICE, SUSTAINABLY DELIVERED",
                          } as Item
                        )[view]
                      }
                    </p>
                    <h1>
                      {
                        (
                          {
                            People: "The people you can count on.",
                            Documents: "Important things, in one place.",
                            "Accounts & policies":
                              "A clearer picture of your arrangements.",
                            Giving: "Leave a little good behind.",
                            "When needed": "You don’t have to carry it all.",
                            Practice: "Care that earns its place.",
                          } as Item
                        )[view]
                      }
                    </h1>
                    <p>
                      {
                        (
                          {
                            People:
                              "Separate roles. Clear permissions. A little less left to guess.",
                            Documents:
                              "A draft, an executed record, and a located original are different things.",
                            "Accounts & policies":
                              "Record what is known. Follow through on what still needs confirmation.",
                            Giving:
                              "Giving is optional. Your choices, your pace, and a clear record.",
                            "When needed":
                              "Start with the essentials. Authority and privacy stay explicit.",
                            Practice:
                              "An institutional service model with defined work, honest economics, and family privacy.",
                          } as Item
                        )[view]
                      }
                    </p>
                  </div>
                  {[
                    "People",
                    "Documents",
                    "Accounts & policies",
                    "Giving",
                  ].includes(view) &&
                    owner && (
                      <Button
                        onClick={() =>
                          open(
                            (
                              {
                                People: "person",
                                Documents: "document",
                                "Accounts & policies": "account",
                                Giving: "gift",
                              } as Item
                            )[view],
                          )
                        }
                      >
                        <Plus size={15} />{" "}
                        {
                          (
                            {
                              People: "Add a person",
                              Documents: "Add a document",
                              "Accounts & policies": "Add an account",
                              Giving: "Save a giving intention",
                            } as Item
                          )[view]
                        }
                      </Button>
                    )}
                </div>
              )}

              {view === "People" && (
                <>
                  <div className="permission-banner">
                    <ShieldCheck size={23} />
                    <div>
                      <strong>An invitation is not a legal appointment.</strong>
                      <p>
                        A trusted helper, health-care proxy, emergency contact,
                        and estate representative have different roles.
                      </p>
                    </div>
                    {owner && (
                      <Button secondary disabled={isDemo} onClick={() => open("invite")}>
                        <Users size={14} /> Create invitation link
                      </Button>
                    )}
                  </div>
                  <div className="people-grid">
                    {people.map((p) => (
                      <article className="person-card" key={p.id}>
                        <div className="person-top">
                          <span className="person-avatar">{p.name?.[0]}</span>
                          <Badge value={p.status} />
                        </div>
                        <h2>{p.name}</h2>
                        <p className="person-role">
                          {p.role.replaceAll("-", " ")}
                        </p>
                        <p className="muted">
                          {p.email || "No email recorded"}
                        </p>
                        <div className="permission-row">
                          <LockKeyhole size={12} />
                          <span>{p.access} access</span>
                        </div>
                        {p.note && <p className="person-note">{p.note}</p>}
                        <div className="card-actions">
                          {ownerAccess && p.role === "helper" && (
                            <button
                              className="text-button"
                              onClick={() => {
                                setPreviewRole("helper");
                                setPreviewAccess(p.access);
                                setView("Home");
                                load("helper", p.access);
                              }}
                            >
                              See what {p.name?.split(" ")[0]} can see{" "}
                              <LockKeyhole size={12} />
                            </button>
                          )}
                          <button
                            className="text-button"
                            onClick={() => open("person", p)}
                          >
                            Review role <ArrowRight size={13} />
                          </button>
                          {p.status !== "accepted" && owner && (
                            <button
                              className="text-button"
                              onClick={() => open("acknowledge", { id: p.id })}
                            >
                              Record acknowledgement
                            </button>
                          )}
                        </div>
                      </article>
                    ))}
                    {!people.length && (
                      <Empty
                        icon={Users}
                        title={owner ? "Begin with one person." : "No people shared in this view."}
                        text={owner ? "Who could help, and what would they need to know?" : "The owner chooses which contact records this role may see."}
                        action={
                          <Button disabled={!owner} onClick={() => open("person")}>
                            <Plus size={14} /> Add someone
                          </Button>
                        }
                      />
                    )}
                  </div>
                  {owner && !isDemo && previewRole === "owner" && (
                    <Panel
                      title="Who can access this workspace"
                      eyebrow="OWNER-CONTROLLED ACCESS - NO EMAILS ARE SENT"
                      action={
                        <button
                          className="text-button"
                          disabled={!!accessBusy}
                          onClick={loadAccess}
                        >
                          {accessBusy === "load" ? (
                            <LoaderCircle className="spin" size={13} />
                          ) : (
                            <ShieldCheck size={13} />
                          )}{" "}
                          Refresh access
                        </button>
                      }
                    >
                      <p className="muted">
                        Workspace membership controls the records an account can
                        see. It is separate from the proposed family roles above
                        and does not grant legal authority.
                      </p>
                      <div className="access-management">
                        <div>
                          <h3>Current members</h3>
                          {(accessData.members || []).map((m: Item) => (
                            <article key={m.user}>
                              <div>
                                <strong>{m.email || "Workspace member"}</strong>
                                <p>
                                  {m.role} · {m.access}
                                </p>
                              </div>
                              {m.role !== "owner" ? (
                                <button
                                  className="text-button danger-link"
                                  disabled={!!accessBusy}
                                  onClick={() =>
                                    setAccessConfirm({
                                      action: "remove-member",
                                      userId: m.user,
                                      label: m.email,
                                    })
                                  }
                                >
                                  Remove access <X size={12} />
                                </button>
                              ) : (
                                <Badge>Owner</Badge>
                              )}
                            </article>
                          ))}
                          {!accessData.members?.length && (
                            <p className="empty-list">
                              No additional member records are listed.
                            </p>
                          )}
                        </div>
                        <div>
                          <h3>Invitations</h3>
                          {(accessData.invitations || []).map((i: Item) => (
                            <article key={i.tokenHash}>
                              <div>
                                <strong>{i.email}</strong>
                                <p>
                                  {i.role} · {i.access} ·{" "}
                                  {i.acceptedBy === "REVOKED"
                                    ? "Revoked"
                                    : i.acceptedBy
                                      ? "Accepted"
                                      : `Expires ${date(i.expiresAt)}`}
                                </p>
                              </div>
                              {!i.acceptedBy ? (
                                <button
                                  className="text-button danger-link"
                                  disabled={!!accessBusy}
                                  onClick={() =>
                                    setAccessConfirm({
                                      action: "revoke-invitation",
                                      tokenHash: i.tokenHash,
                                      label: i.email,
                                    })
                                  }
                                >
                                  Revoke link <X size={12} />
                                </button>
                              ) : (
                                <Badge
                                  value={
                                    i.acceptedBy === "REVOKED"
                                      ? "superseded"
                                      : "accepted"
                                  }
                                >
                                  {i.acceptedBy === "REVOKED"
                                    ? "Revoked"
                                    : "Accepted"}
                                </Badge>
                              )}
                            </article>
                          ))}
                          {!accessData.invitations?.length && (
                            <p className="empty-list">
                              No invitation links are recorded. Links are
                              created only when you ask.
                            </p>
                          )}
                        </div>
                      </div>
                      {accessConfirm && (
                        <div className="access-confirmation" role="alert">
                          <CircleAlert size={18} />
                          <div>
                            <strong>
                              {accessConfirm.action === "remove-member"
                                ? "Remove workspace access"
                                : "Revoke this invitation link"}{" "}
                              for {accessConfirm.label}?
                            </strong>
                            <p>
                              {accessConfirm.action === "remove-member"
                                ? "The account will no longer have this workspace membership. Previous recorded actions remain in the history. This does not revoke a legal appointment."
                                : "The unused link will stop granting access. No email is sent, and any separate legal role is unchanged."}
                            </p>
                            <div className="button-row">
                              <Button
                                secondary
                                onClick={() => setAccessConfirm(null)}
                                disabled={!!accessBusy}
                              >
                                Keep access
                              </Button>
                              <Button
                                onClick={changeAccess}
                                disabled={!!accessBusy}
                              >
                                {accessBusy ? (
                                  <LoaderCircle className="spin" size={13} />
                                ) : (
                                  <Check size={13} />
                                )}{" "}
                                Confirm{" "}
                                {accessConfirm.action === "remove-member"
                                  ? "removal"
                                  : "revocation"}
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </Panel>
                  )}
                  <Panel title="Rehearse the handover">
                    <p className="muted">
                      Can the person you chose find the information they’re
                      permitted to see, identify the responsible professional,
                      and explain their role? A short conversation now can
                      reveal what still needs attention.
                    </p>
                    <button
                      className="text-button section-end"
                      onClick={() =>
                        open("task", {
                          title:
                            "Rehearse the information handover with my trusted helper",
                          category: "planning",
                        })
                      }
                    >
                      Make this a next step <ArrowRight size={13} />
                    </button>
                  </Panel>
                </>
              )}

              {view === "Documents" && (
                <>
                  <div className="section-toolbar">
                    <SearchBox
                      value={search}
                      setValue={setSearch}
                      label="Search documents"
                    />
                    <button
                      className="text-button"
                      onClick={() => open("analysis")}
                    >
                      <Sparkles size={15} /> Review pasted document text
                    </button>
                  </div>
                  <Panel
                    title="Your document record"
                    action={
                      <span className="soft-count">
                        {documents.length} records
                      </span>
                    }
                  >
                    <div className="table-scroll document-table">
                      <table>
                        <thead>
                          <tr>
                            <th>Document</th>
                            <th>Recorded status</th>
                            <th>Original / execution</th>
                            <th>Access</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {filtered(documents).map((d) => (
                            <tr key={d.id}>
                              <td>
                                <strong>{d.title}</strong>
                                <small>{({will:"Will",care:"Care instructions",letter:"Personal letter",other:"Other document"} as Record<string,string>)[d.kind] || d.kind}{d.fileId ? " · Attachment saved" : ""}</small>
                              </td>
                              <td data-label="Recorded status">
                                <Badge value={d.status} />
                              </td>
                              <td data-label="Original / execution">
                                <span>
                                  {d.originalLocation || "Original not located"}
                                </span>
                                <small>
                                  {d.executionEvidence ||
                                    "Execution evidence not recorded"}
                                </small>
                              </td>
                              <td data-label="Access">
                                <Visibility value={d.visibility} />
                              </td>
                              <td>
                                <div className="table-actions">
                                  {d.fileId && (
                                    <a
                                      className="text-button"
                                      href={`/api/files?id=${encodeURIComponent(d.fileId)}`}
                                    >
                                      <ArrowDownToLine size={13} /> Download
                                    </a>
                                  )}
                                  {owner && d.fileId && (
                                    <button
                                      className="text-button"
                                      onClick={() =>
                                        open(
                                          d.extraction ? "read-doc" : "extract",
                                          { id: d.id },
                                        )
                                      }
                                    >
                                      <Sparkles size={13} />
                                      {d.extraction
                                        ? "Check transcription"
                                        : "Read attachment with Meta"}
                                    </button>
                                  )}
                                  <button
                                    className="text-button"
                                    onClick={() => open("document", d)}
                                  >
                                    Review <ArrowUpRight size={12} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {!filtered(documents).length && (
                      <Empty
                        icon={FileText}
                        title={search ? "No matching documents." : owner ? "Keep an important document findable." : "No documents shared in this view."}
                        text={search ? "Try a different title, document type, or location." : owner ? "Add an existing record before deciding whether anything needs replacing." : "Private records remain with the owner. Emergency access is limited to permitted care information."}
                        action={
                          <Button disabled={!owner} onClick={() => open("document")}>
                            <Plus size={14} /> Add a document
                          </Button>
                        }
                      />
                    )}
                  </Panel>
                  {owner && documents.some((d) => d.extraction) && (
                    <Panel
                      title="Attachment transcriptions to check"
                      eyebrow="A TRANSCRIPTION IS NOT A LEGAL FINDING"
                    >
                      <div className="transcription-list">
                        {documents
                          .filter((d) => d.extraction)
                          .map((d) => (
                            <article key={d.id}>
                              <div>
                                <FileText size={18} />
                                <span>
                                  <strong>{d.title}</strong>
                                  <small>
                                    {modelName(d.extraction.model)} ·{" "}
                                    {d.extraction.status === "accepted"
                                      ? "Text checked against original"
                                      : "Human text check needed"}
                                  </small>
                                </span>
                                <Badge
                                  value={
                                    d.extraction.status === "accepted"
                                      ? "accepted"
                                      : "draft"
                                  }
                                >
                                  {d.extraction.status === "accepted"
                                    ? "Text accepted"
                                    : "Unreviewed text"}
                                </Badge>
                              </div>
                              <p>
                                {d.extraction.uncertainties?.length
                                  ? `${d.extraction.uncertainties.length} reported uncertainty item(s). Inspect each against the original.`
                                  : "No uncertainty was reported by the model. Human review is still required."}
                              </p>
                              <div className="button-row">
                                <Button
                                  secondary
                                  onClick={() => open("read-doc", { id: d.id })}
                                >
                                  Inspect transcription <ArrowRight size={13} />
                                </Button>
                                {d.extraction.status === "accepted" && (
                                  <Button
                                    onClick={() =>
                                      open("analyze-doc", { id: d.id })
                                    }
                                  >
                                    <Sparkles size={13} /> Review confirmed text
                                  </Button>
                                )}
                              </div>
                            </article>
                          ))}
                      </div>
                    </Panel>
                  )}
                  <div className="two-column">
                    <Panel title="A saved edit is not a signed change">
                      <p className="muted">
                        Changes to legal documents follow the appropriate review
                        and execution process. This record does not prove valid
                        witnessing, capacity, or that no later document exists
                        elsewhere.
                      </p>
                      <div className="professional-brief-links">
                        {canReview && (
                          <a
                            className="button secondary"
                            href="/api/review-brief"
                          >
                            <FileText size={14} /> Prepare professional review
                            brief
                          </a>
                        )}
                        <a
                          className="text-button"
                          href="https://www.floridabar.org/public/lrs/"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Find qualified legal help <ArrowUpRight size={13} />
                        </a>
                        <small>
                          The brief is a factual draft for your review. Nothing
                          is sent. The Florida Bar referral service is
                          independent of Hearth.
                        </small>
                      </div>
                    </Panel>
                    <Panel title="Your original matters">
                      <p className="muted">
                        Record where the original is held and who can retrieve
                        it. A scanned copy and a legally appropriate original
                        are not interchangeable.
                      </p>
                      <Button secondary onClick={() => window.print()}>
                        <ArrowDownToLine size={14} /> Print current plan summary
                      </Button>
                    </Panel>
                  </div>
                  <ProposalReview
                    proposals={state.proposals || []}
                    sources={state.intakes || []}
                    canAudit={owner}
                    busy={busy}
                    onAction={action}
                    onOpenTask={(proposal)=>{const task=tasks.find(t=>t.title===proposal.title&&t.sourceId===proposal.sourceId);if(task)open("task",task);else navigate("People");}}
                  />
                  {owner && !!state.intakes?.length && (
                    <Panel
                      title="Saved sources for your review"
                      eyebrow="THE INPUT BEHIND THE SUGGESTION"
                    >
                      <div className="intake-records">
                        {state.intakes.map((i: Item) => (
                          <details key={i.id}>
                            <summary>
                              <BookOpen size={15}/> {modelName(i.model)} · {date(i.at)}
                            </summary>
                            <p className="source-saved-note"><ShieldCheck size={14}/> Saved with the suggestion so you can check it later.</p>
                            <pre>{i.text}</pre>
                          </details>
                        ))}
                      </div>
                    </Panel>
                  )}
                </>
              )}

              {view === "Accounts & policies" && (
                <>
                  <div className="section-toolbar">
                    <SearchBox
                      value={search}
                      setValue={setSearch}
                      label="Search accounts and policies"
                    />
                    <span className="subtle-label">
                      Account references are masked in shared views
                    </span>
                  </div>
                  <div className="accounts-grid">
                    {filtered(accounts).map((a) => (
                      <article className="account-card" key={a.id}>
                        <div className="account-top">
                          <span className={`account-icon ${a.kind}`}>
                            <WalletCards size={20} />
                          </span>
                          <Badge value={a.verification} />
                        </div>
                        <p className="eyebrow">{a.kind.toUpperCase()}</p>
                        <h2>{a.name}</h2>
                        <p className="muted">
                          {a.institution}
                          {a.lastFour ? ` · ending ${a.lastFour}` : ""}
                        </p>
                        <div className="account-detail">
                          <span>Recorded instructions</span>
                          <p>{a.beneficiarySummary || "Not yet recorded"}</p>
                          <span>Your intended arrangement</span>
                          <p>{a.desiredSummary || "Not yet discussed"}</p>
                        </div>
                        {a.desiredSummary &&
                          a.beneficiarySummary &&
                          a.desiredSummary !== a.beneficiarySummary && (
                            <div className="review-flag">
                              <CircleAlert size={13} /> Review whether the
                              institution’s record matches your wishes.
                            </div>
                          )}
                        <div className="card-actions">
                          <Visibility value={a.visibility} />
                          <button
                            className="text-button"
                            onClick={() => open("account", a)}
                          >
                            Review details <ArrowUpRight size={13} />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                  {!filtered(accounts).length && (
                    <Empty
                      icon={WalletCards}
                      title={search ? "No matching accounts or policies." : owner ? "Start with one account or policy." : "No accounts shared in this view."}
                      text={search ? "Try another account name or institution." : owner ? "A known record is a useful beginning. Current coverage and instructions still need confirmation." : "The owner controls account access. Hidden records are not treated as absent or complete."}
                      action={
                        <Button disabled={!owner} onClick={() => open("account")}>
                          <Plus size={14} /> Add an account
                        </Button>
                      }
                    />
                  )}
                  <Panel
                    title="Claims & benefits"
                    eyebrow="EACH CLAIMANT HAS THEIR OWN AUTHORITY"
                    action={
                      canReview && (
                        <Button
                          secondary
                          onClick={() =>
                            open("claim", {
                              accountId:
                                accounts.find((a) => a.kind === "insurance")
                                  ?.id || "",
                              institution:
                                accounts.find((a) => a.kind === "insurance")
                                  ?.institution || "",
                            })
                          }
                        >
                          <Plus size={14} /> Add a claim
                        </Button>
                      )
                    }
                  >
                    <p className="muted claim-intro">
                      Track an insurer’s requirements, permitted claimant,
                      actual submissions, and confirmed receipt separately. An
                      estate appointment does not automatically authorise an
                      insurance beneficiary’s claim.
                    </p>
                    {claims.length ? (
                      <div className="claims-list">
                        {claims.map((c) => (
                          <article className="claim-record" key={c.id}>
                            <div className="claim-heading">
                              <span className="account-icon insurance">
                                <ShieldCheck size={18} />
                              </span>
                              <div>
                                <h3>
                                  {c.institution || "Insurer not recorded"}
                                </h3>
                                <p>
                                  {c.claimant || "Claimant not recorded"} ·{" "}
                                  {accounts.find((a) => a.id === c.accountId)
                                    ?.name || "Policy reference not linked"}
                                </p>
                              </div>
                              <Badge value={c.status} />
                            </div>
                            <div className="claim-facts">
                              <div>
                                <small>CLAIM REFERENCE</small>
                                <strong>
                                  {c.reference || "Not submitted"}
                                </strong>
                              </div>
                              <div>
                                <small>
                                  {c.status === "paid"
                                    ? "RECORDED PAYMENT"
                                    : "RECORDED BENEFIT / ESTIMATE"}
                                </small>
                                <strong>{money(c.amount, c.currency)}</strong>
                              </div>
                              <div>
                                <small>DEADLINE</small>
                                <strong>
                                  {c.deadline
                                    ? date(c.deadline)
                                    : "None recorded"}
                                </strong>
                              </div>
                            </div>
                            <div className="claim-next">
                              <span>Next action</span>
                              <p>{c.nextAction || "No next action recorded"}</p>
                            </div>
                            <details className="claim-evidence">
                              <summary>
                                Inspect claimant authority and supporting
                                evidence
                              </summary>
                              <dl>
                                <div>
                                  <dt>Claimant authority</dt>
                                  <dd>
                                    {c.claimantAuthority || "Not recorded"}
                                  </dd>
                                </div>
                                <div>
                                  <dt>Insurer requirements</dt>
                                  <dd>{c.requirements || "Not recorded"}</dd>
                                </div>
                                <div>
                                  <dt>Submission evidence</dt>
                                  <dd>
                                    {c.submissionEvidence || "Not recorded"}
                                  </dd>
                                </div>
                                <div>
                                  <dt>Payment evidence</dt>
                                  <dd>{c.paymentEvidence || "Not recorded"}</dd>
                                </div>
                              </dl>
                            </details>
                            <div className="card-actions">
                              <Visibility value={c.visibility} />
                              {previewRole === "owner" && (
                                <a
                                  className="text-button"
                                  href={`/api/packet?claim=${encodeURIComponent(c.id)}`}
                                >
                                  <ArrowDownToLine size={13} /> Download review
                                  packet
                                </a>
                              )}
                              <button
                                className="text-button"
                                onClick={() =>
                                  open("claim", {
                                    ...c,
                                    deadline: localInput(c.deadline),
                                  })
                                }
                              >
                                Review claim <ArrowUpRight size={13} />
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <Empty
                        icon={ShieldCheck}
                        title="A separate path for each claim."
                        text="Add a known policy claim when it is needed. A policy record is not proof of current coverage or a payable benefit."
                      />
                    )}
                    <div className="fine-print">
                      Hearth records authorised administrative work. The insurer
                      decides eligibility and pays the entitled recipient. This
                      application does not submit claims, negotiate disputes, or
                      move insurance proceeds.
                    </div>
                  </Panel>
                  <div className="gentle-panel">
                    <BookOpen size={22} />
                    <div>
                      <h3>A will does not determine every transfer.</h3>
                      <p>
                        Account ownership, beneficiary instructions, and
                        insurance claims can follow different paths. A historic
                        policy certificate does not establish current coverage
                        or an amount payable.
                      </p>
                    </div>
                  </div>
                </>
              )}

              {view === "Giving" && (
                <>
                  <div className="giving-hero">
                    <div>
                      <p className="eyebrow">YOU DECIDE WHAT MATTERS</p>
                      <h2>
                        A place for the causes
                        <br />
                        close to your heart.
                      </h2>
                      <p>
                        Save an intention, keep the recipient clear, and review
                        the right way to put it in place. “Not now” and “no
                        gift” are equally complete choices.
                      </p>
                    </div>
                    <div className="giving-illustration" aria-hidden="true">
                      <Leaf size={83} strokeWidth={0.85} />
                      <Heart size={31} strokeWidth={1.1} />
                    </div>
                  </div>
                  <CharityExplorer
                    profiles={charityProfiles}
                    canSave={owner}
                    onSave={(profile) =>
                      open("gift", {
                        recipient: profile.name,
                        registrationId: profile.ein,
                        url: profile.sourceUrl,
                        cause: "Education",
                        intention: "",
                        route: "undecided",
                        status: "intention",
                      })
                    }
                  />
                  <div className="gifts-grid">
                    {gifts.map((g) => (
                      <article className="gift-card" key={g.id}>
                        <div className="gift-top">
                          <span className="gift-icon">
                            <Leaf size={23} />
                          </span>
                          <Badge value={g.status} />
                        </div>
                        <p className="eyebrow">
                          {g.cause || "A PERSONAL CHOICE"}
                        </p>
                        <h2>{g.recipient}</h2>
                        <p className="gift-intention">{g.intention}</p>
                        <div className="gift-detail">
                          <span>Intended route</span>
                          <strong>
                            {g.route === "give-now"
                              ? "Gift now"
                              : g.route === "undecided"
                                ? "To be decided"
                                : g.route === "will"
                                  ? "Through a reviewed will"
                                  : "Institution beneficiary process"}
                          </strong>
                        </div>
                        {g.evidence && (
                          <p className="muted">Evidence: {g.evidence}</p>
                        )}
                        <div className="card-actions">
                          <Visibility value={g.visibility} />
                          <button
                            className="text-button"
                            onClick={() => open("gift", g)}
                          >
                            Review intention <ArrowUpRight size={13} />
                          </button>
                        </div>
                        {g.url && (
                          <a
                            className="recipient-link"
                            target="_blank"
                            rel="noreferrer"
                            href={g.url}
                          >
                            Visit your selected recipient{" "}
                            <ArrowUpRight size={12} />
                          </a>
                        )}
                      </article>
                    ))}
                  </div>
                  {!gifts.length && (
                    <Empty
                      icon={Leaf}
                      title={owner ? "There’s no need to decide today." : "No giving intentions shared in this view."}
                      text={owner ? "If you choose to give, save a cause or recipient here. We do not rank charities or steer your choice." : "Giving decisions can remain private. This view does not reveal whether the owner has saved private intentions."}
                      action={
                        <Button secondary disabled={!owner} onClick={() => open("gift")}>
                          <Plus size={14} /> Save an intention
                        </Button>
                      }
                    />
                  )}
                  <div className="two-column">
                    <Panel title="Intention → instruction → receipt">
                      <p className="muted">
                        A saved preference does not change a will or account. An
                        authorised professional helps select and implement the
                        route. A received gift needs its own confirmation.
                      </p>
                    </Panel>
                    <Panel title="Independent of the sponsor">
                      <p className="muted">
                        Your adviser does not automatically see private giving
                        choices. No charity pays for a higher position here. The
                        recipient is one you choose; the record is not an
                        effectiveness certification.
                      </p>
                    </Panel>
                  </div>
                </>
              )}

              {view === "When needed" && (
                <>
                  <div className="care-banner">
                    <span>
                      <Heart size={27} strokeWidth={1.3} />
                    </span>
                    <div>
                      <h2>Begin with what is urgent. Let the rest wait.</h2>
                      <p>
                        Hearth helps organise the practical work. Qualified
                        professionals make legal and tax decisions; authorised
                        people approve consequential actions.
                      </p>
                    </div>
                  </div>
                  <div className="two-column">
                    <Panel
                      title="The right information, to the right person"
                      eyebrow="AUTHORITY AND ACCESS"
                      action={<Badge value={household.stage} />}
                    >
                      <div className="authority-steps">
                        <AuthorityStep
                          number="1"
                          title="Report and preserve"
                          text="Record the reported death and preserve the existing plan. A report alone never unlocks private records."
                          complete={household.stage !== "living"}
                        />
                        <AuthorityStep
                          number="2"
                          title="Review identity and appointment"
                          text="Separate proof of death, the recipient’s identity, and authority to act. A helper is not automatically an estate representative."
                          complete={household.stage === "authority-reviewed"}
                        />
                        <AuthorityStep
                          number="3"
                          title="Coordinate the authorised work"
                          text="Prepare requests, record institution responses, and preserve completion evidence for each obligation."
                          complete={derived.releaseAllowed}
                        />
                      </div>
                      <div className="button-row">
                        <Button
                          secondary
                          onClick={() => open("death")}
                          disabled={!owner || !!busy || household.stage !== "living"}
                        >
                          <FileText size={14} /> {household.stage === "living" ? "Record death report" : "Death report recorded"}
                        </Button>
                        {canReview && (
                          <Button
                            onClick={() => open("authority", state.authority)}
                            disabled={!canReviewAuthority || !!busy}
                          >
                            <ShieldCheck size={14} /> Record authority review
                          </Button>
                        )}
                      </div>
                      {!state.fixture && owner && household.stage === "death-reported" && <div className="form-note">A professional member must record the authority review for a real plan. <button className="text-button" onClick={()=>navigate("People")}>Manage professional access <ArrowRight size={13}/></button></div>}
                      <div className="fine-print">
                        Professional-review attestations are recorded evidence,
                        not independent court or registry verification. An
                        invited professional role is not an independent
                        credential check. Real plans require an authorised
                        professional member for review.
                      </div>
                    </Panel>
                    <Panel
                      title="What can be shared now"
                      eyebrow="KEEPING BOUNDARIES CLEAR"
                    >
                      <div className="release-state">
                        <span className={derived.releaseAllowed ? "ready" : ""}>
                          <LockKeyhole size={25} />
                        </span>
                        <h3>
                          {derived.releaseAllowed
                            ? "Authority review is recorded"
                            : "Restricted records remain protected"}
                        </h3>
                        <p>
                          {derived.releaseAllowed
                            ? "Access still depends on each member’s role and the record’s permission."
                            : "Inactivity, an invitation, and a relative’s assertion never grant estate authority."}
                        </p>
                      </div>
                      {(derived.blockers || []).map((b: string, i: number) => (
                        <div className="authority-blocker" key={i}>
                          <CircleAlert size={14} />
                          <p>{b}</p>
                        </div>
                      ))}
                    </Panel>
                  </div>
                  <Panel
                    title="Practical steps and responsible people"
                    action={
                      <Button
                        secondary
                        onClick={() =>
                          open("task", { category: "administration" })
                        }
                      >
                        <Plus size={14} /> Add a step
                      </Button>
                    }
                  >
                    <TaskList
                      tasks={tasks.filter(
                        (t) => t.category === "administration",
                      )}
                      onEdit={(t) => open("task", t)}
                    />
                  </Panel>
                  {ledgerVisible ? (
                    <Panel
                      title="Estate money record"
                      eyebrow="OFFLINE RECORDS - NO FUNDS ARE HELD OR MOVED"
                      action={
                        <div className="button-row ledger-actions">
                          <Button
                            secondary
                            onClick={() =>
                              open("ledger", {
                                openingBalance: ledger.openingBalance || "0.00",
                                reserve: ledger.reserve || "0.00",
                                currency: ledger.currency || "USD",
                                openingEvidence: ledger.openingEvidence || "",
                              })
                            }
                            disabled={!canReview}
                          >
                            Opening & reserve
                          </Button>
                          <Button
                            onClick={() => open("transaction")}
                            disabled={!canRecordMoney}
                          >
                            <Plus size={13} /> Add an entry
                          </Button>
                        </div>
                      }
                    >
                      <p className="muted">
                        Reconcile the recorded estate funds against external
                        bank confirmations. This balance is an arithmetic
                        record, not a recommendation or authority to distribute.
                        Insurance paid directly to a beneficiary is not
                        automatically estate money.
                      </p>
                      <div className="ledger-metrics">
                        <div>
                          <span>Recorded balance</span>
                          <strong>
                            {money(
                              ledgerDerived.recordedBalance,
                              ledger.currency,
                            )}
                          </strong>
                          <small>
                            Opening balance + confirmed inflows − confirmed
                            outflows
                          </small>
                        </div>
                        <div>
                          <span>Recorded reserve</span>
                          <strong>
                            {money(
                              ledgerDerived.reserve || ledger.reserve,
                              ledger.currency,
                            )}
                          </strong>
                          <small>Set by the responsible professional</small>
                        </div>
                        <div>
                          <span>Balance less reserve</span>
                          <strong>
                            {money(ledgerDerived.unallocated, ledger.currency)}
                          </strong>
                          <small>Not permission to distribute</small>
                        </div>
                        <div>
                          <span>Proposed outflows</span>
                          <strong>
                            {money(
                              ledgerDerived.proposedTotal,
                              ledger.currency,
                            )}
                          </strong>
                          <small>Excluded from the recorded balance</small>
                        </div>
                      </div>
                      <details className="opening-evidence">
                        <summary>Opening balance and source</summary>
                        <p>
                          Opening balance:{" "}
                          {money(ledger.openingBalance, ledger.currency)}
                        </p>
                        <p>
                          {ledger.openingEvidence ||
                            "No opening balance evidence recorded."}
                        </p>
                      </details>
                      {transactions.length ? (
                        <div className="table-scroll ledger-table">
                          <table>
                            <thead>
                              <tr>
                                <th>Entry / payee</th>
                                <th>Type</th>
                                <th>Amount</th>
                                <th>State & evidence</th>
                                <th />
                              </tr>
                            </thead>
                            <tbody>
                              {transactions.map((t) => (
                                <tr key={t.id}>
                                  <td>
                                    <strong>{t.description}</strong>
                                    <small>
                                      {t.payee || "No payee recorded"}
                                    </small>
                                  </td>
                                  <td data-label="Type">
                                    <span className="transaction-type">
                                      {t.type}
                                    </span>
                                  </td>
                                  <td data-label="Amount">
                                    <strong
                                      className={
                                        t.type === "inflow"
                                          ? "inflow-amount"
                                          : ""
                                      }
                                    >
                                      {t.type === "inflow" ? "+" : "−"}
                                      {money(t.amount, ledger.currency)}
                                    </strong>
                                  </td>
                                  <td data-label="State & evidence">
                                    <Badge value={t.status}>
                                      {t.status === "confirmed"
                                        ? "Confirmed record"
                                        : "Proposed entry"}
                                    </Badge>
                                    <small>
                                      {t.evidence ||
                                        "Confirmation evidence needed"}
                                    </small>
                                  </td>
                                  <td>
                                    <button
                                      className="text-button"
                                      onClick={() => open("transaction", t)}
                                    >
                                      Review <ArrowUpRight size={12} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <Empty
                          icon={WalletCards}
                          title="A clear record begins with a source."
                          text="Record the opening balance, then add proposed or evidence-confirmed inflows, expenses, and distributions."
                        />
                      )}
                      {household.stage !== "authority-reviewed" && (
                        <div className="form-note">
                          Proposed entries may be prepared now. Real-plan
                          confirmed transactions require recorded authority
                          review and the proper role. A draft entry never counts
                          as money paid.
                        </div>
                      )}
                    </Panel>
                  ) : (
                    <div className="ledger-locked">
                      <LockKeyhole size={20} />
                      <div>
                        <h3>Estate financial records are restricted.</h3>
                        <p>
                          The helper or adviser view does not include balances,
                          reserves, or transactions.
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="gentle-panel">
                    <ShieldCheck size={24} />
                    <div>
                      <h3>Completion needs evidence.</h3>
                      <p>
                        A submitted form is not an accepted request. An intended
                        distribution is not a payment. Hearth does not hold
                        estate money, provide representation, or move funds.
                      </p>
                    </div>
                  </div>
                </>
              )}

              {view === "Practice" && (
                <>
                  <div className="practice-hero">
                    <p className="eyebrow">
                      FOR INDEPENDENT FINANCIAL-ADVICE FIRMS
                    </p>
                    <h2>
                      A family service.
                      <br />
                      An accountable operating model.
                    </h2>
                    <p>
                      Help clients complete the arrangements they already have.
                      Reduce chasing across family members, professionals, and
                      institutions while keeping private wishes private.
                    </p>
                    <span>
                      Proposed business model · No paying customers or validated
                      savings claimed
                    </span>
                  </div>
                  <div className="practice-metrics">
                    <div>
                      <strong>250</strong>
                      <span>households per illustrative cohort</span>
                    </div>
                    <div>
                      <strong>$72</strong>
                      <span>per household / year</span>
                    </div>
                    <div>
                      <strong>$18,000</strong>
                      <span>proposed annual readiness service</span>
                    </div>
                    <div>
                      <strong>$3,000</strong>
                      <span>bounded after-death package</span>
                    </div>
                  </div>
                  <div className="two-column">
                    <Panel
                      title="Does it earn its place?"
                      eyebrow="EDITABLE ASSUMPTIONS"
                    >
                      <p className="muted">
                        Count genuinely avoided staff work, not logins. Include
                        vendor delivery and professional time when comparing
                        total cost.
                      </p>
                      <div className="calculator-fields">
                        <label>
                          Annual service fee ($)
                          <input
                            type="number"
                            min="0"
                            value={fee}
                            onChange={(e) =>
                              setFee(Math.max(0, Number(e.target.value)))
                            }
                          />
                        </label>
                        <label>
                          Staff cost / hour ($)
                          <input
                            type="number"
                            min="1"
                            value={hourly}
                            onChange={(e) =>
                              setHourly(Math.max(1, Number(e.target.value)))
                            }
                          />
                        </label>
                        <label>
                          Current annual staff hours
                          <input
                            type="number"
                            min="0"
                            value={beforeHours}
                            onChange={(e) =>
                              setBeforeHours(
                                Math.max(0, Number(e.target.value)),
                              )
                            }
                          />
                        </label>
                        <label>
                          Annual hours with service
                          <input
                            type="number"
                            min="0"
                            value={afterHours}
                            onChange={(e) =>
                              setAfterHours(Math.max(0, Number(e.target.value)))
                            }
                          />
                        </label>
                      </div>
                      <div className="calc-results">
                        <div>
                          <small>BREAK-EVEN SAVINGS</small>
                          <strong>
                            {Math.ceil(fee / hourly)}
                            <em> hours/year</em>
                          </strong>
                        </div>
                        <div>
                          <small>ILLUSTRATIVE NET VALUE</small>
                          <strong
                            className={
                              (beforeHours - afterHours) * hourly - fee < 0
                                ? "negative"
                                : ""
                            }
                          >
                            {(
                              (beforeHours - afterHours) * hourly -
                              fee
                            ).toLocaleString(undefined, {
                              style: "currency",
                              currency: "USD",
                              maximumFractionDigits: 0,
                            })}
                          </strong>
                        </div>
                      </div>
                    </Panel>
                    <Panel
                      title="Defined work. Honest capacity."
                      eyebrow="THE READINESS PACKAGE"
                    >
                      <ul className="check-list">
                        <li>
                          <Check size={15} /> Up to five standard account or
                          policy reviews
                        </li>
                        <li>
                          <Check size={15} /> One structured annual review
                        </li>
                        <li>
                          <Check size={15} /> Nominated-contact and handover
                          check
                        </li>
                        <li>
                          <Check size={15} /> Bounded routine administrative
                          follow-up
                        </li>
                      </ul>
                      <p className="muted">
                        Proposed onboarding: $15,000 per 250-household cohort.
                        New legal documents, execution providers, complex
                        assets, court work, and substantial professional advice
                        are separately scoped.
                      </p>
                      <div className="fine-print">
                        At the illustrative cost assumptions, annual direct
                        contribution is 58%. If operations rise from 15 minutes
                        to one hour per household, it falls to about 17%. Care
                        time must be costed.
                      </div>
                    </Panel>
                  </div>
                  <div className="three-column">
                    <Panel title="A reason to renew">
                      <p className="muted">
                        The advice firm serves new families and changing
                        arrangements. Families retain portable records if they
                        change adviser. Renewal should reflect useful work, not
                        locking up a completed will.
                      </p>
                    </Panel>
                    <Panel title="The competitive test">
                      <p className="muted">
                        Existing estate platforms and administrators already
                        serve this market. Prove fewer unfinished arrangements,
                        less family effort, and lower complete-cycle cost.
                      </p>
                    </Panel>
                    <Panel title="Sponsor privacy">
                      <p className="muted">
                        A firm funding the service does not automatically
                        receive private wishes, account details, or giving
                        intentions. Access follows explicit purpose and
                        permission.
                      </p>
                    </Panel>
                  </div>
                  <Panel title="Primary sources behind the workflow">
                    <div className="sources">
                      {(state.sources || []).map((s: Item) => (
                        <a
                          key={s.id}
                          href={s.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <BookOpen size={17} />
                          <span>
                            <strong>{s.title}</strong>
                            <small>{s.id}</small>
                          </span>
                          <ArrowUpRight size={14} />
                        </a>
                      ))}
                    </div>
                  </Panel>
                </>
              )}
              {view !== "When needed" &&
                view !== "Practice" &&
                view !== "Home" && (
                  <Panel
                    title="Your next steps"
                    action={
                      <button
                        className="text-button"
                        onClick={() => open("task")}
                      >
                        <Plus size={13} /> Add a step
                      </button>
                    }
                  >
                    <TaskList
                      tasks={tasks.filter((t) =>
                        view === "People"
                          ? t.category === "planning"
                          : view === "Documents"
                            ? t.category === "documents"
                            : view === "Accounts & policies"
                              ? t.category === "accounts"
                              : t.category === "giving",
                      )}
                      onEdit={(t) => open("task", t)}
                    />
                  </Panel>
                )}
              <section
                className="print-summary"
                aria-label="Complete permission-filtered plan summary"
              >
                <header>
                  <h1>Hearth · {household.name}</h1>
                  {state.fixture && <p>Illustrative records for a fictional family. These records do not establish real execution, payments, or legal authority.</p>}
                  <p>
                    {household.jurisdiction} ·{" "}
                    {statusLabels[household.stage] || household.stage} · View:{" "}
                    {previewRole !== "owner" ? previewRole : role}
                  </p>
                  <p>
                    Private, permission-filtered record. Recorded evidence is
                    not a legal validity or authority certification.
                  </p>
                </header>
                <h2>People and responsibilities</h2>
                {people.map((p) => (
                  <article key={p.id}>
                    <h3>
                      {p.name} · {p.role}
                    </h3>
                    <p>
                      {statusLabels[p.status] || p.status} · {p.access} access
                    </p>
                    <p>
                      {p.email} {p.note}
                    </p>
                  </article>
                ))}
                <h2>Documents and originals</h2>
                {documents.map((d) => (
                  <article key={d.id}>
                    <h3>
                      {d.title} · {d.kind}
                    </h3>
                    <p>
                      {statusLabels[d.status] || d.status} ·{" "}
                      {statusLabels[d.visibility] || d.visibility}
                    </p>
                    <p>Original: {d.originalLocation || "Not recorded"}</p>
                    <p>
                      Execution evidence:{" "}
                      {d.executionEvidence || "Not recorded"}
                    </p>
                    <p>{d.notes}</p>
                  </article>
                ))}
                <h2>Accounts and policies</h2>
                {accounts.map((a) => (
                  <article key={a.id}>
                    <h3>
                      {a.name} · {a.kind}
                    </h3>
                    <p>
                      {a.institution} {a.lastFour ? `ending ${a.lastFour}` : ""}{" "}
                      · {statusLabels[a.verification] || a.verification}
                    </p>
                    <p>
                      Recorded instructions:{" "}
                      {a.beneficiarySummary || "Not recorded"}
                    </p>
                    <p>
                      Intended arrangement: {a.desiredSummary || "Not recorded"}
                    </p>
                    <p>Evidence / notes: {a.notes || "Not recorded"}</p>
                  </article>
                ))}
                <h2>Claims and benefits</h2>
                {claims.map((c) => (
                  <article key={c.id}>
                    <h3>
                      {c.institution} · {c.claimant}
                    </h3>
                    <p>
                      {statusLabels[c.status] || c.status} ·{" "}
                      {c.reference || "No claim reference"}
                    </p>
                    <p>
                      Claimant authority:{" "}
                      {c.claimantAuthority || "Not recorded"}
                    </p>
                    <p>Requirements: {c.requirements || "Not recorded"}</p>
                    <p>
                      Submission evidence:{" "}
                      {c.submissionEvidence || "Not recorded"}
                    </p>
                    <p>
                      Next action: {c.nextAction || "Not recorded"}
                      {c.deadline ? ` · Deadline ${date(c.deadline)}` : ""}
                    </p>
                    <p>
                      Amount: {money(c.amount, c.currency)} · Payment evidence:{" "}
                      {c.paymentEvidence || "Not recorded"}
                    </p>
                  </article>
                ))}
                {ledgerVisible && (
                  <>
                    <h2>Estate money record - no funds moved by Hearth</h2>
                    <p>
                      Recorded balance{" "}
                      {money(ledgerDerived.recordedBalance, ledger.currency)} ·
                      reserve{" "}
                      {money(
                        ledgerDerived.reserve || ledger.reserve,
                        ledger.currency,
                      )}{" "}
                      · balance less reserve{" "}
                      {money(ledgerDerived.unallocated, ledger.currency)}. Not a
                      distribution recommendation.
                    </p>
                    <p>
                      Opening evidence:{" "}
                      {ledger.openingEvidence || "Not recorded"}
                    </p>
                    {transactions.map((t) => (
                      <article key={t.id}>
                        <h3>
                          {t.type} · {t.description}
                        </h3>
                        <p>
                          {t.payee} · {money(t.amount, ledger.currency)} ·{" "}
                          {t.status}
                        </p>
                        <p>{t.evidence || "No confirmation evidence"}</p>
                      </article>
                    ))}
                  </>
                )}
                <h2>Giving intentions</h2>
                {gifts.map((g) => (
                  <article key={g.id}>
                    <h3>
                      {g.recipient} · {g.cause}
                    </h3>
                    <p>{g.intention}</p>
                    <p>
                      Route: {g.route} · {statusLabels[g.status] || g.status}
                    </p>
                    <p>Evidence: {g.evidence || "Not recorded"}</p>
                    <p>
                      {g.registrationId} {g.url}
                    </p>
                  </article>
                ))}
                <h2>Next steps and completion evidence</h2>
                {tasks.map((t) => (
                  <article key={t.id}>
                    <h3>{t.title}</h3>
                    <p>
                      {t.owner || "No owner recorded"} ·{" "}
                      {statusLabels[t.status] || t.status}
                      {t.dueAt ? ` · Due ${date(t.dueAt)}` : ""}
                    </p>
                    {t.detail && <p>Guidance: {t.detail}</p>}{t.sourceQuote && <blockquote>{t.sourceQuote}</blockquote>}
                    <p>{t.evidence || "Completion evidence not recorded"}</p>
                  </article>
                ))}
                <h2>Authority review record</h2>
                <p>
                  {household.stage === "authority-reviewed"
                    ? `Review recorded by ${state.authority?.reviewer}. ${date(state.authority?.reviewedAt)}`
                    : "No completed authority review recorded."}
                </p>
                <h2>Legal sources</h2>
                {(state.sources || []).map((source: Item) => (
                  <p key={source.id}>
                    {source.title}: {source.url}
                  </p>
                ))}
                <footer>
                  Hearth · Private family preparation. This
                  summary contains only records available to the current
                  authorised view.
                </footer>
              </section>
              <footer className="workspace-footer">
                <span>
                  <Heart size={12} /> Hearth · Private family preparation
                </span>
                <a className="evaluation-link" href="/evaluation">Evaluation <ArrowUpRight size={11}/></a>
                <button
                  disabled={!data}
                  onClick={() => open("preferences", state.preferences)}
                >
                  Your pace & privacy
                </button>
                {owner && !isDemo && (
                  <button onClick={() => open("provider")}>
                    {data.provider.configured
                      ? "Meta connected"
                      : "Connect Meta AI"}
                    <span
                      className={`connection-dot ${data.provider.configured ? "connected" : ""}`}
                    />
                  </button>
                )}
              </footer>
            </>
          )}
        </main>
      </div>
      {data && <nav className="mobile-bottom-nav" aria-label="Quick navigation" inert={mobile || !!modal ? true : undefined}>
        {([["Home", Home], ["People", Users], ["Documents", FileText], ["When needed", FolderHeart]] as const).map(([name, Icon]) => <button key={name} aria-current={view === name ? "page" : undefined} onClick={() => navigate(name)}><Icon size={21}/><span>{name}</span></button>)}
        <button aria-label="More pages and settings" aria-expanded={mobile} aria-controls="primary-sidebar" className={["Accounts & policies","Giving","Practice"].includes(view) ? "more-active" : ""} onClick={(event) => {navigationTrigger.current=event.currentTarget;setMobile(true);}}><MoreHorizontal size={23}/><span>More</span></button>
      </nav>}
      {modal && (
        <div className="modal-backdrop" onMouseDown={() => closeFormRef.current()}>
          <section
            className={`modal ${["analysis", "review", "read-doc", "analyze-doc"].includes(modal) ? "wide" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            aria-describedby={!modalEditable ? "read-only-modal-description" : undefined}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              className="icon-button modal-close"
              onClick={() => closeFormRef.current()}
              disabled={!!busy || uploading}
              aria-label="Close form"
            >
              <X size={20} />
            </button>
            <p className="eyebrow">YOUR PLAN. YOUR PACE.</p>
            <h2 id="modal-title">{modalTitles[modal]}</h2>
            {!modalEditable && <div id="read-only-modal-description" className="read-only-form-note"><LockKeyhole size={15}/><span>{previewRole !== "owner" ? "This is a read-only permission preview. Return to your owner view to make changes." : "You can review this record. Changes require the appropriate plan role."}</span></div>}
            {discardPrompt && <div className="discard-confirmation" role="alert">
              <strong>Keep your changes?</strong>
              <p>This form has unsaved changes. Keep editing to save them, or discard this draft.</p>
              <div className="button-row"><Button secondary onClick={() => {setDiscardPrompt(false);setModal("");}}>Discard changes</Button><Button onClick={() => setDiscardPrompt(false)}>Keep editing</Button></div>
            </div>}
            <form onSubmit={saveForm}><ReadOnlyContext.Provider value={!modalEditable}>
              {modal === "person" && (
                <>
                  <Field
                    label="Name"
                    name="name"
                    form={form}
                    setForm={setForm}
                    required
                  />
                  <Field
                    label="Email"
                    name="email"
                    form={form}
                    setForm={setForm}
                    kind="email"
                  />
                  <div className="form-grid">
                    <Field
                      label="Role"
                      name="role"
                      form={form}
                      setForm={setForm}
                      options={[
                        ["helper", "Trusted helper"],
                        ["health-proxy", "Health-care proxy"],
                        ["emergency", "Emergency contact"],
                        ["representative", "Estate representative"],
                        ["professional", "Professional"],
                      ]}
                    />
                    <Field
                      label="Information needed"
                      name="access"
                      form={form}
                      setForm={setForm}
                      options={[
                        ["emergency", "Emergency information"],
                        ["documents", "Permitted documents"],
                        ["administration", "Administration records"],
                      ]}
                    />
                  </div>
                  <Field
                    label="Practical notes"
                    name="note"
                    form={form}
                    setForm={setForm}
                    kind="textarea"
                  />
                  <div className="form-note">
                    Recording a role is not a legal appointment. Online
                    workspace access uses a separate invitation.
                  </div>
                </>
              )}
              {modal === "document" && (
                <>
                  <Field
                    label="Document title"
                    name="title"
                    form={form}
                    setForm={setForm}
                    required
                  />
                  <div className="form-grid">
                    <Field
                      label="Document type"
                      name="kind"
                      form={form}
                      setForm={setForm}
                      options={[
                        ["will", "Will"],
                        ["care", "Care instructions"],
                        ["letter", "Personal letter"],
                        ["other", "Other"],
                      ]}
                    />
                    <Field
                      label="Recorded status"
                      name="status"
                      form={form}
                      setForm={setForm}
                      options={[
                        ["draft", "Draft - execution still needed"],
                        ["executed", "Execution evidence recorded"],
                        ["superseded", "Superseded record"],
                      ]}
                    />
                  </div>
                  <Field
                    label="Where is the original?"
                    name="originalLocation"
                    form={form}
                    setForm={setForm}
                    help="Location and a safe contact path. Do not include access passwords."
                  />
                  <Field
                    label="Execution evidence"
                    name="executionEvidence"
                    form={form}
                    setForm={setForm}
                    kind="textarea"
                    help="Who checked the process, when, and the supporting reference. Not a validity certification."
                  />
                  <Field
                    label="Who may see this record?"
                    name="visibility"
                    form={form}
                    setForm={setForm}
                    options={visibilityOptions}
                  />
                  <Field
                    label="Notes"
                    name="notes"
                    form={form}
                    setForm={setForm}
                    kind="textarea"
                  />
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.txt,application/pdf,image/png,image/jpeg,text/plain"
                    className="hidden"
                    ref={fileRef}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) upload(f);
                      e.target.value = "";
                    }}
                  />
                  <div className={`attachment-area ${draggingFile ? "dragging" : ""}`}
                    onDragOver={e => {e.preventDefault();if(modalEditable && !uploading)setDraggingFile(true);}}
                    onDragLeave={e => {if(!e.currentTarget.contains(e.relatedTarget as Node))setDraggingFile(false);}}
                    onDrop={e => {e.preventDefault();setDraggingFile(false);if(modalEditable && !uploading){const file=e.dataTransfer.files[0];if(file)upload(file);}}}>
                    <button type="button" className={`upload-zone ${form.fileId ? "has-attachment" : ""}`} onClick={() => fileRef.current?.click()} disabled={uploading || !modalEditable || offline} aria-label={form.fileId ? "Replace attachment" : "Choose an attachment"}>
                      <span className="attachment-icon">{uploading ? <LoaderCircle className="spin" size={23}/> : form.fileId ? <FileText size={23}/> : <Upload size={23}/>}</span>
                      <span className="attachment-copy"><strong>{uploading ? "Attaching your file…" : form.fileId ? form.fileName || "Your saved attachment" : "Keep a copy here"}</strong><small>{uploading ? "Please keep this form open." : form.fileId ? "Attached privately. Choose a different file to replace it." : "Choose a file or drop it here. PDF, PNG, JPEG or text, up to 5 MB."}</small></span>
                      {form.fileId && !uploading && <Check size={18}/>}
                    </button>
                    <p className="attachment-privacy"><LockKeyhole size={12}/>{form.fileId ? "Save this record to keep the attachment with your plan." : "Only people permitted to see this record can download it."}</p>
                  </div>
                </>
              )}
              {modal === "account" && (
                <>
                  <Field
                    label="Account or policy name"
                    name="name"
                    form={form}
                    setForm={setForm}
                    required
                  />
                  <div className="form-grid">
                    <Field
                      label="Type"
                      name="kind"
                      form={form}
                      setForm={setForm}
                      options={[
                        ["bank", "Bank account"],
                        ["retirement", "Retirement account"],
                        ["insurance", "Life insurance"],
                        ["property", "Property"],
                      ]}
                    />
                    <Field
                      label="Institution"
                      name="institution"
                      form={form}
                      setForm={setForm}
                      required
                    />
                  </div>
                  <Field
                    label="Last four digits only"
                    name="lastFour"
                    form={form}
                    setForm={setForm}
                  />
                  <Field
                    label="Recorded beneficiary / ownership instructions"
                    name="beneficiarySummary"
                    form={form}
                    setForm={setForm}
                    kind="textarea"
                  />
                  <Field
                    label="Your intended arrangement"
                    name="desiredSummary"
                    form={form}
                    setForm={setForm}
                    kind="textarea"
                  />
                  <Field
                    label="Evidence level"
                    name="verification"
                    form={form}
                    setForm={setForm}
                    options={[
                      ["document-only", "Found in a document"],
                      ["owner-confirmed", "Confirmed by owner"],
                      ["institution-confirmed", "Confirmed by institution"],
                    ]}
                  />
                  <Field
                    label="Confirmation evidence / review notes"
                    name="notes"
                    form={form}
                    setForm={setForm}
                    kind="textarea"
                    help="Institution confirmation requires a meaningful supporting reference."
                  />
                  <Field
                    label="Who may see this record?"
                    name="visibility"
                    form={form}
                    setForm={setForm}
                    options={visibilityOptions}
                  />
                </>
              )}
              {modal === "claim" && (
                <>
                  <p className="modal-intro">
                    Each beneficiary needs their own permitted claim route. An
                    estate representative’s authority does not automatically
                    cover another person’s insurance claim.
                  </p>
                  <Field
                    label="Linked policy record"
                    name="accountId"
                    form={form}
                    setForm={setForm}
                    options={[
                      ["", "Select a recorded policy"],
                      ...accounts
                        .filter((a) => a.kind === "insurance")
                        .map((a) => [a.id, a.name] as [string, string]),
                    ]}
                  />
                  <div className="form-grid">
                    <Field
                      label="Claimant"
                      name="claimant"
                      form={form}
                      setForm={setForm}
                      required
                    />
                    <Field
                      label="Insurer / institution"
                      name="institution"
                      form={form}
                      setForm={setForm}
                      required
                    />
                  </div>
                  <Field
                    label="Claimant authority evidence"
                    name="claimantAuthority"
                    form={form}
                    setForm={setForm}
                    kind="textarea"
                    help="Record why this claimant is entitled to apply. Required before recording a submitted or later stage."
                  />
                  <Field
                    label="Recorded claim stage"
                    name="status"
                    form={form}
                    setForm={setForm}
                    options={[
                      ["preparing", "Preparing"],
                      ["submitted", "Submission recorded"],
                      [
                        "information-requested",
                        "Insurer requested information",
                      ],
                      ["approved", "Insurer approval recorded"],
                      ["paid", "Payment receipt recorded"],
                      ["disputed", "Denied or disputed - professional review"],
                    ]}
                  />
                  <Field
                    label="Claim reference"
                    name="reference"
                    form={form}
                    setForm={setForm}
                  />
                  <Field
                    label="Insurer-specific requirements"
                    name="requirements"
                    form={form}
                    setForm={setForm}
                    kind="textarea"
                  />
                  <Field
                    label="Next action and responsible person"
                    name="nextAction"
                    form={form}
                    setForm={setForm}
                    kind="textarea"
                  />
                  <Field
                    label="Actual insurer / appeal deadline, if known"
                    name="deadline"
                    form={form}
                    setForm={setForm}
                    kind="datetime-local"
                    help="Preserve the applicable route and deadline. A regulator complaint does not replace a required appeal."
                  />
                  <Field
                    label="Submission evidence"
                    name="submissionEvidence"
                    form={form}
                    setForm={setForm}
                    kind="textarea"
                  />
                  <div className="form-grid">
                    <Field
                      label="Recorded benefit / paid amount"
                      name="amount"
                      form={form}
                      setForm={setForm}
                      help="Use exact decimal notation, e.g. 25000.00."
                    />
                    <Field
                      label="Currency"
                      name="currency"
                      form={form}
                      setForm={setForm}
                      options={[["USD", "USD - initial supported currency"]]}
                    />
                  </div>
                  <Field
                    label="Payment evidence"
                    name="paymentEvidence"
                    form={form}
                    setForm={setForm}
                    kind="textarea"
                    help="Paid requires evidence of actual receipt and a positive amount. Approval is not payment."
                  />
                  <Field
                    label="Who may see this claim?"
                    name="visibility"
                    form={form}
                    setForm={setForm}
                    options={visibilityOptions}
                  />
                </>
              )}
              {modal === "ledger" && (
                <>
                  <p className="modal-intro">
                    Record funds actually received into the estate account and
                    the reserve set by the responsible professional. This is an
                    external money record; Hearth never holds or moves funds.
                  </p>
                  <div className="form-grid">
                    <Field
                      label="Opening estate balance"
                      name="openingBalance"
                      form={form}
                      setForm={setForm}
                      required
                      help="Exact amount, e.g. 120000.00"
                    />
                    <Field
                      label="Currency"
                      name="currency"
                      form={form}
                      setForm={setForm}
                      options={[["USD", "USD - initial supported currency"]]}
                    />
                  </div>
                  <Field
                    label="Opening balance evidence"
                    name="openingEvidence"
                    form={form}
                    setForm={setForm}
                    kind="textarea"
                    required
                    help="Bank statement, reconciliation, date, and reviewing person."
                  />
                  <Field
                    label="Recorded reserve"
                    name="reserve"
                    form={form}
                    setForm={setForm}
                    required
                    help="Exact amount. A balance less reserve is not permission to distribute."
                  />
                  <div className="form-note">
                    Do not add insurance or retirement benefits that pass
                    directly to named beneficiaries unless the responsible
                    professionals confirm they belong in this estate record.
                  </div>
                </>
              )}
              {modal === "transaction" && (
                <>
                  <p className="modal-intro">
                    Record an external transaction or prepare a proposed entry.
                    No payment instruction is sent. Confirmation requires
                    evidence and the appropriate authority.
                  </p>
                  <div className="form-grid">
                    <Field
                      label="Entry type"
                      name="type"
                      form={form}
                      setForm={setForm}
                      options={[
                        ["inflow", "Inflow"],
                        ["expense", "Expense"],
                        ["distribution", "Distribution"],
                      ]}
                    />
                    <Field
                      label="Exact amount"
                      name="amount"
                      form={form}
                      setForm={setForm}
                      required
                      help="Positive amount, e.g. 8000.00"
                    />
                  </div>
                  <Field
                    label="Payee / source"
                    name="payee"
                    form={form}
                    setForm={setForm}
                    required
                  />
                  <Field
                    label="Description"
                    name="description"
                    form={form}
                    setForm={setForm}
                    required
                  />
                  <Field
                    label="Recorded state"
                    name="status"
                    form={form}
                    setForm={setForm}
                    options={[
                      ["proposed", "Proposed - not completed"],
                      ["confirmed", "Confirmed with external evidence"],
                    ]}
                  />
                  <Field
                    label="Confirmation evidence"
                    name="evidence"
                    form={form}
                    setForm={setForm}
                    kind="textarea"
                    help="Actual bank confirmation and authorisation / professional approval reference."
                  />
                  <div className="form-note">
                    A proposed entry does not reduce the recorded balance.
                    Confirmed outflows cannot overdraw it. A correct calculation
                    does not establish legal permission to distribute.
                  </div>
                </>
              )}
              {modal === "gift" && (
                <>
                  <Field
                    label="Your selected recipient"
                    name="recipient"
                    form={form}
                    setForm={setForm}
                    required
                  />
                  <div className="form-grid">
                    <Field
                      label="Registration identifier"
                      name="registrationId"
                      form={form}
                      setForm={setForm}
                    />
                    <Field
                      label="Cause or connection"
                      name="cause"
                      form={form}
                      setForm={setForm}
                    />
                  </div>
                  <Field
                    label="Official recipient link (https)"
                    name="url"
                    form={form}
                    setForm={setForm}
                    kind="url"
                  />
                  <Field
                    label="What would you like to support?"
                    name="intention"
                    form={form}
                    setForm={setForm}
                    kind="textarea"
                    required
                  />
                  <div className="form-grid">
                    <Field
                      label="Possible route"
                      name="route"
                      form={form}
                      setForm={setForm}
                      options={[
                        ["undecided", "Not decided yet"],
                        ["will", "Reviewed will instruction"],
                        ["beneficiary", "Institution beneficiary process"],
                        ["give-now", "Gift now"],
                      ]}
                    />
                    <Field
                      label="Recorded stage"
                      name="status"
                      form={form}
                      setForm={setForm}
                      options={[
                        ["intention", "Intention saved"],
                        ["reviewed", "Professional review recorded"],
                        ["executed", "Instruction execution recorded"],
                        ["received", "Recipient receipt recorded"],
                      ]}
                    />
                  </div>
                  <Field
                    label="Review, execution, or receipt evidence"
                    name="evidence"
                    form={form}
                    setForm={setForm}
                    kind="textarea"
                  />
                  <Field
                    label="Who may see this intention?"
                    name="visibility"
                    form={form}
                    setForm={setForm}
                    options={visibilityOptions}
                  />
                  <div className="form-note">
                    A saved intention is not a legal instruction or a completed
                    donation. Hearth does not receive or transfer funds.
                  </div>
                </>
              )}
              {modal === "task" && (
                <>
                  {(form.detail || form.sourceQuote) && <details className="task-context" open>
                    <summary><BookOpen size={15}/> Instructions and source</summary>
                    {form.detail && <p>{form.detail}</p>}
                    {form.sourceQuote && <blockquote>{form.sourceQuote}<cite>Source wording preserved from the accepted suggestion</cite></blockquote>}
                  </details>}
                  <Field
                    label="Next step"
                    name="title"
                    form={form}
                    setForm={setForm}
                    required
                  />
                  <div className="form-grid">
                    <Field
                      label="Area"
                      name="category"
                      form={form}
                      setForm={setForm}
                      options={[
                        ["planning", "People & planning"],
                        ["documents", "Documents"],
                        ["accounts", "Accounts & policies"],
                        ["giving", "Giving"],
                        ["administration", "Administration"],
                      ]}
                    />
                    <Field
                      label="Responsible person"
                      name="owner"
                      form={form}
                      setForm={setForm}
                    />
                  </div>
                  <Field
                    label="Recorded state"
                    name="status"
                    form={form}
                    setForm={setForm}
                    options={[
                      ["open", "Open"],
                      ["professional-review", "Professional review needed"],
                      ["complete", "Completed with evidence"],
                    ]}
                  />
                  <Field
                    label="Completion evidence / handoff reference"
                    name="evidence"
                    form={form}
                    setForm={setForm}
                    kind="textarea"
                  />
                  <Field
                    label="Real deadline, if applicable"
                    name="dueAt"
                    form={form}
                    setForm={setForm}
                    kind="datetime-local"
                  />
                </>
              )}
              {modal === "invite" && (
                <>
                  <p className="modal-intro">
                    Create a private invitation for a specific signed-in email.
                    The link is not sent automatically. Membership does not
                    establish legal authority.
                  </p>
                  <Field
                    label="Invited email"
                    name="email"
                    form={form}
                    setForm={setForm}
                    kind="email"
                    required
                  />
                  <div className="form-grid">
                    <Field
                      label="Workspace role"
                      name="role"
                      form={form}
                      setForm={setForm}
                      options={[
                        ["helper", "Trusted helper"],
                        ["professional", "Professional"],
                        ["adviser", "Adviser"],
                      ]}
                    />
                    <Field
                      label="Permitted information"
                      name="access"
                      form={form}
                      setForm={setForm}
                      options={[
                        ["emergency", "Emergency"],
                        ["documents", "Documents"],
                        ["administration", "Administration"],
                      ]}
                    />
                  </div>
                  {invitationUrl && (
                    <div className="invitation-created">
                      <CheckCheck size={20} />
                      <strong>Invitation link created, not sent.</strong>
                      <input
                        aria-label="Invitation link"
                        value={invitationUrl}
                        readOnly
                      />
                      <button
                        type="button"
                        className="text-button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(invitationUrl);
                            setNotice("Invitation link copied.");
                          } catch {
                            setNotice(
                              "Select and copy the invitation link above.",
                            );
                          }
                        }}
                      >
                        <Copy size={13} /> Copy invitation link
                      </button>
                    </div>
                  )}
                </>
              )}
              {modal === "extract" && (
                <>
                  <p className="modal-intro">
                    Read the attached file for{" "}
                    <strong>{activeDocument?.title || "this document"}</strong>.
                    Meta will propose a transcription and flag uncertainty. You
                    must check it against the original before it becomes
                    confirmed source text.
                  </p>
                  <div className="form-note">
                    Transcription never changes the document’s draft, execution,
                    or original-location status. It cannot certify signatures,
                    witnessing, capacity, or legal validity.
                  </div>
                  <label className="consent-check">
                    <input
                      type="checkbox"
                      checked={!!form.consent}
                      onChange={(e) =>
                        setForm({ ...form, consent: e.target.checked })
                      }
                    />
                    <span>
                      I am authorised to share this attachment and consent to
                      sending its contents to Meta for transcription.
                    </span>
                  </label>
                  {activeDocument?.fileId && (
                    <a
                      className="text-button attachment-original"
                      href={`/api/files?id=${encodeURIComponent(activeDocument.fileId)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ArrowUpRight size={13} /> Open the attached original
                    </a>
                  )}
                </>
              )}
              {modal === "read-doc" && (
                <>
                  <p className="modal-intro">
                    <strong>{activeDocument?.title}</strong> ·{" "}
                    {activeDocument?.extraction?.model ? modelName(activeDocument.extraction.model) : "Model transcription"}
                    . Check every part against the original, particularly names,
                    dates, shares, negations, and execution references. Model
                    output is not accepted automatically.
                  </p>
                  {activeDocument?.fileId && (
                    <a
                      className="text-button attachment-original"
                      href={`/api/files?id=${encodeURIComponent(activeDocument.fileId)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ArrowUpRight size={13} /> Open original for comparison
                    </a>
                  )}
                  <label className="field transcription-text">
                    <span>
                      {activeDocument?.extraction?.status === "accepted"
                        ? "Confirmed source text"
                        : "Proposed transcription - correct any reading errors"}
                    </span>
                    <textarea
                      readOnly={
                        !modalEditable || activeDocument?.extraction?.status === "accepted"
                      }
                      rows={12}
                      value={
                        activeDocument?.extraction?.status === "accepted"
                          ? activeDocument?.extraction?.text || ""
                          : (form.correctedText ??
                            activeDocument?.extraction?.text ??
                            "")
                      }
                      onChange={(e) =>
                        setForm({
                          ...form,
                          correctedText: e.target.value,
                          confirmed: false,
                        })
                      }
                    />
                  </label>
                  <div className="transcription-uncertainties">
                    <h3>Reported uncertainty</h3>
                    {activeDocument?.extraction?.uncertainties?.length ? (
                      <ul>
                        {activeDocument.extraction.uncertainties.map(
                          (u: string, i: number) => (
                            <li key={i}>
                              <CircleAlert size={13} />
                              {u}
                            </li>
                          ),
                        )}
                      </ul>
                    ) : (
                      <p>
                        The model reported no uncertainty. This does not
                        establish that the text is accurate.
                      </p>
                    )}
                  </div>
                  {activeDocument?.extraction?.status === "accepted" ? (
                    <div className="transcription-accepted">
                      <CheckCheck size={19} />
                      <span>
                        Text acceptance is recorded. Document execution status
                        is unchanged.
                      </span>
                    </div>
                  ) : (
                    <label className="consent-check">
                      <input
                        type="checkbox"
                        checked={!!form.confirmed}
                        onChange={(e) =>
                          setForm({ ...form, confirmed: e.target.checked })
                        }
                      />
                      <span>
                        I checked this transcription against the original and
                        confirm it is accurate for source-text review. If
                        anything is wrong or unresolved, I will leave it
                        unaccepted.
                      </span>
                    </label>
                  )}
                  <div className="form-note">
                    This acknowledgement concerns the words transcribed, not the
                    legal effectiveness or authenticity of the document.
                  </div>
                </>
              )}
              {modal === "analyze-doc" && (
                <>
                  <p className="modal-intro">
                    Ask Meta to propose source-linked questions and practical
                    next steps from the confirmed text of{" "}
                    <strong>{activeDocument?.title}</strong>. Each suggestion
                    remains a proposal until you review it.
                  </p>
                  <div className="form-note">
                    Accepted source text is used; no legal document, institution
                    instruction, or access permission is changed automatically.
                  </div>
                  <label className="consent-check">
                    <input
                      type="checkbox"
                      checked={!!form.consent}
                      onChange={(e) =>
                        setForm({ ...form, consent: e.target.checked })
                      }
                    />
                    <span>
                      I am authorised to share this confirmed document text and
                      consent to sending it to Meta for this review.
                    </span>
                  </label>
                </>
              )}
              {modal === "analysis" && (
                <>
                  <p className="modal-intro">
                    Paste text you are authorised to share. Hearth asks Meta to
                    suggest questions and practical next steps. Exact source
                    quotes remain visible; accepting a proposal creates a task,
                    not a legal finding.
                  </p>
                  <Field
                    label="Document text"
                    name="text"
                    form={form}
                    setForm={setForm}
                    kind="textarea"
                    required
                  />
                  <label className="consent-check">
                    <input
                      type="checkbox"
                      checked={!!form.consent}
                      onChange={(e) =>
                        setForm({ ...form, consent: e.target.checked })
                      }
                    />
                    <span>
                      I am authorised to share this text and consent to sending
                      it to Meta for this review.
                    </span>
                  </label>
                  <div className="form-note">
                    {data?.provider.configured
                      ? `Live model: ${data.provider.model}. Review every suggestion.`
                      : "A Meta API connection is needed for live analysis. You can keep using the record workflows without it."}
                  </div>
                </>
              )}
              {modal === "review" && (
                <>
                  <p className="modal-intro">
                    Muse Wonder reviews the records in your plan together:
                    accepted helper roles, document status, located originals,
                    account instructions, policies, and giving intentions. It
                    proposes source-linked review tasks, not legal conclusions
                    or executed changes.
                  </p>
                  <div className="review-scope">
                    <span>
                      <Users size={16} /> {people.length} people
                    </span>
                    <span>
                      <FileText size={16} /> {documents.length} documents
                    </span>
                    <span>
                      <WalletCards size={16} /> {accounts.length} accounts &
                      policies
                    </span>
                    <span>
                      <Leaf size={16} /> {gifts.length} giving intentions
                    </span>
                  </div>
                  <label className="consent-check">
                    <input
                      type="checkbox"
                      checked={!!form.consent}
                      onChange={(e) =>
                        setForm({ ...form, consent: e.target.checked })
                      }
                    />
                    <span>
                      I am authorised to share these plan records and consent to
                      sending them to Meta for this review.
                    </span>
                  </label>
                  <div className="form-note">
                    Each suggestion needs your review. Accepting creates a next
                    step; it does not change your legal documents, account
                    instructions, or access permissions.
                  </div>
                </>
              )}
              {modal === "acknowledge" && (
                <>
                  <p className="modal-intro">
                    Record what the person acknowledged and how. This records
                    your evidence; it does not claim they accepted an online
                    invitation.
                  </p>
                  <Field
                    label="Acknowledgement evidence"
                    name="evidence"
                    form={form}
                    setForm={setForm}
                    kind="textarea"
                    required
                  />
                </>
              )}
              {modal === "death" && (
                <>
                  <p className="modal-intro">
                    A report preserves the current plan and opens the review
                    process. It does not release private records or grant
                    authority to relatives.
                  </p>
                  <Field
                    label="Report evidence / authoritative record reference"
                    name="evidence"
                    form={form}
                    setForm={setForm}
                    kind="textarea"
                    required
                  />
                  <div className="form-note">
                    Use a qualified professional for questions about authority,
                    urgent obligations, or disputes. This is a recorded report,
                    not an independent registry check.
                  </div>
                </>
              )}
              {modal === "authority" && (
                <>
                  <p className="modal-intro">
                    Keep each evidence requirement separate. For a real plan, an
                    authorised professional member records the review. A helper
                    role alone cannot unlock the estate workflow.
                  </p>
                  <Field
                    label="Death evidence and review"
                    name="deathEvidence"
                    form={form}
                    setForm={setForm}
                    kind="textarea"
                    required
                  />
                  <Field
                    label="Recipient identity evidence"
                    name="identityEvidence"
                    form={form}
                    setForm={setForm}
                    kind="textarea"
                    required
                  />
                  <Field
                    label="Appointment / authority evidence"
                    name="appointmentEvidence"
                    form={form}
                    setForm={setForm}
                    kind="textarea"
                    required
                  />
                  <Field
                    label="Responsible professional reviewer"
                    name="reviewer"
                    form={form}
                    setForm={setForm}
                    required
                  />
                  <div className="form-note">
                    Recording this attestation does not independently verify a
                    certificate, court order, or legal appointment.
                  </div>
                </>
              )}
              {modal === "new" && (
                <>
                  <p className="modal-intro">
                    Start a separate empty plan. The current illustrative record
                    will be replaced in your workspace. You can export it first
                    if you want a copy.
                  </p>
                  <Field
                    label="Name of the person this plan is for"
                    name="name"
                    form={form}
                    setForm={setForm}
                    required
                  />
                  <Field
                    label="Initial jurisdiction"
                    name="jurisdiction"
                    form={form}
                    setForm={setForm}
                    options={[["Florida", "Florida, United States"]]}
                  />
                  <Field
                    label="What brings you here?"
                    name="mode"
                    form={form}
                    setForm={setForm}
                    options={[
                      ["planning", "I’m planning ahead"],
                      ["helping", "I’m helping someone, with permission"],
                      ["bereaved", "Someone has died"],
                    ]}
                  />
                  <div className="form-note">
                    The initial workflow is scoped to Florida. It does not
                    provide legal representation or certify document validity.
                  </div>
                </>
              )}
              {modal === "preferences" && (
                <>
                  <Field
                    label="How often should we prompt you?"
                    name="contactFrequency"
                    form={form}
                    setForm={setForm}
                    options={[
                      ["Only when I ask", "Only when I ask"],
                      ["Monthly review", "Monthly review preference"],
                      ["Quarterly review", "Quarterly review preference"],
                    ]}
                  />
                  <Field
                    label="A private note for yourself"
                    name="privateNote"
                    form={form}
                    setForm={setForm}
                    kind="textarea"
                  />
                  <div className="form-note">
                    This saves your preference. Scheduled email or SMS delivery
                    is not enabled. Your institutional sponsor does not
                    automatically receive private wishes.
                  </div>
                  <div className="modal-links">
                    <a
                      href={
                        previewRole === "owner"
                          ? "/api/export"
                          : `/api/export?previewRole=${previewRole}&access=${previewAccess}`
                      }
                    >
                      Export permission-filtered records{" "}
                      <ArrowDownToLine size={13} />
                    </a>
                    {owner && previewRole === "owner" && (
                      <a href="/api/history">
                        Export prior plan versions <ArrowDownToLine size={13} />
                      </a>
                    )}
                    <button type="button" onClick={() => window.print()}>
                      Print this plan <FileText size={13} />
                    </button>
                    <a href="/evaluation">Product evaluation <ArrowUpRight size={13}/></a>
                    <button type="button" disabled={!!busy} onClick={signOut}>Sign out <ArrowUpRight size={13}/></button>
                  </div>
                </>
              )}
              {modal === "provider" && (
                <>
                  <p className="modal-intro">
                    Your owner-scoped API key is encrypted at rest and used on
                    the server. It is not shared with helpers, included in
                    exports, or sent to the browser after saving.
                  </p>
                  <Field
                    label="Meta Model API key"
                    name="apiKey"
                    form={form}
                    setForm={setForm}
                    kind="password"
                    required
                  />
                  <div className="connection-summary">
                    <span
                      className={`connection-dot ${data?.provider.configured ? "connected" : ""}`}
                    />
                    {data?.provider.configured
                      ? "An API key is already configured"
                      : "No Meta API key configured"}
                  </div>
                  <div className="form-note">
                    Analysis uses {data?.provider.model || "muse-spark-1.3"}. No
                    document text is sent for AI review until you explicitly
                    consent.
                  </div>
                </>
              )}
              {error && (
                <div className="modal-error" role="alert">
                  <CircleAlert size={15} />
                  {error}
                </div>
              )}
              {(!!busy || uploading) && (
                <div className="form-note" role="status" aria-live="polite">
                  {uploading
                    ? "Uploading your encrypted attachment…"
                    : ["analysis", "review", "extract", "analyze-doc"].includes(
                          modal,
                        )
                      ? "Meta is reviewing your source. This can take a little time…"
                      : modal === "provider"
                        ? "Checking your Meta connection…"
                        : "Saving your changes…"}
                </div>
              )}
              <div className="modal-footer">
                {modal === "read-doc" &&
                  activeDocument?.extraction?.status === "accepted" && (
                    <Button
                      onClick={() => open("analyze-doc", { id: form.id })}
                      disabled={!!busy || previewRole !== "owner"}
                    >
                      <Sparkles size={14} /> Review confirmed text
                    </Button>
                  )}
                <Button secondary onClick={() => closeFormRef.current()} disabled={!!busy || uploading}>
                  {!modalEditable || (modal === "read-doc" && activeDocument?.extraction?.status === "accepted") ? "Close" : "Not now"}
                </Button>
                {modalEditable && !(modal === "read-doc" && activeDocument?.extraction?.status === "accepted") && <Button
                  type="submit"
                  disabled={
                    previewRole !== "owner" ||
                    !!busy ||
                    uploading ||
                    offline ||
                    (["analysis", "review", "extract", "analyze-doc"].includes(
                      modal,
                    ) &&
                      (!form.consent || !data?.provider.configured)) ||
                    (modal === "read-doc" &&
                      (!form.confirmed ||
                        activeDocument?.extraction?.status === "accepted")) ||
                    (modal === "ledger" && !canReview) ||
                    (modal === "transaction" && !canRecordMoney) ||
                    (!canReview && modal === "claim") ||
                    (!owner &&
                      [
                        "person",
                        "document",
                        "account",
                        "gift",
                        "analysis",
                        "review",
                        "extract",
                        "read-doc",
                        "analyze-doc",
                        "invite",
                        "new",
                        "preferences",
                        "provider",
                        "acknowledge",
                      ].includes(modal))
                  }
                >
                  {busy ? (
                    <LoaderCircle className="spin" size={15} />
                  ) : ["analysis", "review"].includes(modal) ? (
                    <Sparkles size={15} />
                  ) : (
                    <Check size={15} />
                  )}{" "}
                  {["analysis", "review"].includes(modal)
                    ? "Review with Meta"
                    : modal === "invite"
                      ? "Create invitation"
                      : modal === "new"
                        ? "Create my plan"
                        : modal === "provider"
                          ? "Save secure connection"
                          : modal === "extract"
                            ? "Read attachment with Meta"
                            : modal === "analyze-doc"
                              ? "Review confirmed text"
                              : modal === "read-doc"
                                ? "Accept checked transcription"
                                : "Save to my plan"}
                </Button>}
              </div>
            </ReadOnlyContext.Provider></form>
          </section>
        </div>
      )}
    </div>
  );
}
function Glance({
  icon: Icon,
  title,
  text,
  value,
  onClick,
}: {
  icon: any;
  title: string;
  text: string;
  value: number;
  onClick: () => void;
}) {
  return (
    <button className="glance-row" onClick={onClick}>
      <span className="glance-icon">
        <Icon size={17} />
      </span>
      <span>
        <strong>{title}</strong>
        <small>{text}</small>
      </span>
      <b>{value}</b>
      <ChevronRight size={13} />
    </button>
  );
}
function SearchBox({
  value,
  setValue,
  label,
}: {
  value: string;
  setValue: (v: string) => void;
  label: string;
}) {
  return (
    <div className="search-box">
      <Search size={15} />
      <input
        aria-label={label}
        placeholder={label + "…"}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {if(e.key === "Escape")setValue("");}}
      />
      {!!value && <button className="search-clear" type="button" aria-label="Clear search" onClick={(event) => {setValue("");(event.currentTarget.previousElementSibling as HTMLInputElement)?.focus();}}><X size={15}/></button>}
    </div>
  );
}
function TaskList({
  tasks,
  onEdit,
}: {
  tasks: Item[];
  onEdit: (t: Item) => void;
}) {
  return (
    <div className="task-list">
      {tasks.map((t) => (
        <article className="task-record" key={t.id}>
          <button
            className="task-record-main"
            onClick={() => onEdit({ ...t, dueAt: localInput(t.dueAt) })}
          >
            <span
              className={`task-check ${t.status === "complete" ? "checked" : ""}`}
            >
              {t.status === "complete" && <Check size={12} />}
            </span>
            <span>
              <strong>{t.title}</strong>
              <small>
                {t.owner || "No owner recorded"}
                {t.dueAt ? ` · Due ${date(t.dueAt)}` : ""}
                {t.evidence ? ` · ${t.evidence}` : ""}
              </small>
            </span>
            <Badge value={t.status} />
            <ChevronRight size={13} />
          </button>
          {(t.detail || t.sourceQuote) && (
            <details className="task-instructions">
              <summary>
                <BookOpen size={13} /> What to do and why
              </summary>
              {t.detail && <p>{t.detail}</p>}
              {t.sourceQuote && (
                <blockquote>
                  {t.sourceQuote}
                  <cite>
                    Source wording preserved from the accepted suggestion
                  </cite>
                </blockquote>
              )}
            </details>
          )}
        </article>
      ))}
      {!tasks.length && (
        <p className="empty-list">
          No steps recorded in this area. Add only what is useful.
        </p>
      )}
    </div>
  );
}

function AuthorityStep({
  number,
  title,
  text,
  complete,
}: {
  number: string;
  title: string;
  text: string;
  complete: boolean;
}) {
  return (
    <div className={`authority-step ${complete ? "done" : ""}`}>
      <span>{complete ? <Check size={14} /> : number}</span>
      <div>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
    </div>
  );
}
function modelName(value?: string) {
  if (!value) return "Model not recorded";
  if (value.includes("wonder-1.0")) return "Muse Wonder 1.0";
  if (value.includes("wonder")) return "Muse Wonder";
  if (value.includes("spark-1.3")) return "Muse Spark 1.3";
  if (value.includes("spark")) return "Muse Spark";
  return value;
}
function ProposalReview({
  proposals,
  sources,
  canAudit,
  busy,
  onAction,
  onOpenTask,
}: {
  proposals: Item[];
  sources: Item[];
  canAudit: boolean;
  busy: string;
  onAction: (action: string, payload: Item) => Promise<boolean>;
  onOpenTask?: (proposal: Item) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const pending = proposals.filter((p) => p.status === "pending");
  const shown = showAll
    ? [...pending, ...proposals.filter((p) => p.status !== "pending")]
    : pending.slice(0, 3);
  if (!proposals.length) return null;
  return (
    <Panel
      title="Questions and next steps to review"
      eyebrow="AI PROPOSALS - NOT LEGAL FINDINGS"
      action={<span className="soft-count">{pending.length} to review</span>}
    >
      <div className="proposals">
        {shown.map((p) => {
          const source = sources.find((s) => s.id === p.sourceId),
            sourceModel = source?.model || p.model,
            label = sourceModel?.includes("wonder")
              ? "Your family-plan snapshot"
              : "Your provided document text";
          return (
            <article key={p.id}>
              <div className="proposal-heading">
                <Sparkles size={17} />
                <h3>{p.title}</h3>
                <Badge value={p.status}>
                  {p.status === "accepted"
                    ? "Next step created"
                    : p.status === "dismissed"
                      ? "Dismissed"
                      : "Review needed"}
                </Badge>
              </div>
              <p>{p.detail}</p>
              <blockquote>
                {p.sourceQuote}
                <cite>
                  {label}
                  {sourceModel ? ` · ${modelName(sourceModel)}` : ""}
                  {source?.at ? ` · ${date(source.at)}` : ""}
                </cite>
              </blockquote>
              {canAudit && source && (
                <details className="proposal-source">
                  <summary>
                    <BookOpen size={13} /> Inspect the source snapshot
                  </summary>
                  <div className="proposal-source-meta">
                    <span>
                      {modelName(source.model)} · {date(source.at)}
                    </span>
                    <span className="source-saved-note"><ShieldCheck size={14}/> Original review input preserved</span>
                  </div>
                  <pre>{source.text}</pre>
                  <small>
                    This is the saved input for the suggestion. It does not
                    establish execution, institution acceptance, or legal
                    validity.
                  </small>
                </details>
              )}
              {p.status === "accepted" && onOpenTask && <button className="text-button accepted-task-link" onClick={()=>onOpenTask(p)}>Open the next step <ArrowRight size={13}/></button>}
              {p.status === "pending" && (
                <div className="button-row">
                  <Button
                    secondary
                    onClick={() => onAction("dismiss-proposal", { id: p.id })}
                    disabled={!!busy}
                  >
                    Dismiss
                  </Button>
                  <Button
                    onClick={() => onAction("accept-proposal", { id: p.id })}
                    disabled={!!busy}
                  >
                    <Plus size={13} /> Create a next step
                  </Button>
                </div>
              )}
            </article>
          );
        })}
      </div>
      {!shown.length && (
        <div className="review-clear">
          <CheckCheck size={23} />
          <div>
            <h3>No suggestions waiting for review.</h3>
            <p>
              Accepted suggestions are preserved as practical next steps,
              including their instructions and source wording.
            </p>
          </div>
        </div>
      )}
      {(proposals.length > shown.length || showAll) && (
        <button
          className="suggestions-toggle text-button"
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll
            ? "Show up to 3 pending suggestions"
            : `Review all ${proposals.length} suggestions`}{" "}
          <ArrowRight size={14} />
        </button>
      )}
    </Panel>
  );
}

function CharityExplorer({
  profiles,
  canSave,
  onSave,
}: {
  profiles: Item[];
  canSave: boolean;
  onSave: (profile: Item) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]),
    [comparing, setComparing] = useState(false);
  const chosen = profiles.filter((p) => selected.includes(p.id));
  function toggle(id: string) {
    const next = selected.includes(id)
      ? selected.filter((s) => s !== id)
      : [...selected, id];
    setSelected(next);
    if (next.length < 2) setComparing(false);
  }
  return (
    <Panel
      title="Explore education causes"
      eyebrow="A SMALL SET OF SOURCES - NOT A RANKING"
      className="charity-explorer"
    >
      <p className="muted charity-explorer-intro">
        Compare the places and approaches that matter to you. These three
        profiles use official organisation sources; they are not a complete
        charity directory. You can save a different recipient at any time.
      </p>
      <div className="charity-profile-grid">
        {profiles.map((profile) => (
          <article className="charity-profile" key={profile.id}>
            <div className="charity-profile-top">
              <span>
                <Leaf size={18} />
              </span>
              <label className="compare-check">
                <input
                  type="checkbox"
                  checked={selected.includes(profile.id)}
                  onChange={() => toggle(profile.id)}
                />
                <span>
                  Compare<span className="sr-only"> {profile.name}</span>
                </span>
              </label>
            </div>
            <h3>{profile.name}</h3>
            <p className="charity-geography">{profile.geography}</p>
            <p className="charity-approach">{profile.approach}</p>
            <div className="charity-reported">
              <span>CHARITY-REPORTED EVIDENCE</span>
              <p>{profile.reportedEvidence}</p>
              <a href={profile.reportUrl} target="_blank" rel="noreferrer">
                Read official reports <ArrowUpRight size={12} />
              </a>
            </div>
            <div className="charity-source-meta">
              <span>US EIN {profile.ein}</span>
              <span>Checked {profile.checkedAt}</span>
            </div>
            <Button
              secondary
              disabled={!canSave}
              onClick={() => onSave(profile)}
            >
              <Plus size={13} /> Save this intention
            </Button>
            <div className="charity-external-links">
              <a href={profile.sourceUrl} target="_blank" rel="noreferrer">
                Visit recipient website <ArrowUpRight size={11} />
              </a>
              <a href={profile.giveUrl} target="_blank" rel="noreferrer">
                Visit official giving route <ArrowUpRight size={11} />
              </a>
            </div>
          </article>
        ))}
      </div>
      <div className="charity-compare-controls">
        <span>
          {selected.length
            ? `${selected.length} selected for comparison`
            : "Select two or three to compare their approach."}
        </span>
        <Button
          secondary
          disabled={selected.length < 2}
          onClick={() => setComparing((v) => !v)}
        >
          {comparing
            ? "Close comparison"
            : `Compare selected${selected.length ? ` (${selected.length})` : ""}`}{" "}
          <ArrowRight size={13} />
        </Button>
      </div>
      {comparing && chosen.length >= 2 && (
        <div className="table-scroll charity-comparison">
          <table>
            <caption>
              Education organisation comparison. Factual source summaries,
              without ratings.
            </caption>
            <thead>
              <tr>
                <th>What to compare</th>
                {chosen.map((p) => (
                  <th key={p.id}>{p.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Geography</th>
                {chosen.map((p) => (
                  <td key={p.id} data-label={p.name}>{p.geography}</td>
                ))}
              </tr>
              <tr>
                <th scope="row">Approach</th>
                {chosen.map((p) => (
                  <td key={p.id} data-label={p.name}>{p.approach}</td>
                ))}
              </tr>
              <tr>
                <th scope="row">Reported evidence</th>
                {chosen.map((p) => (
                  <td key={p.id} data-label={p.name}>
                    {p.reportedEvidence}
                    <a href={p.reportUrl} target="_blank" rel="noreferrer">
                      Inspect official reports <ArrowUpRight size={11} />
                    </a>
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">Source date</th>
                {chosen.map((p) => (
                  <td key={p.id} data-label={p.name}>{p.checkedAt}</td>
                ))}
              </tr>
              <tr>
                <th scope="row">Limits</th>
                {chosen.map((p) => (
                  <td key={p.id} data-label={p.name}>{p.limitations}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <div className="charity-explorer-limits">
        <ShieldCheck size={15} />
        <p>
          Profiles are not sponsored or ranked. Charity-reported information is
          not independent effectiveness verification. Confirm the current legal
          recipient and applicable status before implementing a gift. Saving an
          intention is not a donation or a legal commitment; external giving
          routes leave Hearth and no payment is made here.
        </p>
      </div>
    </Panel>
  );
}

function KeepsakeIllustration(){return <div className="keepsake-illustration" aria-hidden="true"><div className="keepsake-shadow"/><div className="keepsake-paper back"><span>PEOPLE & WISHES</span><i/><i/><i/></div><div className="keepsake-paper front"><span className="keepsake-emblem"><Heart size={19} strokeWidth={1.4}/></span><strong>For the people<br/>you love.</strong><div className="keepsake-rule"/><small>THE IMPORTANT THINGS,<br/>THOUGHTFULLY SHARED</small></div><div className="keepsake-envelope"><div className="envelope-fold left"/><div className="envelope-fold right"/><div className="envelope-fold bottom"/><span className="envelope-seal"><Heart size={16} strokeWidth={1.5}/></span></div><span className="keepsake-ribbon"/></div>}
