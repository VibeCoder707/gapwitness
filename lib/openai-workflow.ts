import OpenAI from "openai";
import { fixturePromptPayload, validateEvidenceList } from "./fixture";
import { modelAnalysisSchema, modelVerificationSchema } from "./schemas";
import { replayAnalysis, replayVerification } from "./replay";
import { signContinuation } from "./tokens";
import type { AnalysisResult, ContinuationClaims, RequirementProof, UsageMetrics, VerificationResult } from "./types";

type StageReporter = (stage: string, label: string) => void;
type ShellExecution = { command: string; exitCode: number | null; stdout: string; stderr: string };

const analysisJsonSchema = {
  type: "object", additionalProperties: false, required: ["requirements", "selectedGap"],
  properties: {
    selectedGap: { type: "string", enum: ["R1", "R2", "R3"] },
    requirements: {
      type: "array", minItems: 3, maxItems: 3,
      items: {
        type: "object", additionalProperties: false,
        required: ["id", "text", "status", "rationale", "confidence", "evidence"],
        properties: {
          id: { type: "string", enum: ["R1", "R2", "R3"] },
          text: { type: "string" },
          status: { type: "string", enum: ["supported", "partial", "unsupported"] },
          rationale: { type: "string" }, confidence: { type: "number", minimum: 0, maximum: 1 },
          evidence: { type: "array", items: evidenceJsonSchema() },
        },
      },
    },
  },
};

function evidenceJsonSchema() {
  return {
    type: "object", additionalProperties: false,
    required: ["artifactType", "path", "startLine", "endLine", "excerpt", "relationship"],
    properties: {
      artifactType: { type: "string", enum: ["issue", "source", "test", "diff", "ci", "manifest"] },
      path: { type: "string" }, startLine: { type: "integer", minimum: 1 }, endLine: { type: "integer", minimum: 1 },
      excerpt: { type: "string" },
      relationship: { type: "string", enum: ["states", "implements", "exercises", "reports", "contradicts"] },
    },
  };
}

const verificationJsonSchema = {
  type: "object", additionalProperties: false,
  required: ["generatedTest", "command", "exitCode", "stdout", "expectedBehavior", "observedBehavior", "status", "evidence"],
  properties: {
    generatedTest: { type: "string" }, command: { type: "string" }, exitCode: { type: "integer" }, stdout: { type: "string" },
    expectedBehavior: { type: "string" }, observedBehavior: { type: "string" },
    status: { type: "string", enum: ["counterexample_confirmed", "not_reproduced"] },
    evidence: { type: "array", items: evidenceJsonSchema() },
  },
};

const stableInstructions = `You are GapWitness, a requirements-to-evidence verifier. Work only on the supplied immutable seat-limit fixture. Use the hosted shell only for bounded inspection and test execution. Never use the network. Map each requirement to exact, minimal, verbatim file-and-line evidence. Passing tests are evidence only for behavior they actually exercise. Treat concurrent safety as unproven unless a test overlaps requests. Return bounded JSON only. Do not claim a path, line, excerpt, command, or result you did not inspect.`;

function openAIClient() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function liveEnabled() {
  return Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_FIXTURE_FILE_ID) && process.env.GAPWITNESS_DEMO_MODE !== "replay";
}

export function usageFrom(response: Record<string, unknown>): UsageMetrics {
  const usage = (response.usage ?? {}) as Record<string, unknown>;
  const details = (usage.input_tokens_details ?? {}) as Record<string, unknown>;
  const output = Array.isArray(response.output) ? response.output : [];
  const toolCalls = output.filter((item) => {
    if (typeof item !== "object" || item === null) return false;
    const type = String((item as Record<string, unknown>).type);
    return type.includes("call") && !type.includes("output");
  }).length;
  return {
    inputTokens: Number(usage.input_tokens ?? 0), outputTokens: Number(usage.output_tokens ?? 0),
    cachedTokens: Number(details.cached_tokens ?? 0), cacheWriteTokens: Number(details.cache_write_tokens ?? 0), toolCalls,
  };
}

function combineUsage(...runs: UsageMetrics[]): UsageMetrics {
  return runs.reduce<UsageMetrics>((total, run) => ({
    inputTokens: total.inputTokens + run.inputTokens,
    outputTokens: total.outputTokens + run.outputTokens,
    cachedTokens: total.cachedTokens + run.cachedTokens,
    cacheWriteTokens: total.cacheWriteTokens + run.cacheWriteTokens,
    toolCalls: total.toolCalls + run.toolCalls,
  }), { inputTokens: 0, outputTokens: 0, cachedTokens: 0, cacheWriteTokens: 0, toolCalls: 0 });
}

function findContainerId(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const object = value as Record<string, unknown>;
  if (typeof object.container_id === "string") return object.container_id;
  if (typeof object.id === "string" && String(object.type ?? "").includes("container")) return object.id;
  for (const child of Object.values(object)) {
    if (Array.isArray(child)) {
      for (const item of child) { const found = findContainerId(item); if (found) return found; }
    } else {
      const found = findContainerId(child); if (found) return found;
    }
  }
  return undefined;
}

export function shellExecutions(response: Record<string, unknown>): ShellExecution[] {
  const output = Array.isArray(response.output) ? response.output : [];
  const calls = new Map<string, string>();
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    if (record.type !== "shell_call" || typeof record.call_id !== "string") continue;
    const action = (record.action ?? {}) as Record<string, unknown>;
    const commands = Array.isArray(action.commands) ? action.commands.filter((value): value is string => typeof value === "string") : [];
    calls.set(record.call_id, commands.join(" && "));
  }
  const executions: ShellExecution[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    if (record.type !== "shell_call_output" || typeof record.call_id !== "string") continue;
    const chunks = Array.isArray(record.output) ? record.output : [];
    let exitCode: number | null = null;
    let stdout = "";
    let stderr = "";
    for (const chunk of chunks) {
      if (!chunk || typeof chunk !== "object") continue;
      const content = chunk as Record<string, unknown>;
      stdout += typeof content.stdout === "string" ? content.stdout : "";
      stderr += typeof content.stderr === "string" ? content.stderr : "";
      const outcome = (content.outcome ?? {}) as Record<string, unknown>;
      if (outcome.type === "exit" && typeof outcome.exit_code === "number") exitCode = outcome.exit_code;
    }
    executions.push({ command: calls.get(record.call_id) ?? "", exitCode, stdout, stderr });
  }
  return executions;
}

function cleanTerminalOutput(value: string) {
  return value.replace(/\u001b\[[0-9;]*m/g, "").slice(0, 8_000);
}

function exactExecutedTest(executions: ShellExecution[]) {
  const output = executions.map((execution) => `${execution.stdout}\n${execution.stderr}`).join("\n");
  const match = output.match(/GAPWITNESS_TEST_BEGIN\r?\n([\s\S]*?)\r?\nGAPWITNESS_TEST_END/);
  if (!match) throw new Error("Hosted shell did not return the exact generated test between verification markers");
  const test = match[1].trim();
  if (!test || test.length > 12_000) throw new Error("Hosted shell returned an invalid generated test artifact");
  return test;
}

function verifiedBaseline(response: Record<string, unknown>, durationMs: number) {
  const execution = shellExecutions(response).find((item) => item.command.includes("npm run test:fixture"));
  if (!execution || execution.exitCode !== 0) throw new Error("Hosted baseline was not executed successfully");
  const combined = cleanTerminalOutput(`${execution.stdout}\n${execution.stderr}`);
  const match = combined.match(/Tests\s+(\d+)\s+passed\s+\((\d+)\)/i);
  if (!match || Number(match[1]) !== 18 || Number(match[2]) !== 18) throw new Error("Hosted baseline did not prove 18 passing checks");
  return { command: execution.command, passed: 18, failed: 0, durationMs, stdout: combined };
}

function isToolCompatibilityError(error: unknown) {
  const record = error as { status?: number; message?: string };
  return [400, 404, 422].includes(record?.status ?? 0) && /programmatic|tool|caller|shell/i.test(record?.message ?? "");
}

async function validatedRequirements(requirements: RequirementProof[]) {
  return Promise.all(requirements.map(async (requirement) => ({
    ...requirement,
    evidence: await validateEvidenceList(requirement.evidence),
  })));
}

function analysisRequest(payload: string, programmatic = true) {
  const fixtureFileId = process.env.OPENAI_FIXTURE_FILE_ID as string;
  const tools: Array<Record<string, unknown>> = [];
  if (programmatic) tools.push({ type: "programmatic_tool_calling" });
  tools.push({
    type: "shell",
    environment: { type: "container_auto", file_ids: [fixtureFileId], network_policy: { type: "disabled" } },
    ...(programmatic ? { allowed_callers: ["programmatic"] } : {}),
  });
  return {
    model: "gpt-5.6-sol",
    reasoning: { effort: "high" },
    prompt_cache_key: "gapwitness:seat-limit-race:v1",
    prompt_cache_options: { mode: "explicit", ttl: "30m" },
    input: [
      { role: "developer", content: [{ type: "input_text", text: `${stableInstructions}\n\nImmutable fixture copy:\n${payload}`, prompt_cache_breakpoint: { mode: "explicit" } }] },
      { role: "user", content: [{ type: "input_text", text: "The self-contained fixture zip is mounted in /mnt/data. Unzip it, enter seat-limit-race, run npm run test:fixture, preserve the Vitest summary, then judge R1-R3 and identify the weakest requirement from the evidence." }] },
    ],
    tools,
    text: { format: { type: "json_schema", name: "gapwitness_analysis", strict: true, schema: analysisJsonSchema } },
    max_output_tokens: 5_000,
    max_tool_calls: 8,
    parallel_tool_calls: false,
  };
}

export async function runAnalysis(requestId: string, report: StageReporter, forceReplay = false, signal?: AbortSignal): Promise<AnalysisResult> {
  if (forceReplay || !liveEnabled()) {
    report("replay", "Live model unavailable. Loading the bundled reference replay.");
    return replayAnalysis(requestId);
  }
  report("fixture", "Opening the immutable fixture");
  const payload = await fixturePromptPayload();
  const client = openAIClient();
  let response: unknown;
  const modelStartedAt = Date.now();
  report("baseline", "GPT-5.6 Sol is running the 18 baseline checks");
  try {
    response = await client.responses.create(analysisRequest(payload, true) as never, { signal });
  } catch (firstError) {
    if (!isToolCompatibilityError(firstError)) throw firstError;
    report("fallback", "Programmatic orchestration did not start. Retrying with the hosted shell directly.");
    try {
      response = await client.responses.create(analysisRequest(payload, false) as never, { signal });
    } catch (secondError) {
      throw secondError;
    }
  }
  report("mapping", "Mapping requirements to exact evidence");
  const firstRaw = response as Record<string, unknown> & { id: string; output_text?: string };
  const baseline = verifiedBaseline(firstRaw, Date.now() - modelStartedAt);
  const runUsage = [usageFrom(firstRaw)];
  let raw = firstRaw;
  let parsed = modelAnalysisSchema.parse(JSON.parse(raw.output_text ?? "{}"));
  if (parsed.selectedGap !== "R3") throw new Error("Model did not identify the known concurrency proof gap");
  let requirements = await validatedRequirements(parsed.requirements.map((item) => ({ ...item, evidence: item.evidence.map((ref) => ({ ...ref, verified: false })) })));
  if (requirements.some((requirement) => requirement.evidence.some((ref) => !ref.verified))) {
    report("validation", "Retrying one citation against the immutable source");
    const correction = await client.responses.create({
      model: "gpt-5.6-sol", previous_response_id: raw.id,
      reasoning: { effort: "high", context: "all_turns" },
      input: [{ role: "user", content: [{ type: "input_text", text: "One or more citations failed exact server validation. Re-read the immutable fixture already in context and return the complete requirement graph with corrected, verbatim, minimal excerpts and exact line ranges. Do not run more tools." }] }],
      text: { format: { type: "json_schema", name: "gapwitness_analysis_retry", strict: true, schema: analysisJsonSchema } },
      max_output_tokens: 3_500,
    } as never, { signal }) as unknown as typeof raw;
    raw = correction;
    runUsage.push(usageFrom(correction));
    parsed = modelAnalysisSchema.parse(JSON.parse(raw.output_text ?? "{}"));
    if (parsed.selectedGap !== "R3") throw new Error("Corrected graph lost the concurrency proof gap");
    requirements = await validatedRequirements(parsed.requirements.map((item) => ({ ...item, evidence: item.evidence.map((ref) => ({ ...ref, verified: false })) })));
  }
  requirements = requirements.map((requirement) => {
    const valid = requirement.evidence.length > 0 && requirement.evidence.every((ref) => ref.verified);
    return valid ? requirement : { ...requirement, status: "unsupported" as const, confidence: 0, rationale: `${requirement.rationale} Citation validation failed, so this claim is not treated as proven.` };
  });
  if (requirements.some((requirement) => requirement.evidence.some((ref) => !ref.verified))) {
    report("validation", "A citation remains unverified and its claim was downgraded");
  }
  const containerId = findContainerId(firstRaw);
  if (!containerId) throw new Error("Hosted container identifier was not returned");
  const continuationToken = signContinuation({
    scenario: "seat-limit-race", responseId: raw.id, containerId, mode: "live", exp: Date.now() + 30 * 60_000,
  });
  return {
    mode: "live", fixture: { id: "seat-limit-race", title: "Workspace seat limit", revision: "fixture-v1" },
    baseline,
    requirements, selectedGap: parsed.selectedGap, usage: combineUsage(...runUsage), continuationToken, requestId,
  };
}

function verificationRequest(claims: ContinuationClaims, programmatic: boolean) {
  const tools: Array<Record<string, unknown>> = [];
  if (programmatic) tools.push({ type: "programmatic_tool_calling" });
  tools.push({
    type: "shell", environment: { type: "container_reference", container_id: claims.containerId },
    ...(programmatic ? { allowed_callers: ["programmatic"] } : {}),
  });
  return {
    model: "gpt-5.6-sol", previous_response_id: claims.responseId,
    reasoning: { effort: "high", context: "all_turns" },
    prompt_cache_key: "gapwitness:seat-limit-race:v1",
    input: [{ role: "user", content: [{ type: "input_text", text: "For R3 only, work in the existing /mnt/data/seat-limit-race fixture. Write a deterministic Vitest counterexample under 12,000 characters to counterexample/generated.test.ts using a two-arrival barrier. The test must log exactly GAPWITNESS_RESULT fulfilled=<n> rejected=<n> active=<n> before assertions. Run npm run test:counterexample. Then print the exact executed file between lines containing only GAPWITNESS_TEST_BEGIN and GAPWITNESS_TEST_END. In the structured evidence, cite only exact immutable fixture source or issue lines that explain the race, never the generated file. The server will derive the test, command, exit, stdout, and confirmation from actual shell output." }] }],
    tools,
    text: { format: { type: "json_schema", name: "gapwitness_verification", strict: true, schema: verificationJsonSchema } },
    max_output_tokens: 5_000, max_tool_calls: 6, parallel_tool_calls: false,
  };
}

export async function runVerification(claims: ContinuationClaims, requestId: string, report: StageReporter, signal?: AbortSignal): Promise<VerificationResult> {
  if (claims.mode === "replay" || !liveEnabled()) {
    report("replay", "Loading the bundled reference counterexample");
    return replayVerification(requestId);
  }
  report("generate", "Continuing the same reasoning trace to generate a barrier test");
  const client = openAIClient();
  report("run", "Running the generated test in the hosted container");
  let response: Record<string, unknown> & { id: string; output_text?: string };
  try {
    response = await client.responses.create(verificationRequest(claims, true) as never, { signal }) as unknown as typeof response;
  } catch (firstError) {
    if (!isToolCompatibilityError(firstError)) throw firstError;
    report("fallback", "Programmatic orchestration did not start. Retrying verification with the hosted shell directly.");
    response = await client.responses.create(verificationRequest(claims, false) as never, { signal }) as unknown as typeof response;
  }
  const executionResponse = response;
  const usageRuns = [usageFrom(response)];
  let parsed = modelVerificationSchema.parse(JSON.parse(response.output_text ?? "{}"));
  let validated = await validateEvidenceList(parsed.evidence.map((ref) => ({ ...ref, verified: false })));
  if (validated.length === 0 || validated.some((ref) => !ref.verified)) {
    report("validation", "Retrying one verification citation against the immutable source");
    const correction = await client.responses.create({
      model: "gpt-5.6-sol", previous_response_id: response.id,
      reasoning: { effort: "high", context: "all_turns" },
      input: [{ role: "user", content: [{ type: "input_text", text: "The verification citation failed exact server validation. Without running tools, return the complete verification JSON again with a minimal verbatim citation to the immutable src/seat-service.ts check-then-insert race. Keep the other semantic fields faithful to the test already run." }] }],
      text: { format: { type: "json_schema", name: "gapwitness_verification_retry", strict: true, schema: verificationJsonSchema } },
      max_output_tokens: 3_500,
    } as never, { signal }) as unknown as typeof response;
    usageRuns.push(usageFrom(correction));
    parsed = modelVerificationSchema.parse(JSON.parse(correction.output_text ?? "{}"));
    validated = await validateEvidenceList(parsed.evidence.map((ref) => ({ ...ref, verified: false })));
  }
  const executions = shellExecutions(executionResponse);
  const execution = executions.find((item) => item.command.includes("npm run test:counterexample"));
  if (!execution) throw new Error("Generated counterexample was not executed");
  const generatedTest = exactExecutedTest(executions);
  const actualOutput = cleanTerminalOutput(`${execution.stdout}\n${execution.stderr}`);
  const sentinel = actualOutput.match(/GAPWITNESS_RESULT fulfilled=(\d+) rejected=(\d+) active=(\d+)/);
  const generatedLooksBounded = generatedTest.includes("GAPWITNESS_RESULT") && generatedTest.includes("Promise.allSettled") && generatedTest.length <= 12_000;
  const evidenceVerified = validated.length > 0 && validated.every((ref) => ref.verified);
  const confirmed = execution.exitCode !== 0 && sentinel?.[1] === "2" && sentinel?.[2] === "0" && sentinel?.[3] === "2" && generatedLooksBounded && evidenceVerified;
  return {
    mode: "live", requirementId: "R3", generatedTest, command: execution.command,
    exitCode: execution.exitCode ?? -1, stdout: actualOutput, expectedBehavior: parsed.expectedBehavior,
    observedBehavior: confirmed ? "Both requests succeeded after reading the same pre-insert count; the active seat count became 2." : parsed.observedBehavior,
    status: confirmed ? "counterexample_confirmed" : "not_reproduced", evidence: validated,
    usage: combineUsage(...usageRuns), requestId,
  };
}
