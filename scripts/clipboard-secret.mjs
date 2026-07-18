import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

const requested = process.argv[2];
const allowed = new Set(["OPENAI_API_KEY", "OPENAI_FIXTURE_FILE_ID", "DEMO_SIGNING_SECRET"]);

function copy(value) {
  return new Promise((resolve, reject) => {
    const child = spawn("/usr/bin/pbcopy", [], { stdio: ["pipe", "ignore", "inherit"] });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error("The macOS clipboard command failed.")));
    child.stdin.end(value);
  });
}

if (requested === "--clear") {
  await copy("");
  console.info("Clipboard cleared.");
  process.exit(0);
}
if (!allowed.has(requested)) throw new Error(`Choose one of: ${[...allowed].join(", ")}`);

const source = await readFile(path.join(process.cwd(), ".env.local"), "utf8");
const value = source.match(new RegExp(`^${requested}=(.*)$`, "m"))?.[1] ?? "";
if (!value) throw new Error(`${requested} is not configured.`);
await copy(value);
console.info(`${requested} copied privately to the macOS clipboard. Its value was not displayed.`);
