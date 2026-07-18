import { describe, expect, it } from "vitest";
import { beginGuard, withinRateWindow } from "@/lib/request-guard";

describe("request guards", () => {
  it("blocks a duplicate while work is in flight and releases afterward", () => {
    const key = `in-flight-${crypto.randomUUID()}`;
    const finish = beginGuard(key, 180_000);
    expect(finish).toBeTypeOf("function");
    expect(beginGuard(key, 180_000)).toBeNull();
    finish?.(true);
    expect(beginGuard(key, 180_000)).toBeTypeOf("function");
  });

  it("bounds requests in a rolling rate window", () => {
    const key = `window-${crypto.randomUUID()}`;
    expect(withinRateWindow(key, 2, 60_000)).toBe(true);
    expect(withinRateWindow(key, 2, 60_000)).toBe(true);
    expect(withinRateWindow(key, 2, 60_000)).toBe(false);
  });
});
