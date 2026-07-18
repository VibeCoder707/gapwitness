export const dynamic = "force-dynamic";

export function GET() {
  const publicDeployment = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
  const signingReady = (process.env.DEMO_SIGNING_SECRET?.length ?? 0) >= 32 || !publicDeployment;
  const liveReady = Boolean(process.env.GAPWITNESS_LIVE_ENABLED === "true" && process.env.OPENAI_API_KEY && process.env.OPENAI_FIXTURE_FILE_ID && signingReady && process.env.GAPWITNESS_DEMO_MODE !== "replay");
  return Response.json({
    status: liveReady ? "ready" : signingReady ? "replay_only" : "unconfigured",
    liveReady,
    replayReady: signingReady,
    fixture: "seat-limit-race",
    timestamp: new Date().toISOString(),
  }, { headers: { "Cache-Control": "no-store" } });
}
