import { afterEach, describe, expect, it, vi } from "vitest";
import { signContinuation, verifyContinuation } from "@/lib/tokens";

const claims = () => ({
  scenario: "seat-limit-race" as const, responseId: "resp_123", containerId: "cntr_123", mode: "live" as const, exp: Date.now() + 60_000,
});

afterEach(() => vi.unstubAllEnvs());

describe("continuation tokens", () => {
  it("round-trips signed claims", () => {
    vi.stubEnv("DEMO_SIGNING_SECRET", "test-secret-that-is-long-enough-for-hmac");
    expect(verifyContinuation(signContinuation(claims()))).toMatchObject({ responseId: "resp_123" });
  });

  it("rejects tampering", () => {
    vi.stubEnv("DEMO_SIGNING_SECRET", "test-secret-that-is-long-enough-for-hmac");
    const token = signContinuation(claims());
    expect(() => verifyContinuation(`${token.slice(0, -1)}x`)).toThrow("Invalid continuation token");
  });

  it("rejects expired claims", () => {
    vi.stubEnv("DEMO_SIGNING_SECRET", "test-secret-that-is-long-enough-for-hmac");
    const token = signContinuation({ ...claims(), exp: Date.now() - 1 });
    expect(() => verifyContinuation(token)).toThrow("expired");
  });
});
