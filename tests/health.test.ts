import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/health/route";

afterEach(() => vi.unstubAllEnvs());

describe("deployment health", () => {
  it("reports local replay readiness without exposing identifiers", async () => {
    const body = await GET().json();
    expect(body).toMatchObject({ status: "replay_only", liveReady: false, replayReady: true, fixture: "seat-limit-race" });
    expect(JSON.stringify(body)).not.toContain("gpt-5.6");
  });

  it("reports an unconfigured public deployment without a signing secret", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("DEMO_SIGNING_SECRET", "");
    const body = await GET().json();
    expect(body).toMatchObject({ status: "unconfigured", liveReady: false, replayReady: false });
  });

  it("reports live readiness only with all required configuration", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("OPENAI_FIXTURE_FILE_ID", "file-test");
    vi.stubEnv("DEMO_SIGNING_SECRET", "test-secret-that-is-long-enough-for-health");
    const body = await GET().json();
    expect(body).toMatchObject({ status: "ready", liveReady: true, replayReady: true });
  });
});
