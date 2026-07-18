import { readFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import type { EvidenceRef } from "./types";

export const SCENARIO_ID = "seat-limit-race" as const;
export const FIXTURE_ROOT = path.join(process.cwd(), "fixtures", SCENARIO_ID);

const allowedPaths = new Set([
  "ISSUE.md",
  "package.json",
  "package-lock.json",
  "ci-report.json",
  "change.diff",
  "artifact-manifest.json",
  "src/seat-service.ts",
  "tests/seat-service.test.ts",
  "counterexample/seat-service.concurrent.test.ts",
]);

type Manifest = { immutableEvidence: Array<{ path: string; lines: number; sha256: string }> };
let integrityCheck: Promise<void> | undefined;

export function assertFixtureIntegrity() {
  integrityCheck ??= (async () => {
    const manifest = JSON.parse(await readFile(path.join(FIXTURE_ROOT, "artifact-manifest.json"), "utf8")) as Manifest;
    for (const item of manifest.immutableEvidence) {
      if (!allowedPaths.has(item.path)) throw new Error(`Manifest path is not allowlisted: ${item.path}`);
      const content = await readFile(path.join(FIXTURE_ROOT, item.path));
      const hash = createHash("sha256").update(content).digest("hex");
      const lines = content.toString("utf8").split("\n").length - 1;
      if (hash !== item.sha256 || lines !== item.lines) throw new Error(`Fixture integrity check failed: ${item.path}`);
    }
  })();
  return integrityCheck;
}

export async function readFixtureFile(relativePath: string) {
  if (!allowedPaths.has(relativePath)) throw new Error("Evidence path is not allowlisted");
  return readFile(path.join(FIXTURE_ROOT, relativePath), "utf8");
}

export async function validateEvidence(ref: Omit<EvidenceRef, "verified"> | EvidenceRef): Promise<EvidenceRef> {
  try {
    await assertFixtureIntegrity();
    const content = await readFixtureFile(ref.path);
    const lines = content.replace(/\r\n/g, "\n").split("\n");
    const validRange = ref.startLine > 0 && ref.endLine >= ref.startLine && ref.endLine <= lines.length;
    const actual = validRange ? lines.slice(ref.startLine - 1, ref.endLine).join("\n") : "";
    return { ...ref, verified: validRange && actual === ref.excerpt.replace(/\r\n/g, "\n") };
  } catch {
    return { ...ref, verified: false };
  }
}

export async function validateEvidenceList(refs: Array<Omit<EvidenceRef, "verified"> | EvidenceRef>) {
  return Promise.all(refs.map(validateEvidence));
}

export async function fixturePromptPayload() {
  await assertFixtureIntegrity();
  const paths = ["ISSUE.md", "src/seat-service.ts", "tests/seat-service.test.ts", "ci-report.json"];
  const entries = await Promise.all(paths.map(async (file) => `--- ${file} ---\n${await readFixtureFile(file)}`));
  return entries.join("\n\n");
}
