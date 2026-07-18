import type { StreamEvent } from "./types";

export function eventStream(run: (send: (event: StreamEvent) => void, signal: AbortSignal) => Promise<void>) {
  const encoder = new TextEncoder();
  const abortController = new AbortController();
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: StreamEvent) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      void run(send, abortController.signal).finally(() => controller.close());
    },
    cancel() { abortController.abort(); },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
