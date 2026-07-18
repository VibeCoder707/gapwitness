export function logRun(entry: { requestId: string; stage: string; startedAt: number; toolCount?: number; errorCategory?: string; cachedTokens?: number }) {
  console.info(JSON.stringify({
    event: "gapwitness_run", requestId: entry.requestId, stage: entry.stage,
    latencyMs: Date.now() - entry.startedAt, toolCount: entry.toolCount ?? 0,
    cachedTokens: entry.cachedTokens ?? 0, errorCategory: entry.errorCategory ?? null,
  }));
}
