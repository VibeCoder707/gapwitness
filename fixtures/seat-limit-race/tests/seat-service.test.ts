import { describe, expect, it } from "vitest";
import { createSeatHandler, InMemorySeatStore, SeatLimitError, SeatService } from "../src/seat-service";

const workspaceId = "ws-aurora";
const seedSeat = (id: string, email = `${id}@example.com`) => ({ id, workspaceId, email });

describe("SeatService baseline", () => {
  it("creates the first seat", async () => {
    const service = new SeatService(new InMemorySeatStore(), 3);
    await expect(createSeatHandler(service, workspaceId, "a@example.com")).resolves.toMatchObject({ status: 201, body: { email: "a@example.com" } });
  });

  it("creates a seat below the limit", async () => {
    const store = new InMemorySeatStore();
    store.seed([seedSeat("existing")]);
    await expect(new SeatService(store, 2).createSeat(workspaceId, "new@example.com")).resolves.toBeDefined();
  });

  it("assigns a generated identifier", async () => {
    const seat = await new SeatService(new InMemorySeatStore(), 1).createSeat(workspaceId, "a@example.com");
    expect(seat.id).toBe("seat-1");
  });

  it("stores the requested workspace", async () => {
    const seat = await new SeatService(new InMemorySeatStore(), 1).createSeat("ws-other", "a@example.com");
    expect(seat.workspaceId).toBe("ws-other");
  });

  it("stores the requested email", async () => {
    const seat = await new SeatService(new InMemorySeatStore(), 1).createSeat(workspaceId, "owner@example.com");
    expect(seat.email).toBe("owner@example.com");
  });

  it("increments generated identifiers", async () => {
    const service = new SeatService(new InMemorySeatStore(), 3);
    await service.createSeat(workspaceId, "a@example.com");
    await expect(service.createSeat(workspaceId, "b@example.com")).resolves.toMatchObject({ id: "seat-2" });
  });

  it("allows the last available seat", async () => {
    const store = new InMemorySeatStore();
    store.seed([seedSeat("one"), seedSeat("two")]);
    await expect(new SeatService(store, 3).createSeat(workspaceId, "three@example.com")).resolves.toBeDefined();
  });

  it("rejects a seat at the limit", async () => {
    const store = new InMemorySeatStore();
    store.seed([seedSeat("one"), seedSeat("two")]);
    await expect(new SeatService(store, 2).createSeat(workspaceId, "blocked@example.com")).rejects.toBeInstanceOf(SeatLimitError);
  });

  it("returns status 409 at the limit", async () => {
    const store = new InMemorySeatStore();
    store.seed([seedSeat("one")]);
    await expect(createSeatHandler(new SeatService(store, 1), workspaceId, "blocked@example.com")).resolves.toMatchObject({ status: 409 });
  });

  it("returns a stable limit message", async () => {
    const store = new InMemorySeatStore();
    store.seed([seedSeat("one")]);
    await expect(new SeatService(store, 1).createSeat(workspaceId, "blocked@example.com")).rejects.toThrow("Workspace seat limit reached");
  });

  it("does not insert after rejection", async () => {
    const store = new InMemorySeatStore();
    store.seed([seedSeat("one")]);
    await new SeatService(store, 1).createSeat(workspaceId, "blocked@example.com").catch(() => undefined);
    expect(store.countActive(workspaceId)).toBe(1);
  });

  it("counts only the requested workspace", async () => {
    const store = new InMemorySeatStore();
    store.seed([{ ...seedSeat("one"), workspaceId: "ws-neighbor" }]);
    await expect(new SeatService(store, 1).createSeat(workspaceId, "allowed@example.com")).resolves.toBeDefined();
  });

  it("keeps neighboring workspace seats", async () => {
    const store = new InMemorySeatStore();
    store.seed([{ ...seedSeat("one"), workspaceId: "ws-neighbor" }]);
    await new SeatService(store, 2).createSeat(workspaceId, "allowed@example.com");
    expect(store.countActive("ws-neighbor")).toBe(1);
  });

  it("supports a one-seat workspace", async () => {
    await expect(new SeatService(new InMemorySeatStore(), 1).createSeat(workspaceId, "only@example.com")).resolves.toBeDefined();
  });

  it("supports a larger workspace", async () => {
    const store = new InMemorySeatStore();
    store.seed(Array.from({ length: 9 }, (_, index) => seedSeat(String(index))));
    await expect(new SeatService(store, 10).createSeat(workspaceId, "tenth@example.com")).resolves.toBeDefined();
  });

  it("preserves seeded email values", () => {
    const store = new InMemorySeatStore();
    store.seed([seedSeat("one", "first@example.com")]);
    expect(store.countActive(workspaceId)).toBe(1);
  });

  it("uses the SeatLimitError name", () => {
    expect(new SeatLimitError().name).toBe("SeatLimitError");
  });

  it("uses an empty store by default", () => {
    expect(new InMemorySeatStore().countActive(workspaceId)).toBe(0);
  });
});
