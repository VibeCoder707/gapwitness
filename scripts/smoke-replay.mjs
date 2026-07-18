const baseUrl = (process.argv[2] ?? "http://localhost:3200").replace(/\/$/, "");

async function resultFromSse(response) {
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  const events = (await response.text()).split("\n\n").flatMap((block) => {
    const line = block.split("\n").find((item) => item.startsWith("data: "));
    return line ? [JSON.parse(line.slice(6))] : [];
  });
  const error = events.find((event) => event.type === "error");
  if (error) throw new Error(error.message);
  const result = events.findLast((event) => event.type === "result")?.result;
  if (!result) throw new Error("Stream completed without a result");
  return result;
}

const healthResponse = await fetch(`${baseUrl}/api/health`);
const health = await healthResponse.json();
if (!healthResponse.ok || health.replayReady !== true) throw new Error("Deployment is not replay-ready");

const analysis = await resultFromSse(await fetch(`${baseUrl}/api/analyze`, {
  method: "POST", headers: { "content-type": "application/json", "x-gapwitness-replay": "1" },
  body: JSON.stringify({ scenarioId: "seat-limit-race" }),
}));
if (analysis.mode !== "replay" || analysis.baseline.passed !== 18 || analysis.selectedGap !== "R3") throw new Error("Replay analysis smoke check failed");

const verification = await resultFromSse(await fetch(`${baseUrl}/api/verify`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ continuationToken: analysis.continuationToken, requirementId: "R3" }),
}));
if (verification.mode !== "replay" || verification.status !== "counterexample_confirmed" || !verification.stdout.includes("GAPWITNESS_RESULT fulfilled=2 rejected=0 active=2")) {
  throw new Error("Replay verification smoke check failed");
}

console.info(JSON.stringify({ status: "passed", health: health.status, replayKind: analysis.replay?.kind, baseline: analysis.baseline.passed, gap: analysis.selectedGap, counterexample: verification.status }));
