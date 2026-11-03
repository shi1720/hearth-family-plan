"use client";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowDownToLine,
  Check,
  ChevronDown,
  Clock3,
  FlaskConical,
  Heart,
  Leaf,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import type {
  EvaluationCase,
  EvaluationGroup,
  EvaluationReport,
  LiveEvaluationReport,
} from "@/lib/evaluation";
import "./evaluation.css";

const groups: Array<"All cases" | EvaluationGroup> = [
  "All cases",
  "Evidence",
  "Authority",
  "Financial records",
  "Privacy",
  "Provenance",
];
const formatTime = (value: number) =>
  value < 1000
    ? `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} ms`
    : `${(value / 1000).toFixed(2)} s`;
function CaseRow({ item }: { item: EvaluationCase }) {
  return (
    <details
      className={`eval-case ${item.passed ? "" : "eval-case-failed"}`}
      open={!item.passed}
    >
      <summary>
        <span
          className={`eval-case-icon ${item.passed ? "is-passed" : "is-failed"}`}
        >
          {item.passed ? <Check size={16} /> : <TriangleAlert size={16} />}
        </span>
        <span className="eval-case-title">
          <span>{item.title}</span>
          <small>
            {item.group} <i>·</i> {item.purpose}
          </small>
        </span>
        <span className="eval-case-time">{formatTime(item.durationMs)}</span>
        <span className={`eval-case-status ${item.passed ? "" : "is-failed"}`}>
          {item.passed ? "Passed" : "Failed"}
        </span>
        <ChevronDown className="eval-case-chevron" size={16} />
      </summary>
      <div className="eval-case-content">
        <div>
          <span>EXPECTED CONTRACT</span>
          <pre>{JSON.stringify(item.expected, null, 2)}</pre>
        </div>
        <div>
          <span>OBSERVED RESULT</span>
          <pre>{JSON.stringify(item.actual, null, 2)}</pre>
        </div>
        <p>
          Case <code>{item.id}</code>. The result is compared with its fixed
          expected contract when this run executes.
        </p>
      </div>
    </details>
  );
}
export default function EvaluationPage() {
  const [report, setReport] = useState<EvaluationReport | null>(null);
  const [live, setLive] = useState<LiveEvaluationReport | null>(null);
  const [busy, setBusy] = useState<"rules" | "model" | null>("rules");
  const [error, setError] = useState("");
  const [group, setGroup] = useState<"All cases" | EvaluationGroup>(
    "All cases",
  );
  const [onlyFailures, setOnlyFailures] = useState(false);
  const [consent, setConsent] = useState(false);
  const [model, setModel] = useState<"spark" | "wonder">("spark");
  async function runRules() {
    setBusy("rules");
    setError("");
    try {
      const response = await fetch("/api/evaluation", { cache: "no-store" });
      const data = (await response.json()) as EvaluationReport & {
        error?: string;
      };
      if (!response.ok)
        throw new Error(
          data.error || "The application rule run could not be completed.",
        );
      if (
        data.schemaVersion !== "hearth.evaluation.v1" ||
        !Array.isArray(data.cases)
      )
        throw new Error("The rule report did not match the expected format.");
      setReport(data);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "The application rule run could not be completed.",
      );
    } finally {
      setBusy(null);
    }
  }
  useEffect(() => {
    void runRules();
  }, []);
  async function runModel() {
    setBusy("model");
    setError("");
    try {
      const response = await fetch("/api/evaluation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consent, model }),
      });
      const data = (await response.json()) as LiveEvaluationReport & {
        error?: string;
      };
      if (!response.ok)
        throw new Error(
          data.error || "The live model request could not be completed.",
        );
      if (
        data.schemaVersion !== "hearth.live-evaluation.v1" ||
        !Array.isArray(data.proposals)
      )
        throw new Error("The model report did not match the expected format.");
      setLive(data);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "The live model request could not be completed.",
      );
    } finally {
      setBusy(null);
    }
  }
  function download() {
    if (!report) return;
    const blob = new Blob(
      [JSON.stringify({ domain: report, live: live || null }, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob),
      link = document.createElement("a");
    link.href = url;
    link.download = `hearth-evaluation-${report.runId}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }
  const cases =
    report?.cases.filter(
      (c) =>
        (group === "All cases" || c.group === group) &&
        (!onlyFailures || !c.passed),
    ) || [];
  return (
    <main className="eval-shell">
      <a className="eval-skip" href="#eval-results">
        Skip to results
      </a>
      <header className="eval-topbar">
        <a className="eval-brand" href="/" aria-label="Hearth home">
          <span>
            <Heart size={21} strokeWidth={1.6} />
          </span>
          Hearth<span className="eval-brand-dot">.</span>
        </a>
        <span className="eval-lab-label">
          <FlaskConical size={14} /> Evaluation lab
        </span>
        <a className="eval-back" href="/">
          <ArrowLeft size={14} /> Back to your plan
        </a>
      </header>
      <section className="eval-hero">
        <div className="eval-hero-copy">
          <p className="eval-eyebrow">
            <span /> TEST THE BEHAVIOUR. INSPECT THE EVIDENCE.
          </p>
          <h1>
            Trust should come
            <br />
            with a way to check.
          </h1>
          <p>
            Run the rules that keep a family plan honest. See what Hearth
            accepts, what it blocks, and what it keeps private.
          </p>
          <div className="eval-hero-actions">
            <button
              className="eval-button"
              onClick={runRules}
              disabled={!!busy}
            >
              {busy === "rules" ? (
                <LoaderCircle className="eval-spin" size={15} />
              ) : (
                <RefreshCw size={15} />
              )}{" "}
              {busy === "rules"
                ? "Running actual rules"
                : "Run application checks"}
            </button>
            <button
              className="eval-button eval-button-secondary"
              onClick={download}
              disabled={!report || !!busy}
            >
              <ArrowDownToLine size={15} /> Export results
            </button>
          </div>
          <span className="eval-hero-note">
            <LockKeyhole size={12} /> Synthetic records only. Your family plan
            is never used in this suite.
          </span>
        </div>
        <div
          className={`eval-result-card ${report?.failed ? "has-failures" : ""}`}
          aria-live="polite"
        >
          <div className="eval-result-heading">
            <span>
              <ShieldCheck size={15} /> APPLICATION RULES
            </span>
            <span className="eval-fresh">
              {busy === "rules" ? "Executing" : "Run on request"}
            </span>
          </div>
          <div className="eval-result-score">
            {report ? (
              <>
                <strong>{report.passed}</strong>
                <span>/ {report.total}</span>
              </>
            ) : (
              <strong className="eval-wait-score">{busy ? "…" : "?"}</strong>
            )}
          </div>
          <h2>
            {report
              ? report.failed
                ? "Some contracts need attention"
                : "Expected contracts held"
              : "Checking the application rules"}
          </h2>
          <p>
            {report
              ? `${report.failed} failed checks in this bounded synthetic run. Expand any case to inspect its expected and observed result.`
              : "Results appear after the actual domain functions finish executing. No pass result is preloaded."}
          </p>
          <div className="eval-result-footer">
            <Clock3 size={13} />
            {report
              ? `${formatTime(report.durationMs)} execution time`
              : "Waiting for a measured result"}
            <span>{report ? "Live execution" : "No cached score"}</span>
          </div>
        </div>
      </section>
      {error && (
        <div className="eval-error" role="alert">
          <TriangleAlert size={18} />
          <div>
            <strong>The run could not be completed.</strong>
            <p>{error}</p>
          </div>
        </div>
      )}
      <section
        className="eval-method-strip"
        aria-label="Evaluation methodology"
      >
        <div>
          <span>01</span>
          <p>
            <strong>Exercise the real rules</strong>
            <small>Actual transitions, not a presentation of test names.</small>
          </p>
        </div>
        <div>
          <span>02</span>
          <p>
            <strong>Compare expected with observed</strong>
            <small>A mismatch stays visible as a failed case.</small>
          </p>
        </div>
        <div>
          <span>03</span>
          <p>
            <strong>Keep the claims bounded</strong>
            <small>
              A pass is evidence for this case, not a legal certificate.
            </small>
          </p>
        </div>
      </section>
      <section className="eval-section" id="eval-results">
        <div className="eval-section-head">
          <div>
            <p className="eval-eyebrow">THE APPLICATION CONTRACT</p>
            <h2>Small distinctions. Consequential outcomes.</h2>
            <p>
              Evidence, authority, money and access should stay separate until
              the right action is recorded.
            </p>
          </div>
          <span className="eval-data-chip">
            <Leaf size={13} /> Synthetic fixtures
          </span>
        </div>
        <div className="eval-results-toolbar">
          <div className="eval-filters" role="group" aria-label="Filter cases">
            {groups.map((g) => (
              <button
                key={g}
                className={g === group ? "active" : ""}
                onClick={() => setGroup(g)}
              >
                {g}
              </button>
            ))}
          </div>
          <label className="eval-fail-filter">
            <input
              type="checkbox"
              checked={onlyFailures}
              onChange={(e) => setOnlyFailures(e.target.checked)}
            />{" "}
            Failed only
          </label>
        </div>
        <div className="eval-cases" aria-busy={busy === "rules"}>
          {cases.map((c) => (
            <CaseRow item={c} key={c.id} />
          ))}
          {!report && (
            <div className="eval-empty">
              <FlaskConical size={25} />
              <h3>
                {busy === "rules"
                  ? "Executing the synthetic cases"
                  : "No completed run yet"}
              </h3>
              <p>
                {busy === "rules"
                  ? "Each case creates a fresh plan and checks the resulting state."
                  : "Run the checks to see measured results."}
              </p>
            </div>
          )}
          {report && !cases.length && (
            <div className="eval-empty">
              <Check size={25} />
              <h3>No cases match this filter</h3>
              <p>
                {onlyFailures
                  ? "No failed cases are present in the selected group."
                  : "Choose another case group."}
              </p>
            </div>
          )}
        </div>
        {report && (
          <div className="eval-run-meta">
            <span>Suite {report.suiteVersion}</span>
            <span>
              Completed {new Date(report.completedAt).toLocaleString()}
            </span>
            <code>Run {report.runId.slice(0, 8)}</code>
          </div>
        )}
      </section>
      <section className="eval-live-section" id="live-model">
        <div className="eval-live-intro">
          <span className="eval-live-icon">
            <Sparkles size={22} />
          </span>
          <p className="eval-eyebrow">OPTIONAL LIVE MODEL CHECK</p>
          <h2>
            Now inspect what
            <br />
            the model actually returns.
          </h2>
          <p>
            Send one fixed synthetic handover to Meta. Inspect every proposed
            follow-up and its verbatim source quote.
          </p>
          <span className="eval-live-scope">
            A separate check of output format and grounding. It is not a legal
            accuracy score.
          </span>
        </div>
        <div className="eval-live-controls">
          <details className="eval-fixture-source">
            <summary>
              Inspect the exact synthetic scenario <ChevronDown size={15} />
            </summary>
            <p>
              {report?.liveFixture.sourceText ||
                "The synthetic source appears when the application report loads."}
            </p>
          </details>
          <label className="eval-model-label">
            Model
            <select
              value={model}
              onChange={(e) => setModel(e.target.value as "spark" | "wonder")}
              disabled={!!busy}
            >
              <option value="spark">Muse Spark 1.3 · source review</option>
              <option value="wonder">Muse Wonder 1.0 · handover review</option>
            </select>
          </label>
          <label className="eval-consent">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              disabled={!!busy}
            />
            <span>
              I agree to send the displayed synthetic source to Meta and use one
              request from my available AI allowance. No household records will
              be sent.
            </span>
          </label>
          <button
            className="eval-button"
            onClick={runModel}
            disabled={!consent || !report || !!busy}
          >
            {busy === "model" ? (
              <LoaderCircle className="eval-spin" size={15} />
            ) : (
              <Sparkles size={15} />
            )}{" "}
            {busy === "model"
              ? "Waiting for the live response"
              : "Run live model check"}
            {busy !== "model" && <ArrowRight size={15} />}
          </button>
          <p className="eval-live-access">
            Requires an owner session and an available Meta connection or
            permitted demo allowance. Results are not saved to your family plan.
          </p>
        </div>
      </section>
      {live && (
        <section className="eval-section eval-live-report" aria-live="polite">
          <div className="eval-section-head">
            <div>
              <p className="eval-eyebrow">ACTUAL MODEL RESPONSE</p>
              <h2>{live.model}</h2>
              <p>
                {live.proposals.length} proposed follow-ups ·{" "}
                {formatTime(live.durationMs)} request time ·{" "}
                {new Date(live.createdAt).toLocaleString()}
              </p>
            </div>
            <span
              className={`eval-data-chip ${live.failed ? "eval-chip-warning" : ""}`}
            >
              {live.passed}/{live.checks.length} mechanical checks passed
            </span>
          </div>
          <div className="eval-live-checks">
            {live.checks.map((c) => (
              <CaseRow key={c.id} item={c} />
            ))}
          </div>
          <div className="eval-proposals">
            {live.proposals.map((p, i) => (
              <article key={i}>
                <div className="eval-proposal-number">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div>
                  <span className="eval-proposal-status">PENDING PROPOSAL</span>
                  <h3>{p.title}</h3>
                  <p>{p.detail}</p>
                  <blockquote>
                    <span>EXACT SOURCE QUOTE</span>
                    {p.sourceQuote}
                  </blockquote>
                </div>
              </article>
            ))}
          </div>
          <div className="eval-human-review">
            <div>
              <ShieldCheck size={20} />
              <h3>The reasoning still needs a human review.</h3>
              <p>
                A correct quote can accompany an incorrect inference. Use these
                prompts to inspect the response rather than treating the
                mechanical checks as proof of accuracy.
              </p>
            </div>
            <ul>
              {live.humanReviewPrompts.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
          <details className="eval-raw">
            <summary>
              Inspect exact submitted input and token usage{" "}
              <ChevronDown size={15} />
            </summary>
            <h3>Exact evaluation input</h3>
            <pre>{live.exactInput}</pre>
            <h3>Provider-reported usage</h3>
            <pre>{JSON.stringify(live.usage, null, 2)}</pre>
          </details>
        </section>
      )}
      <section className="eval-limits">
        <div>
          <p className="eval-eyebrow">HOW TO READ THIS REPORT</p>
          <h2>
            Useful evidence.
            <br />
            Honest limits.
          </h2>
        </div>
        <div>
          {(
            report?.limits || [
              "These checks cover a bounded synthetic corpus. They do not certify a family plan or a professional.",
            ]
          ).map((t) => (
            <p key={t}>
              <span>✓</span>
              {t}
            </p>
          ))}
          <p>
            <span>✓</span>Live model checks are single observations. Semantic
            coverage, legal interpretation and real-world reliability require
            separate human evaluation.
          </p>
        </div>
      </section>
      <footer className="eval-footer">
        <span>
          Hearth <i>·</i> Careful preparation, clear evidence.
        </span>
        <a href="/">
          Return to your family plan <ArrowRight size={13} />
        </a>
      </footer>
    </main>
  );
}
