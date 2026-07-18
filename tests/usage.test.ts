import { describe, expect, it } from "vitest";
import { usageFrom } from "@/lib/openai-workflow";

describe("usage metrics", () => {
  it("maps cache and tool-call details without exposing response identifiers", () => {
    expect(usageFrom({
      usage: { input_tokens: 100, output_tokens: 20, input_tokens_details: { cached_tokens: 80, cache_write_tokens: 10 } },
      output: [{ type: "shell_call" }, { type: "message" }],
    })).toEqual({ inputTokens: 100, outputTokens: 20, cachedTokens: 80, cacheWriteTokens: 10, toolCalls: 1 });
  });
});
