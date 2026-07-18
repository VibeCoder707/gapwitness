import { createHmac, timingSafeEqual } from "node:crypto";
import type { ContinuationClaims } from "./types";

const fallbackSecret = "gapwitness-local-replay-secret-change-in-production";

function secret() {
  const value = process.env.DEMO_SIGNING_SECRET ?? fallbackSecret;
  const publicOrLive = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL) || Boolean(process.env.OPENAI_API_KEY);
  if (publicOrLive && value === fallbackSecret) throw new Error("DEMO_SIGNING_SECRET is required");
  return value;
}

function encode(value: string) {
  return Buffer.from(value).toString("base64url");
}

export function signContinuation(claims: ContinuationClaims) {
  const payload = encode(JSON.stringify(claims));
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyContinuation(token: string): ContinuationClaims {
  const parts = token.split(".");
  if (parts.length !== 2) throw new Error("Malformed continuation token");
  const [payload, supplied] = parts;
  if (!payload || !supplied || payload.length > 3000 || supplied.length > 128) throw new Error("Malformed continuation token");
  const expected = createHmac("sha256", secret()).update(payload).digest();
  const actual = Buffer.from(supplied, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error("Invalid continuation token");
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as ContinuationClaims;
  if (claims.scenario !== SCENARIO_ID_VALUE) throw new Error("Scenario is not allowlisted");
  if (typeof claims.responseId !== "string" || claims.responseId.length < 3 || claims.responseId.length > 240) throw new Error("Invalid response claim");
  if (typeof claims.containerId !== "string" || claims.containerId.length < 3 || claims.containerId.length > 240) throw new Error("Invalid container claim");
  if (!Number.isFinite(claims.exp) || claims.exp <= Date.now()) throw new Error("Continuation token expired");
  if (claims.exp > Date.now() + 30 * 60_000 + 5_000) throw new Error("Continuation lifetime is too long");
  if (claims.mode !== "live" && claims.mode !== "replay") throw new Error("Invalid run mode");
  return claims;
}

const SCENARIO_ID_VALUE = "seat-limit-race";
