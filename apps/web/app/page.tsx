"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

type RunStatus = "queued" | "running" | "analyzing" | "completed" | "failed" | "cancelled";
type FindingSeverity = "low" | "medium" | "high" | "critical";

type Run = {
  id: string;
  project_id: string;
  environment_id?: string | null;
  target_url: string;
  status: RunStatus;
  created_at: string;
  updated_at: string;
  artifact_dir?: string | null;
  error_message?: string | null;
};

type Finding = {
  id: string;
  run_id: string;
  category: "ux" | "accessibility" | "functional" | "network" | "performance";
  title: string;
  description: string;
  severity: FindingSeverity;
  confidence: number;
  page_url: string;
  observed_behavior: string;
  reproduction_steps: string[];
  evidence_ids: string[];
  guideline_id?: string | null;
  guideline_source_url?: string | null;
  verification_status: "confirmed" | "likely" | "needs_human_review";
  status: "open" | "accepted" | "rejected" | "fixed";
};

type Evidence = {
  title?: string;
  targetUrl?: string;
  finalUrl?: string;
  actions?: string[];
  consoleMessages?: string[];
  failedRequests?: string[];
  errorResponses?: Array<{ url: string; status: number; method: string }>;
  interactiveElements?: Array<{ tag: string; text?: string; ariaLabel?: string | null; name?: string | null; type?: string | null }>;
  axeViolations?: Array<{ id: string; impact?: string | null; description?: string; help?: string }>;
  guidelineChecks?: { unlabeledFormControls?: unknown[]; smallTargets?: unknown[]; viewport?: { hasHorizontalOverflow?: boolean }; keyboard?: { sampledTabStops?: string[] } };
};

type FormState = {
  projectId: string;
  environmentId: string;
  targetUrl: string;
  loginEmail: string;
  loginPassword: string;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api";
const appApiOrigin = apiBaseUrl.replace(/\/api\/?$/, "");
const initialForm: FormState = { projectId: "project_local", environmentId: "local_preview", targetUrl: "https://example.com", loginEmail: "", loginPassword: "" };
const panelClassName = "rounded-2xl border border-border bg-panel p-5";
const fieldClassName = "w-full rounded-[10px] border border-border bg-surface px-3.5 py-3 text-ink outline-none placeholder:text-muted focus:border-lime-spark focus:ring-2 focus:ring-lime-spark/30";

export default function HomePage() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [runs, setRuns] = useState<Run[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<Run | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [isLoadingRuns, setIsLoadingRuns] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadRuns() {
    try {
      const response = await fetch(`${apiBaseUrl}/runs`, { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load runs");
      const data: Run[] = await response.json();
      setRuns(data);
      if (!selectedRunId && data.length > 0) {
        setSelectedRunId(data[0].id);
      } else if (selectedRunId && !data.some((run) => run.id === selectedRunId)) {
        setSelectedRunId(null);
        setSelectedRun(null);
        setFindings([]);
        setEvidence(null);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load runs");
    } finally {
      setIsLoadingRuns(false);
    }
  }

  async function loadRunBundle(runId: string) {
    try {
      const [runResponse, findingsResponse, evidenceResponse] = await Promise.all([
        fetch(`${apiBaseUrl}/runs/${runId}`, { cache: "no-store" }),
        fetch(`${apiBaseUrl}/runs/${runId}/findings`, { cache: "no-store" }),
        fetch(`${apiBaseUrl}/runs/${runId}/evidence`, { cache: "no-store" })
      ]);
      if (runResponse.ok) setSelectedRun((await runResponse.json()) as Run);
      if (findingsResponse.ok) setFindings((await findingsResponse.json()) as Finding[]);
      else setFindings([]);
      if (evidenceResponse.ok) setEvidence((await evidenceResponse.json()) as Evidence);
      else setEvidence(null);
    } catch (detailError) {
      setError(detailError instanceof Error ? detailError.message : "Failed to load run detail");
    }
  }

  useEffect(() => { void loadRuns(); }, []);
  useEffect(() => {
    if (!selectedRunId) return;
    void loadRunBundle(selectedRunId);
    const interval = window.setInterval(() => { void loadRuns(); void loadRunBundle(selectedRunId); }, 4000);
    return () => window.clearInterval(interval);
  }, [selectedRunId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: form.projectId, environment_id: form.environmentId || undefined, target_url: form.targetUrl, login_email: form.loginEmail || undefined, login_password: form.loginPassword || undefined })
      });
      if (!response.ok) throw new Error((await response.text()) || "Failed to queue run");
      const run: Run = await response.json();
      setSelectedRunId(run.id);
      setSelectedRun(run);
      setFindings([]);
      setEvidence(null);
      setForm((current) => ({ ...current, loginPassword: "" }));
      await loadRuns();
      await loadRunBundle(run.id);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to queue run");
    } finally {
      setIsSubmitting(false);
    }
  }

  const selectedSummary = useMemo(() => selectedRun ?? runs.find((run) => run.id === selectedRunId) ?? null, [runs, selectedRun, selectedRunId]);
  const screenshotUrl = selectedSummary ? `${appApiOrigin}/artifacts/${selectedSummary.id}/page.png` : null;

  return (
    <main className="mx-auto min-h-screen max-w-[1360px] p-5 sm:p-8">
      <section className="grid gap-4">
        <div>
          <p className="mb-2 text-muted">Product A · Local MVP</p>
          <h1 className="m-0 text-2xl font-bold tracking-tight">AI UX QA Agent</h1>
          <p className="max-w-[780px] text-secondary">Queue local QA runs, collect screenshot and browser evidence, generate findings, and review results in one dashboard.</p>
        </div>

        {error ? <div className="rounded-2xl border border-red-800 bg-red-950/30 p-5 text-red-100"><strong>Error:</strong> {error}</div> : null}

        <div className="grid items-start gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <section className={panelClassName}>
            <h2 className="mt-0 text-lg font-semibold">Create run</h2>
            <form onSubmit={handleSubmit} className="grid gap-3">
              <input className={fieldClassName} value={form.projectId} onChange={(event) => setForm({ ...form, projectId: event.target.value })} placeholder="Project ID" />
              <input className={fieldClassName} value={form.environmentId} onChange={(event) => setForm({ ...form, environmentId: event.target.value })} placeholder="Environment ID" />
              <input className={fieldClassName} value={form.targetUrl} onChange={(event) => setForm({ ...form, targetUrl: event.target.value })} placeholder="Target URL" />
              <input className={fieldClassName} value={form.loginEmail} onChange={(event) => setForm({ ...form, loginEmail: event.target.value })} placeholder="Login email (optional)" />
              <input className={fieldClassName} value={form.loginPassword} onChange={(event) => setForm({ ...form, loginPassword: event.target.value })} placeholder="Login password (optional)" type="password" />
              <button className="cursor-pointer rounded-[10px] bg-lime-spark px-3.5 py-3 font-bold text-graphite transition hover:bg-lime-spark/90 disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={isSubmitting}>{isSubmitting ? "Queueing..." : "Queue run"}</button>
            </form>
          </section>

          <section className={panelClassName}>
            <h2 className="mt-0 text-lg font-semibold">Execution pipeline</h2>
            <ul className="m-0 grid list-disc gap-2 pl-[18px] text-secondary">
              <li>Queue run</li><li>Launch Playwright browser worker</li><li>Attempt login with email/password when provided</li><li>Capture screenshot, console, network, and accessibility evidence</li><li>Run AI analysis and write findings</li>
            </ul>
          </section>
        </div>

        <div className="grid items-start gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <section className={panelClassName}>
            <div className="mb-3 flex items-center justify-between"><h2 className="m-0 text-lg font-semibold">Runs</h2><button type="button" className="cursor-pointer rounded-[10px] border border-border bg-surface px-3 py-2.5 text-ink transition hover:border-lime-spark" onClick={() => void loadRuns()}>Refresh</button></div>
            {isLoadingRuns ? <p className="text-muted">Loading runs...</p> : null}
            <div className="grid gap-3">
              {runs.map((run) => (
                <button key={run.id} type="button" onClick={() => setSelectedRunId(run.id)} className={`cursor-pointer rounded-xl border bg-surface p-4 text-left text-ink transition hover:border-lime-spark ${selectedRunId === run.id ? "border-lime-spark" : "border-border"}`}>
                  <div className="flex gap-3 justify-between"><strong>{run.id}</strong><StatusBadge status={run.status} /></div>
                  <div className="mt-1.5 text-muted">{run.target_url}</div><div className="mt-2.5 text-xs text-secondary">Project: {run.project_id}</div>
                </button>
              ))}
              {!isLoadingRuns && runs.length === 0 ? <p className="text-muted">No runs yet.</p> : null}
            </div>
          </section>

          <section className={panelClassName}>
            <h2 className="mt-0 text-lg font-semibold">Run detail</h2>
            {selectedSummary ? <div className="grid gap-3.5">
              <div className="grid gap-2"><div><strong>ID:</strong> {selectedSummary.id}</div><div><strong>Status:</strong> <StatusBadge status={selectedSummary.status} /></div><div><strong>Project:</strong> {selectedSummary.project_id}</div><div><strong>Environment:</strong> {selectedSummary.environment_id ?? "-"}</div><div><strong>Target URL:</strong> {selectedSummary.target_url}</div><div><strong>Created:</strong> {formatDate(selectedSummary.created_at)}</div><div><strong>Updated:</strong> {formatDate(selectedSummary.updated_at)}</div><div><strong>Artifact directory:</strong> {selectedSummary.artifact_dir ?? "pending"}</div></div>
              {selectedSummary.error_message ? <div className="whitespace-pre-wrap text-red-100"><strong>Worker error:</strong><div className="mt-1.5">{selectedSummary.error_message}</div></div> : null}
              {screenshotUrl ? <div><div className="mb-2"><strong>Screenshot</strong></div><img src={screenshotUrl} alt="Run screenshot" className="w-full rounded-xl border border-border bg-surface" /></div> : null}
            </div> : <p className="text-muted">Select a run to inspect details.</p>}
          </section>
        </div>

        <div className="grid items-start gap-4 lg:grid-cols-2">
          <section className={panelClassName}>
            <h2 className="mt-0 text-lg font-semibold">Findings</h2>
            <div className="grid gap-3">
              {findings.map((finding) => <article key={finding.id} className="grid gap-2.5 rounded-xl border border-border bg-surface p-4">
                <div className="flex items-center justify-between gap-3"><strong>{finding.title}</strong><SeverityBadge severity={finding.severity} /></div>
                <div className="mt-1.5 text-muted">{finding.category} · confidence {Math.round(finding.confidence * 100)}% · {finding.verification_status.replaceAll("_", " ")}</div>
                {finding.guideline_id ? <div className="text-secondary"><strong>Guideline:</strong> {finding.guideline_source_url ? <a href={finding.guideline_source_url} target="_blank" rel="noreferrer" className="text-lime-spark underline underline-offset-2">{finding.guideline_id}</a> : finding.guideline_id}</div> : null}
                <p className="mb-0 text-ink">{finding.description}</p><div className="text-secondary"><strong>Observed:</strong> {finding.observed_behavior}</div>
                <div><strong>Steps</strong><ol className="mt-2 grid list-decimal gap-1.5 pl-5 text-secondary">{finding.reproduction_steps.map((step, index) => <li key={`${finding.id}-${index}`}>{step}</li>)}</ol></div>
              </article>)}
              {selectedRunId && findings.length === 0 ? <p className="text-muted">No findings yet or analysis still running.</p> : null}
            </div>
          </section>

          <section className={panelClassName}>
            <h2 className="mt-0 text-lg font-semibold">Evidence summary</h2>
            {evidence ? <div className="grid gap-3">
              <div><strong>Title:</strong> {evidence.title ?? "-"}</div><div><strong>Final URL:</strong> {evidence.finalUrl ?? evidence.targetUrl ?? "-"}</div>
              <EvidenceList title="Actions" items={evidence.actions ?? []} />
              <EvidenceList title="Console messages" items={(evidence.consoleMessages ?? []).slice(0, 10)} />
              <EvidenceList title="Failed requests" items={(evidence.failedRequests ?? []).slice(0, 10)} />
              <EvidenceList title="HTTP errors" items={(evidence.errorResponses ?? []).slice(0, 10).map((item) => `${item.method} ${item.status} ${item.url}`)} />
              <div><strong>Guideline checks</strong><div className="mt-2 text-secondary">Unlabeled controls: {evidence.guidelineChecks?.unlabeledFormControls?.length ?? 0} · Small targets: {evidence.guidelineChecks?.smallTargets?.length ?? 0} · Mobile overflow: {evidence.guidelineChecks?.viewport?.hasHorizontalOverflow ? "yes" : "no"} · Sampled tab stops: {evidence.guidelineChecks?.keyboard?.sampledTabStops?.length ?? 0}</div></div>
              <EvidenceList title="axe violations" items={(evidence.axeViolations ?? []).slice(0, 10).map((item) => `${item.id} ${item.impact ? `(${item.impact})` : ""} — ${item.help ?? item.description}`)} />
            </div> : <p className="text-muted">Evidence will appear after the browser worker completes.</p>}
          </section>
        </div>
      </section>
    </main>
  );
}

function EvidenceList({ title, items }: { title: string; items: string[] }) {
  return <div><strong>{title}</strong><ul className="mt-2 grid list-disc gap-1.5 pl-[18px] text-secondary">{items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></div>;
}

function StatusBadge({ status }: { status: RunStatus }) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1.5 text-[11px] ${statusClasses[status]}`}>{status}</span>;
}

function SeverityBadge({ severity }: { severity: FindingSeverity }) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1.5 text-[11px] ${severityClasses[severity]}`}>{severity}</span>;
}

function formatDate(value: string) { return new Date(value).toLocaleString(); }

const statusClasses: Record<RunStatus, string> = {
  queued: "border-blue-500/60 bg-blue-950 text-blue-100", running: "border-cyan-500/60 bg-cyan-950 text-cyan-100", analyzing: "border-amber-500/60 bg-amber-950 text-amber-100", completed: "border-emerald-500/60 bg-emerald-950 text-emerald-100", failed: "border-red-500/60 bg-red-950 text-red-100", cancelled: "border-slate-500/60 bg-slate-800 text-slate-100"
};
const severityClasses: Record<FindingSeverity, string> = {
  low: "border-sky-500/60 bg-sky-950 text-sky-100", medium: "border-amber-500/60 bg-amber-950 text-amber-100", high: "border-orange-500/60 bg-orange-950 text-orange-100", critical: "border-red-500/60 bg-red-950 text-red-100"
};
