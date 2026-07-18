"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AnalysisResult, EvidenceRef, RequirementProof, StreamEvent, VerificationResult } from "@/lib/types";

type Phase = "untouched" | "analyzing" | "analyzed" | "verifying" | "verified" | "error";

const initialRequirements: RequirementProof[] = [
  { id: "R1", text: "Creating a seat below the limit succeeds.", status: "partial", rationale: "Waiting for evidence.", confidence: 0, evidence: [] },
  { id: "R2", text: "Creating a seat at the limit returns 409.", status: "partial", rationale: "Waiting for evidence.", confidence: 0, evidence: [] },
  { id: "R3", text: "Concurrent requests cannot exceed the limit.", status: "partial", rationale: "Waiting for evidence.", confidence: 0, evidence: [] },
];

async function consumeStream(response: Response, onEvent: (event: StreamEvent) => void) {
  if (!response.ok || !response.body) {
    const body = await response.json().catch(() => ({ error: "Request failed." }));
    throw new Error(body.error ?? "Request failed.");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";
    for (const block of blocks) {
      const line = block.split("\n").find((part) => part.startsWith("data: "));
      if (line) onEvent(JSON.parse(line.slice(6)) as StreamEvent);
    }
  }
}

function StatusMark({ status }: { status: RequirementProof["status"] }) {
  return <span className={`status-mark status-${status}`} aria-hidden="true">{status === "supported" ? "✓" : status === "unsupported" ? "!" : "·"}</span>;
}

function EvidenceLink({ evidence, selected, onSelect }: { evidence: EvidenceRef; selected: boolean; onSelect: (evidence: EvidenceRef, trigger: HTMLButtonElement) => void }) {
  return (
    <button className="evidence-link" aria-controls="evidence-detail" aria-expanded={selected} onClick={(event) => onSelect(evidence, event.currentTarget)}>
      <span>{evidence.path}:{evidence.startLine}–{evidence.endLine}</span>
      <span className={evidence.verified ? "verified-label" : "unverified-label"}>{evidence.verified ? "Exact match" : "Unverified"}</span>
    </button>
  );
}

export default function Home() {
  const [phase, setPhase] = useState<Phase>("untouched");
  const [stage, setStage] = useState("Ready for analysis");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceRef | null>(null);
  const [error, setError] = useState("");
  const evidenceHeadingRef = useRef<HTMLDivElement>(null);
  const evidenceTriggerRef = useRef<HTMLButtonElement | null>(null);
  const requirements = analysis?.requirements ?? initialRequirements;
  const evidenceCount = useMemo(() => requirements.reduce((sum, item) => sum + item.evidence.length, 0), [requirements]);

  useEffect(() => {
    if (selectedEvidence) evidenceHeadingRef.current?.focus();
  }, [selectedEvidence]);

  async function analyze(forceReplay = false) {
    setPhase("analyzing"); setError(""); setVerification(null); setSelectedEvidence(null);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST", headers: { "Content-Type": "application/json", ...(forceReplay ? { "X-GapWitness-Replay": "1" } : {}) },
        body: JSON.stringify({ scenarioId: "seat-limit-race" }),
      });
      await consumeStream(response, (event) => {
        if (event.type === "stage") setStage(event.label);
        if (event.type === "error") throw new Error(event.message);
        if (event.type === "result" && "requirements" in event.result) {
          setAnalysis(event.result); setPhase("analyzed"); setStage("Proof graph complete");
        }
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Analysis could not finish."); setPhase("error"); setStage("Analysis paused");
    }
  }

  async function verify() {
    if (!analysis) return;
    setPhase("verifying"); setError("");
    try {
      const response = await fetch("/api/verify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ continuationToken: analysis.continuationToken, requirementId: "R3" }),
      });
      await consumeStream(response, (event) => {
        if (event.type === "stage") setStage(event.label);
        if (event.type === "error") throw new Error(event.message);
        if (event.type === "result" && "generatedTest" in event.result) {
          const confirmed = event.result.status === "counterexample_confirmed";
          setVerification(event.result); setPhase(confirmed ? "verified" : "analyzed"); setStage(confirmed ? "Counterexample confirmed" : "Counterexample not reproduced");
        }
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Verification could not finish."); setPhase("error"); setStage("Verification paused");
    }
  }

  const repositoryUrl = process.env.NEXT_PUBLIC_REPOSITORY_URL;
  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="GapWitness home">GapWitness</a>
        <div className="header-meta">
          <span className="fixture-pill">Guided fixture</span>
          <span>seat-limit-race · TypeScript</span>
        </div>
        {repositoryUrl ? <a className="repo-link" href={repositoryUrl} target="_blank" rel="noreferrer">Repository <span aria-hidden="true">↗</span></a> : <span className="repo-pending">Repository pending</span>}
      </header>

      <main>

      <section id="top" className="intro" aria-labelledby="page-title">
        <div>
          <p className="eyebrow">Pre-release verification</p>
          <h1 id="page-title">Passing tests are not the same as proven requirements.</h1>
          <p className="lede">GapWitness traces each acceptance criterion to exact code and test evidence, then turns the weakest claim into an executable counterexample.</p>
        </div>
        <button className="primary-action" onClick={() => analyze()} disabled={phase === "analyzing" || phase === "verifying"}>
          {phase === "analyzing" ? "Analyzing evidence…" : analysis ? "Run fresh analysis" : "Analyze the change"}
        </button>
      </section>

      <section className={`progress-strip phase-${phase}`} aria-label="Analysis progress" aria-live="polite">
        <div className="progress-copy"><span className="pulse" aria-hidden="true" /><strong>{stage}</strong></div>
        <ol>
          <li className={phase !== "untouched" ? "done" : ""} aria-current={phase === "analyzing" ? "step" : undefined}>Ingest<span className="sr-only"> {phase === "analyzing" ? "current" : phase !== "untouched" ? "complete" : "pending"}</span></li>
          <li className={["analyzed", "verifying", "verified"].includes(phase) ? "done" : ""} aria-current={phase === "analyzed" ? "step" : undefined}>Map evidence<span className="sr-only"> {phase === "analyzed" ? "current" : ["verifying", "verified"].includes(phase) ? "complete" : "pending"}</span></li>
          <li className={phase === "verified" ? "done" : ""} aria-current={phase === "verifying" || phase === "verified" ? "step" : undefined}>Verify gap<span className="sr-only"> {phase === "verified" ? "complete" : phase === "verifying" ? "current" : "pending"}</span></li>
        </ol>
        {analysis?.mode === "replay" && <span className="replay-badge">{analysis.replay?.label ?? "Replay · not a live run"}</span>}
      </section>

      <div className="workspace">
        <section className="proof-panel" aria-labelledby="proof-title">
          <div className="section-heading">
            <div><p className="eyebrow">Requirement proof graph</p><h2 id="proof-title">What the change actually proves</h2></div>
            <span className="evidence-count">{evidenceCount} exact references</span>
          </div>
          <div className="baseline-row">
            <span className="baseline-icon" aria-hidden="true">✓</span>
            <div><strong>Baseline suite</strong><span>{analysis ? `${analysis.baseline.passed} passed · ${analysis.baseline.failed} failed` : "18 checks ready to run"}</span></div>
            <code>npm run test:fixture</code>
          </div>

          <div className="proof-list">
            {requirements.map((requirement) => (
              <article className={`requirement requirement-${requirement.status} ${requirement.id === "R3" && analysis ? "selected-gap" : ""}`} key={requirement.id}>
                <div className="requirement-line" aria-hidden="true" />
                <StatusMark status={requirement.status} />
                <div className="requirement-main">
                  <div className="requirement-title"><span>{requirement.id}</span><h3>{requirement.text}</h3><strong>{analysis ? requirement.status : "pending"}</strong></div>
                  <p>{requirement.rationale}</p>
                  {requirement.evidence.length > 0 && <div className="evidence-links">{requirement.evidence.map((item, index) => <EvidenceLink key={`${item.path}-${index}`} evidence={item} selected={selectedEvidence === item} onSelect={(next, trigger) => { evidenceTriggerRef.current = trigger; setSelectedEvidence(next); }} />)}</div>}
                </div>
              </article>
            ))}
          </div>
        </section>

        <aside className="bench" aria-labelledby="bench-title">
          <div className="bench-heading"><p className="eyebrow">Executable verification</p><h2 id="bench-title">Test the weakest claim</h2></div>
          {!analysis && (
            <div className="bench-empty"><span aria-hidden="true">03</span><p>Analyze the change to locate the requirement with the weakest proof.</p></div>
          )}
          {analysis && !verification && (
            <div className="gap-summary">
              <span className="gap-tag">Unproven · R3</span>
              <h3>The check and insert are not atomic.</h3>
              <p>Two requests can both read the same available seat before either insert completes.</p>
              <div className="barrier-sketch" aria-label="Two requests meet at a barrier, then both insert">
                <span>Request A</span><i /><b>barrier</b><i /><span>insert</span>
                <span>Request B</span><i /><b>barrier</b><i /><span>insert</span>
              </div>
              <button className="verify-action" onClick={verify} disabled={phase === "verifying"}>
                {phase === "verifying" ? "Generating and running…" : "Generate falsifying test"}
              </button>
              <p className="button-note">Continues the same model reasoning and hosted container.</p>
            </div>
          )}
          {verification && (
            <div className="verified-result">
              <div className={verification.status === "counterexample_confirmed" ? "failure-seal" : "inconclusive-seal"}><span aria-hidden="true">!</span><div><strong>{verification.status === "counterexample_confirmed" ? "Counterexample confirmed" : "Counterexample not reproduced"}</strong><small>{verification.status === "counterexample_confirmed" ? "The requirement fails under overlap" : "The generated check did not establish the defect"}</small></div></div>
              <div className="result-pair"><span>Expected</span><p>{verification.expectedBehavior}</p></div>
              <div className="result-pair observed"><span>Observed</span><p>{verification.observedBehavior}</p></div>
              <details><summary>Generated test</summary><pre>{verification.generatedTest}</pre></details>
              <details open><summary>Hosted shell output</summary><pre>{verification.stdout}</pre></details>
            </div>
          )}
          {error && (
            <div className="error-state" role="alert"><strong>Run interrupted</strong><p>{error}</p><button onClick={() => analyze()}>Retry live analysis</button><button className="text-action" onClick={() => analyze(true)}>Replay last available run</button></div>
          )}
          {(analysis || verification) && (
            <details className="run-details">
              <summary>Run details</summary>
              {analysis?.mode === "replay" && <p className="replay-usage-note">API usage is unavailable for the bundled reference replay.</p>}
              <dl>
                <div><dt>Mode</dt><dd>{verification?.mode ?? analysis?.mode}</dd></div>
                <div><dt>Cached tokens</dt><dd>{(verification?.usage.cachedTokens ?? analysis?.usage.cachedTokens ?? 0).toLocaleString()}</dd></div>
                <div><dt>Cache write</dt><dd>{(verification?.usage.cacheWriteTokens ?? analysis?.usage.cacheWriteTokens ?? 0).toLocaleString()}</dd></div>
                <div><dt>Tool calls</dt><dd>{verification?.usage.toolCalls ?? analysis?.usage.toolCalls}</dd></div>
              </dl>
            </details>
          )}
        </aside>
      </div>

      <section id="evidence-detail" className="evidence-drawer" aria-labelledby="evidence-title" aria-live="polite">
        <div className="drawer-heading"><div ref={evidenceHeadingRef} tabIndex={-1}><p className="eyebrow">Exact evidence</p><h2 id="evidence-title">Server-validated source excerpt</h2></div>{selectedEvidence && <button onClick={() => { setSelectedEvidence(null); evidenceTriggerRef.current?.focus(); }} aria-label="Close evidence excerpt">Close</button>}</div>
        {selectedEvidence ? (
          <div className="excerpt-grid"><div className="excerpt-meta"><strong>{selectedEvidence.path}</strong><span>Lines {selectedEvidence.startLine}–{selectedEvidence.endLine}</span><span className={selectedEvidence.verified ? "match-seal" : "mismatch-seal"}>{selectedEvidence.verified ? "Exact bytes matched" : "Not verified"}</span></div><pre><code>{selectedEvidence.excerpt}</code></pre></div>
        ) : <p className="drawer-empty">Select any file-and-line reference in the proof graph to inspect the exact excerpt and validation state.</p>}
      </section>
      </main>
      <footer><span>Built with Codex and GPT‑5.6 Sol</span><span>No uploads · No login · One immutable fixture</span></footer>
    </div>
  );
}
