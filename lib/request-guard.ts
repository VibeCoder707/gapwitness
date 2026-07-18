const globalForGuards = globalThis as typeof globalThis & { gapwitnessGuards?: Map<string, number> };
const guards = globalForGuards.gapwitnessGuards ?? new Map<string, number>();
globalForGuards.gapwitnessGuards = guards;

export function beginGuard(key: string, cooldownMs: number) {
  const now = Date.now();
  for (const [storedKey, expiry] of guards) if (expiry <= now) guards.delete(storedKey);
  if ((guards.get(key) ?? 0) > now) return null;
  guards.set(key, now + cooldownMs);
  return (succeeded: boolean) => { void succeeded; guards.delete(key); };
}

const globalForWindows = globalThis as typeof globalThis & { gapwitnessWindows?: Map<string, number[]> };
const windows = globalForWindows.gapwitnessWindows ?? new Map<string, number[]>();
globalForWindows.gapwitnessWindows = windows;

export function withinRateWindow(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const recent = (windows.get(key) ?? []).filter((timestamp) => timestamp > now - windowMs);
  if (recent.length >= limit) return false;
  recent.push(now);
  windows.set(key, recent);
  return true;
}

export async function boundedJson(request: Request, maxBytes = 4096) {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new Error("Request body is too large");
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes) throw new Error("Request body is too large");
  return JSON.parse(text) as unknown;
}
