import { readFixtureFile, validateEvidenceList } from "./fixture";
import { signContinuation } from "./tokens";
import type { AnalysisResult, EvidenceRef, RequirementProof, VerificationResult } from "./types";

const sourceR1 = `  async createSeat(workspaceId: string, email: string) {
    const activeSeats = this.store.countActive(workspaceId);
    if (activeSeats >= this.limit) {
      throw new SeatLimitError();
    }

    return this.store.insert(workspaceId, email);
  }`;
const sourceR2 = `export async function createSeatHandler(service: SeatService, workspaceId: string, email: string) {
  try {
    const seat = await service.createSeat(workspaceId, email);
    return { status: 201 as const, body: seat };
  } catch (error) {
    if (error instanceof SeatLimitError) {
      return { status: error.status, body: { error: error.message } };`;
const testR1 = `  it("creates a seat below the limit", async () => {
    const store = new InMemorySeatStore();
    store.seed([seedSeat("existing")]);
    await expect(new SeatService(store, 2).createSeat(workspaceId, "new@example.com")).resolves.toBeDefined();
  });`;
const testR2 = `  it("returns status 409 at the limit", async () => {
    const store = new InMemorySeatStore();
    store.seed([seedSeat("one")]);
    await expect(createSeatHandler(new SeatService(store, 1), workspaceId, "blocked@example.com")).resolves.toMatchObject({ status: 409 });
  });`;

const evidence = (path: string, startLine: number, endLine: number, excerpt: string, relationship: EvidenceRef["relationship"], artifactType: EvidenceRef["artifactType"]): Omit<EvidenceRef, "verified"> => ({
  path, startLine, endLine, excerpt, relationship, artifactType,
});

export async function replayAnalysis(requestId: string): Promise<AnalysisResult> {
  const requirements: RequirementProof[] = [
    {
      id: "R1", text: "Creating a seat below the limit succeeds.", status: "supported", confidence: 0.99,
      rationale: "The service inserts after a below-limit check, and a focused test exercises that path.",
      evidence: await validateEvidenceList([
        evidence("src/seat-service.ts", 44, 51, sourceR1, "implements", "source"),
        evidence("tests/seat-service.test.ts", 13, 17, testR1, "exercises", "test"),
      ]),
    },
    {
      id: "R2", text: "Creating a seat at the limit returns 409.", status: "supported", confidence: 0.99,
      rationale: "The handler converts SeatLimitError into a 409 response, and a focused test exercises that boundary.",
      evidence: await validateEvidenceList([
        evidence("src/seat-service.ts", 54, 60, sourceR2, "implements", "source"),
        evidence("tests/seat-service.test.ts", 52, 56, testR2, "exercises", "test"),
      ]),
    },
    {
      id: "R3", text: "Concurrent requests cannot exceed the limit.", status: "unsupported", confidence: 0.98,
      rationale: "The count and insert are separate operations with an await before insertion. No baseline test overlaps two requests, so the concurrency guarantee has no proof.",
      evidence: await validateEvidenceList([
        evidence("src/seat-service.ts", 44, 51, sourceR1, "contradicts", "source"),
      ]),
    },
  ];
  const continuationToken = signContinuation({
    scenario: "seat-limit-race", responseId: "replay-analysis-v1", containerId: "replay-container-v1", mode: "replay", exp: Date.now() + 30 * 60_000,
  });
  return {
    mode: "replay",
    fixture: { id: "seat-limit-race", title: "Workspace seat limit", revision: "fixture-v1" },
    baseline: { command: "npm run test:fixture", passed: 18, failed: 0, durationMs: 742, stdout: "✓ 18 tests passed in 742ms" },
    requirements, selectedGap: "R3", continuationToken, requestId,
    usage: { inputTokens: 0, outputTokens: 0, cachedTokens: 0, cacheWriteTokens: 0, toolCalls: 0 },
  };
}

export async function replayVerification(requestId: string): Promise<VerificationResult> {
  const generatedTest = await readFixtureFile("counterexample/seat-service.concurrent.test.ts");
  const sourceExcerpt = `    const activeSeats = this.store.countActive(workspaceId);
    if (activeSeats >= this.limit) {
      throw new SeatLimitError();
    }

    return this.store.insert(workspaceId, email);`;
  return {
    mode: "replay", requirementId: "R3", generatedTest,
    command: "npm run test:counterexample", exitCode: 1,
    stdout: "GAPWITNESS_RESULT fulfilled=2 rejected=0 active=2\nAssertionError: expected 2 to be 1",
    expectedBehavior: "Exactly one request succeeds, one is rejected, and the active seat count remains 1.",
    observedBehavior: "Both requests succeed after reading the same pre-insert count; the active seat count becomes 2.",
    status: "counterexample_confirmed",
    evidence: await validateEvidenceList([
      evidence("src/seat-service.ts", 45, 50, sourceExcerpt, "contradicts", "source"),
    ]),
    usage: { inputTokens: 0, outputTokens: 0, cachedTokens: 0, cacheWriteTokens: 0, toolCalls: 0 },
    requestId,
  };
}
