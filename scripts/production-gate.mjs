import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const baseUrl = process.argv[2]?.replace(/\/$/, "");
if (!baseUrl || !/^https:\/\//.test(baseUrl)) {
  throw new Error("Usage: npm run gate:production -- https://your-production-host");
}

async function resultFromSse(response) {
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  const events = (await response.text()).split("\n\n").flatMap((block) => {
    const line = block.split("\n").find((item) => item.startsWith("data: "));
    return line ? [JSON.parse(line.slice(6))] : [];
  });
  const error = events.find((event) => event.type === "error");
  if (error) throw new Error(error.message);
  const result = events.findLast((event) => event.type === "result")?.result;
  if (!result) throw new Error("The stream completed without a result");
  return result;
}

function assertVerified(analysis, verification, durationMs) {
  const analysisEvidence = analysis.requirements?.flatMap((item) => item.evidence ?? []) ?? [];
  const valid = analysis.mode === "live" && analysis.baseline?.passed === 18 && analysis.baseline?.failed === 0 &&
    analysis.selectedGap === "R3" && analysis.requirements?.length === 3 && analysisEvidence.length > 0 &&
    analysisEvidence.every((item) => item.verified === true) && verification.mode === "live" &&
    verification.requirementId === "R3" && verification.status === "counterexample_confirmed" &&
    verification.exitCode !== 0 && verification.stdout?.includes("GAPWITNESS_RESULT fulfilled=2 rejected=0 active=2") &&
    verification.evidence?.length > 0 && verification.evidence.every((item) => item.verified === true) && durationMs < 180_000;
  if (!valid) throw new Error("A production run failed the GapWitness acceptance gate");
}

function sanitizedArtifact(analysis, verification, capturedAt) {
  const safeAnalysis = {
    fixture: analysis.fixture, baseline: analysis.baseline, requirements: analysis.requirements,
    selectedGap: analysis.selectedGap, usage: analysis.usage,
  };
  const safeVerification = {
    requirementId: verification.requirementId, generatedTest: verification.generatedTest, command: verification.command,
    exitCode: verification.exitCode, stdout: verification.stdout, expectedBehavior: verification.expectedBehavior,
    observedBehavior: verification.observedBehavior, status: verification.status, evidence: verification.evidence,
    usage: verification.usage,
  };
  return { schemaVersion: 1, capturedAt, analysis: safeAnalysis, verification: safeVerification };
}

const runs = [];
let lastArtifact;
for (let index = 1; index <= 5; index += 1) {
  const startedAt = Date.now();
  const analysis = await resultFromSse(await fetch(`${baseUrl}/api/analyze`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scenarioId: "seat-limit-race" }),
  }));
  const verification = await resultFromSse(await fetch(`${baseUrl}/api/verify`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ continuationToken: analysis.continuationToken, requirementId: "R3" }),
  }));
  const durationMs = Date.now() - startedAt;
  assertVerified(analysis, verification, durationMs);
  const capturedAt = new Date().toISOString();
  lastArtifact = sanitizedArtifact(analysis, verification, capturedAt);
  runs.push({ run: index, capturedAt, durationMs, baselinePassed: analysis.baseline.passed, selectedGap: analysis.selectedGap,
    counterexample: verification.status, evidenceRefs: analysis.requirements.flatMap((item) => item.evidence).length + verification.evidence.length,
    cachedTokens: analysis.usage.cachedTokens + verification.usage.cachedTokens, toolCalls: analysis.usage.toolCalls + verification.usage.toolCalls });
  console.info(`Run ${index}/5 passed in ${(durationMs / 1000).toFixed(1)}s`);
}

const root = process.cwd();
await mkdir(path.join(root, "artifacts"), { recursive: true });
await mkdir(path.join(root, "fixtures", "replay"), { recursive: true });
await writeFile(path.join(root, "artifacts", "production-gate.json"), `${JSON.stringify({ baseUrl, completedAt: new Date().toISOString(), runs }, null, 2)}\n`);
await writeFile(path.join(root, "fixtures", "replay", "last-verified-run.json"), `${JSON.stringify(lastArtifact, null, 2)}\n`);
console.info("Five-run gate passed. Sanitized evidence and the last verified replay were written without continuation tokens or OpenAI identifiers.");
