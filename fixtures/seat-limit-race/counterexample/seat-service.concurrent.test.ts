import { expect, it } from "vitest";
import { InMemorySeatStore, SeatService } from "../src/seat-service";

it("does not exceed the limit under concurrent requests", async () => {
  let arrivals = 0;
  let release: (() => void) | undefined;
  const barrier = new Promise<void>((resolve) => { release = resolve; });
  const store = new InMemorySeatStore(async () => {
    arrivals += 1;
    if (arrivals === 2) release?.();
    await barrier;
  });
  const service = new SeatService(store, 1);

  const results = await Promise.allSettled([
    service.createSeat("ws-aurora", "ada@example.com"),
    service.createSeat("ws-aurora", "grace@example.com"),
  ]);

  const fulfilled = results.filter((result) => result.status === "fulfilled").length;
  const rejected = results.filter((result) => result.status === "rejected").length;
  console.log(`GAPWITNESS_RESULT fulfilled=${fulfilled} rejected=${rejected} active=${store.countActive("ws-aurora")}`);

  expect(fulfilled).toBe(1);
  expect(rejected).toBe(1);
  expect(store.countActive("ws-aurora")).toBe(1);
});
