import { randomUUID } from "node:crypto";
import { logRun } from "@/lib/logging";
import { runVerification } from "@/lib/openai-workflow";
import { verifyInputSchema } from "@/lib/schemas";
import { eventStream } from "@/lib/stream";
import { verifyContinuation } from "@/lib/tokens";
import { createHash } from "node:crypto";
import { beginGuard, boundedJson, withinRateWindow } from "@/lib/request-guard";

export const runtime = "nodejs";
export const maxDuration = 180;

export async function POST(request: Request) {
  const parsed = verifyInputSchema.safeParse(await boundedJson(request).catch(() => null));
  if (!parsed.success) return Response.json({ error: "A valid R3 continuation is required." }, { status: 400 });
  let claims;
  try { claims = verifyContinuation(parsed.data.continuationToken); }
  catch { return Response.json({ error: "This analysis continuation is invalid or expired." }, { status: 401 }); }
  const liveConfigured = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_FIXTURE_FILE_ID) && process.env.GAPWITNESS_DEMO_MODE !== "replay";
  if (liveConfigured && !withinRateWindow("paid-verification", 10, 60_000)) return Response.json({ error: "The live verification budget guard is active. Try again in one minute." }, { status: 429 });
  const tokenKey = createHash("sha256").update(parsed.data.continuationToken).digest("hex").slice(0, 20);
  const finishGuard = beginGuard(`verify:${tokenKey}`, 180_000);
  if (!finishGuard) return Response.json({ error: "This verification is already running or just completed. Start a fresh analysis to run it again." }, { status: 429 });
  const requestId = randomUUID();
  const startedAt = Date.now();
  return eventStream(async (send, signal) => {
    let succeeded = false;
    try {
      const result = await runVerification(claims, requestId, (stage, label) => send({ type: "stage", stage, label }), signal);
      send({ type: "shell", output: result.stdout });
      send({ type: "result", result });
      succeeded = true;
      logRun({ requestId, stage: "verification_complete", startedAt, toolCount: result.usage.toolCalls, cachedTokens: result.usage.cachedTokens });
    } catch (error) {
      logRun({ requestId, stage: "verification_error", startedAt, errorCategory: error instanceof Error ? error.name : "unknown" });
      send({ type: "error", code: "verification_unavailable", message: "The live counterexample did not finish. Retry from a fresh analysis or use the bundled reference replay.", retryable: true });
    } finally {
      finishGuard(succeeded);
    }
  });
}
