import { createReadStream } from "node:fs";
import { access, chmod, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";

const root = process.cwd();
const envPath = path.join(root, ".env.local");
const fixturePath = path.join(root, "dist", "seat-limit-race.zip");
const source = await readFile(envPath, "utf8").catch(() => "");
const value = (name) => source.match(new RegExp(`^${name}=(.*)$`, "m"))?.[1] ?? "";
const apiKey = value("OPENAI_API_KEY");
const existingFileId = value("OPENAI_FIXTURE_FILE_ID");

if (!/^sk-[A-Za-z0-9_-]{20,}$/.test(apiKey)) throw new Error("The private OpenAI API key is missing or incomplete. Run npm run setup:secrets first.");
if (existingFileId) {
  console.info("The fixture file ID is already configured. No upload was performed.");
  process.exit(0);
}
await access(fixturePath).catch(() => { throw new Error("The fixture bundle is missing. Run npm run fixture:bundle first."); });

console.info("Uploading the fixed GapWitness sample to the OpenAI project…");
const client = new OpenAI({ apiKey });
const uploaded = await client.files.create({ file: createReadStream(fixturePath), purpose: "user_data" });
if (!/^file-[A-Za-z0-9_-]+$/.test(uploaded.id)) throw new Error("OpenAI did not return a valid fixture file ID.");

const updated = source.replace(/^OPENAI_FIXTURE_FILE_ID=.*$/m, `OPENAI_FIXTURE_FILE_ID=${uploaded.id}`);
await writeFile(envPath, updated, { encoding: "utf8", mode: 0o600 });
await chmod(envPath, 0o600);
console.info("Upload complete. The fixture file ID was saved privately in .env.local and was not displayed.");
