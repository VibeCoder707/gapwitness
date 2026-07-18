export type EvidenceArtifact = "issue" | "source" | "test" | "diff" | "ci" | "manifest";
export type ProofStatus = "supported" | "partial" | "unsupported";
export type RunMode = "live" | "replay";

export type EvidenceRef = {
  artifactType: EvidenceArtifact;
  path: string;
  startLine: number;
  endLine: number;
  excerpt: string;
  relationship: "states" | "implements" | "exercises" | "reports" | "contradicts";
  verified: boolean;
};

export type RequirementProof = {
  id: "R1" | "R2" | "R3";
  text: string;
  status: ProofStatus;
  rationale: string;
  confidence: number;
  evidence: EvidenceRef[];
};

export type UsageMetrics = {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  cacheWriteTokens: number;
  toolCalls: number;
};

export type AnalysisResult = {
  mode: RunMode;
  replay?: { kind: "reference" | "last_verified"; label: string; capturedAt?: string };
  fixture: { id: "seat-limit-race"; title: string; revision: string };
  baseline: { command: string; passed: number; failed: number; durationMs: number; stdout: string };
  requirements: RequirementProof[];
  selectedGap: "R3";
  usage: UsageMetrics;
  continuationToken: string;
  requestId: string;
};

export type VerificationResult = {
  mode: RunMode;
  replay?: { kind: "reference" | "last_verified"; label: string; capturedAt?: string };
  requirementId: "R3";
  generatedTest: string;
  command: string;
  exitCode: number;
  stdout: string;
  expectedBehavior: string;
  observedBehavior: string;
  status: "counterexample_confirmed" | "not_reproduced";
  evidence: EvidenceRef[];
  usage: UsageMetrics;
  requestId: string;
};

export type ContinuationClaims = {
  scenario: "seat-limit-race";
  responseId: string;
  containerId: string;
  mode: RunMode;
  exp: number;
};

export type StreamEvent =
  | { type: "stage"; stage: string; label: string }
  | { type: "shell"; output: string }
  | { type: "result"; result: AnalysisResult | VerificationResult }
  | { type: "error"; code: string; message: string; retryable: boolean };
