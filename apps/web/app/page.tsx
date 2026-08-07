"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, FormEvent } from "react";

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
const initialForm: FormState = {
  projectId: "project_local",
  environmentId: "local_preview",
  targetUrl: "https://example.com",
  loginEmail: "",
  loginPassword: ""
};

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
      if (!selectedRunId && data.length > 0) setSelectedRunId(data[0].id);
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

  useEffect(() => {
    void loadRuns();
  }, []);

  useEffect(() => {
    if (!selectedRunId) return;
    void loadRunBundle(selectedRunId);
    const interval = window.setInterval(() => {
      void loadRuns();
      void loadRunBundle(selectedRunId);
    }, 4000);
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
        body: JSON.stringify({
          project_id: form.projectId,
          environment_id: form.environmentId || undefined,
          target_url: form.targetUrl,
          login_email: form.loginEmail || undefined,
          login_password: form.loginPassword || undefined
        })
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
    <main style={{ padding: 32, maxWidth: 1360, margin: "0 auto" }}>
      <section style={{ display: "grid", gap: 16 }}>
        <div>
          <p style={{ color: "#8aa0c8", marginBottom: 8 }}>Product A · Local MVP</p>
          <h1 style={{ margin: 0 }}>AI UX QA Agent</h1>
          <p style={{ color: "#c9d3e7", maxWidth: 780 }}>
            Queue local QA runs, collect screenshot and browser evidence, generate findings, and review results in one dashboard.
          </p>
        </div>

        {error ? <div style={{ ...panelStyle, borderColor: "#7d2438", color: "#ffd5dd" }}><strong>Error:</strong> {error}</div> : null}

        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 16, alignItems: "start" }}>
          <section style={panelStyle}>
            <h2 style={{ marginTop: 0 }}>Create run</h2>
            <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
              <input value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })} placeholder="Project ID" style={fieldStyle} />
              <input value={form.environmentId} onChange={(e) => setForm({ ...form, environmentId: e.target.value })} placeholder="Environment ID" style={fieldStyle} />
              <input value={form.targetUrl} onChange={(e) => setForm({ ...form, targetUrl: e.target.value })} placeholder="Target URL" style={fieldStyle} />
              <input value={form.loginEmail} onChange={(e) => setForm({ ...form, loginEmail: e.target.value })} placeholder="Login email (optional)" style={fieldStyle} />
              <input value={form.loginPassword} onChange={(e) => setForm({ ...form, loginPassword: e.target.value })} placeholder="Login password (optional)" type="password" style={fieldStyle} />
              <button style={buttonStyle} type="submit" disabled={isSubmitting}>{isSubmitting ? "Queueing..." : "Queue run"}</button>
            </form>
          </section>

          <section style={panelStyle}>
            <h2 style={{ marginTop: 0 }}>Execution pipeline</h2>
            <ul style={{ margin: 0, paddingLeft: 18, color: "#c9d3e7", display: "grid", gap: 8 }}>
              <li>Queue run</li>
              <li>Launch Playwright browser worker</li>
              <li>Attempt login with email/password when provided</li>
              <li>Capture screenshot, console, network, and accessibility evidence</li>
              <li>Run AI analysis and write findings</li>
            </ul>
          </section>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: 16, alignItems: "start" }}>
          <section style={panelStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h2 style={{ margin: 0 }}>Runs</h2>
              <button type="button" style={secondaryButtonStyle} onClick={() => void loadRuns()}>Refresh</button>
            </div>
            {isLoadingRuns ? <p style={{ color: "#8aa0c8" }}>Loading runs...</p> : null}
            <div style={{ display: "grid", gap: 12 }}>
              {runs.map((run) => (
                <button key={run.id} type="button" onClick={() => setSelectedRunId(run.id)} style={{ ...runCardStyle, borderColor: selectedRunId === run.id ? "#4b7cff" : "#213158" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <strong>{run.id}</strong>
                    <StatusBadge status={run.status} />
                  </div>
                  <div style={{ color: "#8aa0c8", marginTop: 6 }}>{run.target_url}</div>
                  <div style={{ color: "#c9d3e7", marginTop: 10, fontSize: 14 }}>Project: {run.project_id}</div>
                </button>
              ))}
              {!isLoadingRuns && runs.length === 0 ? <p style={{ color: "#8aa0c8" }}>No runs yet.</p> : null}
            </div>
          </section>

          <section style={panelStyle}>
            <h2 style={{ marginTop: 0 }}>Run detail</h2>
            {selectedSummary ? (
              <div style={{ display: "grid", gap: 14 }}>
                <div style={{ display: "grid", gap: 8 }}>
                  <div><strong>ID:</strong> {selectedSummary.id}</div>
                  <div><strong>Status:</strong> <StatusBadge status={selectedSummary.status} /></div>
                  <div><strong>Project:</strong> {selectedSummary.project_id}</div>
                  <div><strong>Environment:</strong> {selectedSummary.environment_id ?? "-"}</div>
                  <div><strong>Target URL:</strong> {selectedSummary.target_url}</div>
                  <div><strong>Created:</strong> {formatDate(selectedSummary.created_at)}</div>
                  <div><strong>Updated:</strong> {formatDate(selectedSummary.updated_at)}</div>
                  <div><strong>Artifact directory:</strong> {selectedSummary.artifact_dir ?? "pending"}</div>
                </div>

                {selectedSummary.error_message ? (
                  <div style={{ color: "#ffd5dd", whiteSpace: "pre-wrap" }}>
                    <strong>Worker error:</strong>
                    <div style={{ marginTop: 6 }}>{selectedSummary.error_message}</div>
                  </div>
                ) : null}

                {screenshotUrl ? (
                  <div>
                    <div style={{ marginBottom: 8 }}><strong>Screenshot</strong></div>
                    <img src={screenshotUrl} alt="Run screenshot" style={{ width: "100%", borderRadius: 12, border: "1px solid #213158", background: "#0d152b" }} />
                  </div>
                ) : null}
              </div>
            ) : <p style={{ color: "#8aa0c8" }}>Select a run to inspect details.</p>}
          </section>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
          <section style={panelStyle}>
            <h2 style={{ marginTop: 0 }}>Findings</h2>
            <div style={{ display: "grid", gap: 12 }}>
              {findings.map((finding) => (
                <article key={finding.id} style={findingCardStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                    <strong>{finding.title}</strong>
                    <SeverityBadge severity={finding.severity} />
                  </div>
                  <div style={{ color: "#8aa0c8", marginTop: 6 }}>{finding.category} · confidence {Math.round(finding.confidence * 100)}%</div>
                  <p style={{ marginBottom: 0, color: "#dbe6fb" }}>{finding.description}</p>
                  <div style={{ color: "#c9d3e7" }}><strong>Observed:</strong> {finding.observed_behavior}</div>
                  <div>
                    <strong>Steps</strong>
                    <ol style={{ margin: "8px 0 0", paddingLeft: 20, color: "#c9d3e7" }}>
                      {finding.reproduction_steps.map((step, index) => <li key={`${finding.id}-${index}`}>{step}</li>)}
                    </ol>
                  </div>
                </article>
              ))}
              {selectedRunId && findings.length === 0 ? <p style={{ color: "#8aa0c8" }}>No findings yet or analysis still running.</p> : null}
            </div>
          </section>

          <section style={panelStyle}>
            <h2 style={{ marginTop: 0 }}>Evidence summary</h2>
            {evidence ? (
              <div style={{ display: "grid", gap: 12 }}>
                <div><strong>Title:</strong> {evidence.title ?? "-"}</div>
                <div><strong>Final URL:</strong> {evidence.finalUrl ?? evidence.targetUrl ?? "-"}</div>
                <div>
                  <strong>Actions</strong>
                  <ul style={listStyle}>{(evidence.actions ?? []).map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
                <div>
                  <strong>Console messages</strong>
                  <ul style={listStyle}>{(evidence.consoleMessages ?? []).slice(0, 10).map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>
                </div>
                <div>
                  <strong>Failed requests</strong>
                  <ul style={listStyle}>{(evidence.failedRequests ?? []).slice(0, 10).map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>
                </div>
                <div>
                  <strong>HTTP errors</strong>
                  <ul style={listStyle}>{(evidence.errorResponses ?? []).slice(0, 10).map((item, index) => <li key={`${item.url}-${index}`}>{item.method} {item.status} {item.url}</li>)}</ul>
                </div>
                <div>
                  <strong>axe violations</strong>
                  <ul style={listStyle}>{(evidence.axeViolations ?? []).slice(0, 10).map((item, index) => <li key={`${item.id}-${index}`}>{item.id} {item.impact ? `(${item.impact})` : ""} — {item.help ?? item.description}</li>)}</ul>
                </div>
              </div>
            ) : <p style={{ color: "#8aa0c8" }}>Evidence will appear after the browser worker completes.</p>}
          </section>
        </div>
      </section>
    </main>
  );
}

function StatusBadge({ status }: { status: RunStatus }) {
  return <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, padding: "6px 10px", fontSize: 12, background: statusColors[status].background, color: statusColors[status].color, border: `1px solid ${statusColors[status].border}` }}>{status}</span>;
}

function SeverityBadge({ severity }: { severity: FindingSeverity }) {
  return <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, padding: "6px 10px", fontSize: 12, background: severityColors[severity].background, color: severityColors[severity].color, border: `1px solid ${severityColors[severity].border}` }}>{severity}</span>;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

const panelStyle: CSSProperties = { background: "#111933", border: "1px solid #213158", borderRadius: 16, padding: 20 };
const fieldStyle: CSSProperties = { width: "100%", background: "#091024", color: "#f4f7fb", border: "1px solid #213158", borderRadius: 10, padding: "12px 14px" };
const buttonStyle: CSSProperties = { border: 0, borderRadius: 10, padding: "12px 14px", background: "#4b7cff", color: "white", cursor: "pointer" };
const secondaryButtonStyle: CSSProperties = { border: "1px solid #213158", borderRadius: 10, padding: "10px 12px", background: "#091024", color: "#f4f7fb", cursor: "pointer" };
const runCardStyle: CSSProperties = { textAlign: "left", border: "1px solid #213158", borderRadius: 12, padding: 16, background: "#0d152b", color: "#f4f7fb", cursor: "pointer" };
const findingCardStyle: CSSProperties = { border: "1px solid #213158", borderRadius: 12, padding: 16, background: "#0d152b", display: "grid", gap: 10 };
const listStyle: CSSProperties = { margin: "8px 0 0", paddingLeft: 18, color: "#c9d3e7", display: "grid", gap: 6 };

const statusColors: Record<RunStatus, { background: string; color: string; border: string }> = {
  queued: { background: "#1c294e", color: "#c6d7ff", border: "#33539f" },
  running: { background: "#1d3650", color: "#c9f0ff", border: "#32779d" },
  analyzing: { background: "#392d18", color: "#ffe4a4", border: "#8f6d1f" },
  completed: { background: "#183625", color: "#c6ffd9", border: "#2a8f58" },
  failed: { background: "#411c25", color: "#ffd5dd", border: "#a03b52" },
  cancelled: { background: "#2f3240", color: "#dce0eb", border: "#6b7280" }
};

const severityColors: Record<FindingSeverity, { background: string; color: string; border: string }> = {
  low: { background: "#1b3042", color: "#d3eeff", border: "#2d618d" },
  medium: { background: "#392d18", color: "#ffe4a4", border: "#8f6d1f" },
  high: { background: "#4a2416", color: "#ffd6c9", border: "#b15b39" },
  critical: { background: "#4a1822", color: "#ffd5dd", border: "#b13c56" }
};
