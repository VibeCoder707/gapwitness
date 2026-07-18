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
    const [payload, signature] = token.split(".");
    const replacement = signature.startsWith("a") ? "b" : "a";
    expect(() => verifyContinuation(`${payload}.${replacement}${signature.slice(1)}`)).toThrow("Invalid continuation token");
  });

  it("rejects expired claims", () => {
    vi.stubEnv("DEMO_SIGNING_SECRET", "test-secret-that-is-long-enough-for-hmac");
    const token = signContinuation({ ...claims(), exp: Date.now() - 1 });
    expect(() => verifyContinuation(token)).toThrow("expired");
  });

  it("rejects a short signing secret", () => {
    vi.stubEnv("DEMO_SIGNING_SECRET", "too-short");
    expect(() => signContinuation(claims())).toThrow("at least 32 characters");
  });
});
