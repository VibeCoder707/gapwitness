import { describe, expect, it } from "vitest";
import { assertFixtureIntegrity, validateEvidence } from "@/lib/fixture";

describe("immutable evidence validation", () => {
  it("matches the committed hash and line manifest", async () => {
    await expect(assertFixtureIntegrity()).resolves.toBeUndefined();
  });
  it("accepts an exact allowlisted excerpt", async () => {
    const result = await validateEvidence({
      artifactType: "source", path: "src/seat-service.ts", startLine: 45, endLine: 45,
      excerpt: "    const activeSeats = this.store.countActive(workspaceId);", relationship: "implements",
    });
    expect(result.verified).toBe(true);
  });

  it("rejects a changed excerpt", async () => {
    const result = await validateEvidence({
      artifactType: "source", path: "src/seat-service.ts", startLine: 45, endLine: 45,
      excerpt: "    const activeSeats = 0;", relationship: "implements",
    });
    expect(result.verified).toBe(false);
  });

  it("rejects paths outside the fixture allowlist", async () => {
    const result = await validateEvidence({
      artifactType: "source", path: "../../.env", startLine: 1, endLine: 1,
      excerpt: "secret", relationship: "implements",
    });
    expect(result.verified).toBe(false);
  });
});
