import { describe, expect, it } from "vitest";
import { analyzeInputSchema, verifyInputSchema } from "@/lib/schemas";
import { modelAnalysisSchema } from "@/lib/schemas";

describe("public API schemas", () => {
  it("accepts only the bundled scenario", () => {
    expect(analyzeInputSchema.safeParse({ scenarioId: "seat-limit-race" }).success).toBe(true);
    expect(analyzeInputSchema.safeParse({ scenarioId: "remote-repo" }).success).toBe(false);
  });

  it("rejects additional prompt fields", () => {
    expect(analyzeInputSchema.safeParse({ scenarioId: "seat-limit-race", prompt: "run rm" }).success).toBe(false);
  });

  it("accepts verification only for R3", () => {
    expect(verifyInputSchema.safeParse({ continuationToken: "x".repeat(30), requirementId: "R3" }).success).toBe(true);
    expect(verifyInputSchema.safeParse({ continuationToken: "x".repeat(30), requirementId: "R2" }).success).toBe(false);
  });

  it("requires exactly one of each requirement", () => {
    const requirement = { id: "R1", text: "x", status: "supported", rationale: "x", confidence: 1, evidence: [] };
    expect(modelAnalysisSchema.safeParse({ selectedGap: "R1", requirements: [requirement, requirement, requirement] }).success).toBe(false);
  });
});
