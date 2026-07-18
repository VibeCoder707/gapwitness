import { z } from "zod";

export const analyzeInputSchema = z.object({
  scenarioId: z.literal("seat-limit-race"),
}).strict();

export const verifyInputSchema = z.object({
  continuationToken: z.string().min(20).max(4096),
  requirementId: z.literal("R3"),
}).strict();

export const evidenceSchema = z.object({
  artifactType: z.enum(["issue", "source", "test", "diff", "ci", "manifest"]),
  path: z.string().min(1).max(240),
  startLine: z.number().int().positive(),
  endLine: z.number().int().positive(),
  excerpt: z.string().min(1).max(4000),
  relationship: z.enum(["states", "implements", "exercises", "reports", "contradicts"]),
  verified: z.boolean().optional(),
});

export const modelAnalysisSchema = z.object({
  requirements: z.array(z.object({
    id: z.enum(["R1", "R2", "R3"]),
    text: z.string().min(1).max(300),
    status: z.enum(["supported", "partial", "unsupported"]),
    rationale: z.string().min(1).max(1600),
    confidence: z.number().min(0).max(1),
    evidence: z.array(evidenceSchema).max(8),
  })).length(3),
  selectedGap: z.enum(["R1", "R2", "R3"]),
}).superRefine((value, context) => {
  const ids = value.requirements.map((requirement) => requirement.id).sort().join(",");
  if (ids !== "R1,R2,R3") context.addIssue({ code: "custom", message: "Requirements must contain exactly R1, R2, and R3", path: ["requirements"] });
});

export const modelVerificationSchema = z.object({
  generatedTest: z.string().min(1).max(12000),
  command: z.string().max(500),
  exitCode: z.number().int(),
  stdout: z.string().max(8000),
  expectedBehavior: z.string().min(1).max(1000),
  observedBehavior: z.string().min(1).max(1000),
  status: z.enum(["counterexample_confirmed", "not_reproduced"]),
  evidence: z.array(evidenceSchema).max(8),
});
