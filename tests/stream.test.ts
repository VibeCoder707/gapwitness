import { describe, expect, it } from "vitest";
import { eventStream } from "@/lib/stream";

describe("event stream", () => {
  it("emits ordered server-sent event frames with anti-buffering headers", async () => {
    const response = eventStream(async (send) => {
      send({ type: "stage", stage: "one", label: "First" });
      await Promise.resolve();
      send({ type: "stage", stage: "two", label: "Second" });
    });
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(response.headers.get("x-accel-buffering")).toBe("no");
    const text = await response.text();
    expect(text).toContain('data: {"type":"stage","stage":"one","label":"First"}\n\n');
    expect(text.indexOf('"one"')).toBeLessThan(text.indexOf('"two"'));
  });

  it("aborts in-flight work when the client cancels", async () => {
    let observed: AbortSignal | undefined;
    const response = eventStream(async (_send, signal) => {
      observed = signal;
      await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
    });
    await response.body?.cancel();
    expect(observed?.aborted).toBe(true);
  });
});
