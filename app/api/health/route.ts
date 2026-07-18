export const dynamic = "force-dynamic";

export function GET() {
  const liveReady = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_FIXTURE_FILE_ID && process.env.DEMO_SIGNING_SECRET);
  return Response.json({
    status: liveReady ? "ready" : "replay_only",
    liveReady,
    replayReady: true,
    fixture: "seat-limit-race",
    timestamp: new Date().toISOString(),
  }, { headers: { "Cache-Control": "no-store" } });
}
