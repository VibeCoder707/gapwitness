import { randomUUID } from "node:crypto";
import { logRun } from "@/lib/logging";
import { runAnalysis } from "@/lib/openai-workflow";
import { analyzeInputSchema } from "@/lib/schemas";
import { eventStream } from "@/lib/stream";
import { beginGuard, boundedJson, withinRateWindow } from "@/lib/request-guard";

export const runtime = "nodejs";
export const maxDuration = 180;

export async function POST(request: Request) {
  const parsed = analyzeInputSchema.safeParse(await boundedJson(request).catch(() => null));
  if (!parsed.success) return Response.json({ error: "Only the guided seat-limit scenario is accepted." }, { status: 400 });
  const liveConfigured = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_FIXTURE_FILE_ID) && process.env.GAPWITNESS_DEMO_MODE !== "replay";
  if (liveConfigured && !withinRateWindow("paid-analysis", 10, 60_000)) return Response.json({ error: "The live demo budget guard is active. Try again in one minute or use the bundled reference replay." }, { status: 429 });
  const finishGuard = beginGuard("analysis:seat-limit-race", 180_000);
  if (!finishGuard) return Response.json({ error: "An analysis is already starting. Wait a few seconds before retrying." }, { status: 429 });
  const requestId = randomUUID();
  const startedAt = Date.now();
  return eventStream(async (send, signal) => {
    let succeeded = false;
    try {
      send({ type: "stage", stage: "start", label: "Starting evidence analysis" });
      const forceReplay = request.headers.get("x-gapwitness-replay") === "1";
      const result = await runAnalysis(requestId, (stage, label) => send({ type: "stage", stage, label }), forceReplay, signal);
      send({ type: "result", result });
      succeeded = true;
      logRun({ requestId, stage: "analysis_complete", startedAt, toolCount: result.usage.toolCalls, cachedTokens: result.usage.cachedTokens });
    } catch (error) {
      logRun({ requestId, stage: "analysis_error", startedAt, errorCategory: error instanceof Error ? error.name : "unknown" });
      send({ type: "error", code: "analysis_unavailable", message: "Live analysis could not finish. Retry or use the clearly labeled bundled reference replay.", retryable: true });
    } finally {
      finishGuard(succeeded);
    }
  });
}
