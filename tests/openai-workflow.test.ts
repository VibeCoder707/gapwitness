import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("openai", () => ({
  default: class MockOpenAI {
    responses = { create: mocks.create };
  },
}));

import { runAnalysis, runVerification, shellExecutions } from "@/lib/openai-workflow";

const sourceCreate = `  async createSeat(workspaceId: string, email: string) {
    const activeSeats = this.store.countActive(workspaceId);
    if (activeSeats >= this.limit) {
      throw new SeatLimitError();
    }

    return this.store.insert(workspaceId, email);
  }`;
const executedTest = "await Promise.allSettled([]); console.log(`GAPWITNESS_RESULT fulfilled=2 rejected=0 active=2`);";

function requirementGraph(excerpt = sourceCreate) {
  return {
    selectedGap: "R3",
    requirements: [
      { id: "R1", text: "Creating a seat below the limit succeeds.", status: "supported", rationale: "Covered.", confidence: 0.9, evidence: [{ artifactType: "source", path: "src/seat-service.ts", startLine: 44, endLine: 51, excerpt, relationship: "implements" }] },
      { id: "R2", text: "Creating a seat at the limit returns 409.", status: "supported", rationale: "Covered.", confidence: 0.9, evidence: [{ artifactType: "source", path: "src/seat-service.ts", startLine: 8, endLine: 8, excerpt: "  readonly status = 409;", relationship: "implements" }] },
      { id: "R3", text: "Concurrent requests cannot exceed the limit.", status: "unsupported", rationale: "No overlap test.", confidence: 0.9, evidence: [{ artifactType: "source", path: "src/seat-service.ts", startLine: 44, endLine: 51, excerpt: sourceCreate, relationship: "contradicts" }] },
    ],
  };
}

function liveAnalysisResponse(graph = requirementGraph()) {
  return {
    id: "resp_analysis_123",
    output_text: JSON.stringify(graph),
    usage: { input_tokens: 100, output_tokens: 20, input_tokens_details: { cached_tokens: 80, cache_write_tokens: 10 } },
    output: [
      { type: "shell_call", call_id: "call_baseline", action: { commands: ["cd seat-limit-race && npm run test:fixture"] }, environment: { type: "container_reference", container_id: "cntr_123" } },
      { type: "shell_call_output", call_id: "call_baseline", output: [{ stdout: "Test Files 1 passed (1)\nTests 18 passed (18)", stderr: "", outcome: { type: "exit", exit_code: 0 } }] },
    ],
  };
}

beforeEach(() => {
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  vi.stubEnv("OPENAI_FIXTURE_FILE_ID", "file_fixture");
  vi.stubEnv("DEMO_SIGNING_SECRET", "test-secret-that-is-long-enough-for-hmac");
  vi.stubEnv("GAPWITNESS_LIVE_ENABLED", "true");
  mocks.create.mockReset();
});

afterEach(() => vi.unstubAllEnvs());

describe("live workflow validation", () => {
  it("keeps paid calls disabled unless live mode is explicitly enabled", async () => {
    vi.stubEnv("GAPWITNESS_LIVE_ENABLED", "");
    const result = await runAnalysis("request-replay-safe", () => undefined);
    expect(result.mode).toBe("replay");
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("derives the baseline from hosted shell output", async () => {
    mocks.create.mockResolvedValueOnce(liveAnalysisResponse());
    const stages: string[] = [];
    const result = await runAnalysis("request-live", (stage) => stages.push(stage));
    expect(result.mode).toBe("live");
    expect(result.baseline).toMatchObject({ passed: 18, failed: 0 });
    expect(result.baseline.stdout).toContain("Tests 18 passed (18)");
    expect(result.requirements.flatMap((item) => item.evidence).every((item) => item.verified)).toBe(true);
    expect(stages).toContain("baseline");
    const request = mocks.create.mock.calls[0][0];
    expect(request.tools[1].environment).toEqual({ type: "container_auto", file_ids: ["file_fixture"], network_policy: { type: "disabled" } });
    expect(request.max_tool_calls).toBe(8);
  });

  it("falls back only after a programmatic tool compatibility error", async () => {
    mocks.create.mockRejectedValueOnce({ status: 400, message: "programmatic tool caller unsupported" }).mockResolvedValueOnce(liveAnalysisResponse());
    const stages: string[] = [];
    await runAnalysis("request-fallback", (stage) => stages.push(stage));
    expect(mocks.create).toHaveBeenCalledTimes(2);
    expect(stages).toContain("fallback");
    expect(mocks.create.mock.calls[1][0].tools).toHaveLength(1);
  });

  it("retries an invalid citation once and uses the corrected graph", async () => {
    mocks.create.mockResolvedValueOnce(liveAnalysisResponse(requirementGraph("not the source"))).mockResolvedValueOnce({
      id: "resp_correction", output_text: JSON.stringify(requirementGraph()),
      usage: { input_tokens: 50, output_tokens: 10, input_tokens_details: { cached_tokens: 40, cache_write_tokens: 0 } }, output: [],
    });
    const result = await runAnalysis("request-retry", () => undefined);
    expect(mocks.create).toHaveBeenCalledTimes(2);
    expect(result.requirements.every((item) => item.evidence.every((evidence) => evidence.verified))).toBe(true);
  });

  it("derives counterexample confirmation from the shell sentinel", async () => {
    mocks.create.mockResolvedValueOnce({
      id: "resp_verify",
      output_text: JSON.stringify({
        generatedTest: "This model field must not be displayed because the shell artifact is authoritative.",
        command: "fabricated", exitCode: 0, stdout: "fabricated",
        expectedBehavior: "One succeeds.", observedBehavior: "Unknown.", status: "not_reproduced",
        evidence: [{ artifactType: "source", path: "src/seat-service.ts", startLine: 45, endLine: 45, excerpt: "    const activeSeats = this.store.countActive(workspaceId);", relationship: "contradicts" }],
      }),
      usage: { input_tokens: 50, output_tokens: 10, input_tokens_details: { cached_tokens: 40, cache_write_tokens: 0 } },
      output: [
        { type: "shell_call", call_id: "call_verify", action: { commands: ["npm run test:counterexample"] } },
        { type: "shell_call_output", call_id: "call_verify", output: [{ stdout: `GAPWITNESS_RESULT fulfilled=2 rejected=0 active=2\nGAPWITNESS_TEST_BEGIN\n${executedTest}\nGAPWITNESS_TEST_END`, stderr: "AssertionError", outcome: { type: "exit", exit_code: 1 } }] },
      ],
    });
    const result = await runVerification({ scenario: "seat-limit-race", responseId: "resp_analysis_123", containerId: "cntr_123", mode: "live", exp: Date.now() + 60_000 }, "request-verify", () => undefined);
    expect(result.status).toBe("counterexample_confirmed");
    expect(result.exitCode).toBe(1);
    expect(result.command).toBe("npm run test:counterexample");
    expect(result.generatedTest).toBe(executedTest);
  });

  it("retries an invalid verification citation once", async () => {
    const invalid = {
      id: "resp_verify_invalid",
      output_text: JSON.stringify({
        generatedTest: executedTest, command: "ignored", exitCode: 0, stdout: "ignored",
        expectedBehavior: "One succeeds.", observedBehavior: "Two succeeded.", status: "counterexample_confirmed",
        evidence: [{ artifactType: "source", path: "src/seat-service.ts", startLine: 45, endLine: 45, excerpt: "fabricated", relationship: "contradicts" }],
      }),
      usage: { input_tokens: 50, output_tokens: 10, input_tokens_details: { cached_tokens: 40, cache_write_tokens: 0 } },
      output: [
        { type: "shell_call", call_id: "call_verify", action: { commands: ["npm run test:counterexample"] } },
        { type: "shell_call_output", call_id: "call_verify", output: [{ stdout: `GAPWITNESS_RESULT fulfilled=2 rejected=0 active=2\nGAPWITNESS_TEST_BEGIN\n${executedTest}\nGAPWITNESS_TEST_END`, stderr: "AssertionError", outcome: { type: "exit", exit_code: 1 } }] },
      ],
    };
    const corrected = {
      id: "resp_verify_corrected", output_text: JSON.stringify({
        generatedTest: executedTest, command: "ignored", exitCode: 1, stdout: "ignored",
        expectedBehavior: "One succeeds.", observedBehavior: "Two succeeded.", status: "counterexample_confirmed",
        evidence: [{ artifactType: "source", path: "src/seat-service.ts", startLine: 45, endLine: 45, excerpt: "    const activeSeats = this.store.countActive(workspaceId);", relationship: "contradicts" }],
      }),
      usage: { input_tokens: 20, output_tokens: 5, input_tokens_details: { cached_tokens: 15, cache_write_tokens: 0 } }, output: [],
    };
    mocks.create.mockResolvedValueOnce(invalid).mockResolvedValueOnce(corrected);
    const result = await runVerification({ scenario: "seat-limit-race", responseId: "resp_analysis_123", containerId: "cntr_123", mode: "live", exp: Date.now() + 60_000 }, "request-verify-retry", () => undefined);
    expect(mocks.create).toHaveBeenCalledTimes(2);
    expect(result.status).toBe("counterexample_confirmed");
    expect(result.evidence.every((item) => item.verified)).toBe(true);
    expect(result.usage.inputTokens).toBe(70);
  });

  it("extracts shell outputs by call id", () => {
    expect(shellExecutions(liveAnalysisResponse())).toEqual([expect.objectContaining({ exitCode: 0, command: expect.stringContaining("test:fixture") })]);
  });
});
