import type { StreamEvent } from "./types";

export function eventStream(run: (send: (event: StreamEvent) => void, signal: AbortSignal) => Promise<void>) {
  const encoder = new TextEncoder();
  const abortController = new AbortController();
  let cancelled = false;
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: StreamEvent) => {
        if (!cancelled) controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      void run(send, abortController.signal).finally(() => { if (!cancelled) controller.close(); });
    },
    cancel() { cancelled = true; abortController.abort(); },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
