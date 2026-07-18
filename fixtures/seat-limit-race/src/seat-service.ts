export type Seat = {
  id: string;
  workspaceId: string;
  email: string;
};

export class SeatLimitError extends Error {
  readonly status = 409;

  constructor() {
    super("Workspace seat limit reached");
    this.name = "SeatLimitError";
  }
}

export class InMemorySeatStore {
  private seats: Seat[] = [];
  private sequence = 0;

  constructor(private readonly beforeInsert: () => Promise<void> = async () => {}) {}

  seed(seats: Seat[]) {
    this.seats = [...seats];
  }

  countActive(workspaceId: string) {
    return this.seats.filter((seat) => seat.workspaceId === workspaceId).length;
  }

  async insert(workspaceId: string, email: string) {
    await this.beforeInsert();
    const seat = { id: `seat-${++this.sequence}`, workspaceId, email };
    this.seats.push(seat);
    return seat;
  }
}

export class SeatService {
  constructor(
    private readonly store: InMemorySeatStore,
    private readonly limit: number,
  ) {}

  async createSeat(workspaceId: string, email: string) {
    const activeSeats = this.store.countActive(workspaceId);
    if (activeSeats >= this.limit) {
      throw new SeatLimitError();
    }

    return this.store.insert(workspaceId, email);
  }
}

export async function createSeatHandler(service: SeatService, workspaceId: string, email: string) {
  try {
    const seat = await service.createSeat(workspaceId, email);
    return { status: 201 as const, body: seat };
  } catch (error) {
    if (error instanceof SeatLimitError) {
      return { status: error.status, body: { error: error.message } };
    }
    throw error;
  }
}
