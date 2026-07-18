import { describe, expect, it } from "vitest";
import { replayAnalysis, replayVerification } from "@/lib/replay";

describe("verified replay artifacts", () => {
  it("contains three requirements and a validated R3 gap", async () => {
    const result = await replayAnalysis("request-test");
    expect(result.requirements).toHaveLength(3);
    expect(result.requirements.find((item) => item.id === "R3")?.status).toBe("unsupported");
    expect(result.requirements.flatMap((item) => item.evidence).every((item) => item.verified)).toBe(true);
  });

  it("contains the deterministic counterexample", async () => {
    const result = await replayVerification("request-test");
    expect(result.status).toBe("counterexample_confirmed");
    expect(result.generatedTest).toContain("Promise.allSettled");
    expect(result.exitCode).toBe(1);
  });
});
