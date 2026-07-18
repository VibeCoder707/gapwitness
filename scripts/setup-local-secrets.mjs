import { chmod, readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";

if (!process.stdin.isTTY) throw new Error("Run this command in an interactive Terminal so the API key can remain hidden.");

function hiddenPrompt(label) {
  return new Promise((resolve, reject) => {
    let value = "";
    const input = process.stdin;
    const previousRawMode = input.isRaw;
    const finish = (error) => {
      input.off("data", onData);
      input.setRawMode(previousRawMode ?? false);
      input.pause();
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(value.replace(/\u001b\[20[01]~/g, "").trim());
    };
    const onData = (chunk) => {
      for (const character of String(chunk)) {
        if (character === "\u0003") return finish(new Error("Setup cancelled."));
        if (character === "\r" || character === "\n") return finish();
        if (character === "\u007f") value = value.slice(0, -1);
        else value += character;
      }
    };
    process.stdout.write(label);
    input.setEncoding("utf8");
    input.setRawMode(true);
    input.resume();
    input.on("data", onData);
  });
}

function existingValue(source, name) {
  return source.match(new RegExp(`^${name}=(.*)$`, "m"))?.[1] ?? "";
}

const apiKey = await hiddenPrompt("Paste your OpenAI API key, then press Return (it will stay hidden): ");
if (!/^sk-[A-Za-z0-9_-]{20,}$/.test(apiKey)) throw new Error("That does not look like a complete OpenAI API key. Nothing was saved.");

const destination = path.join(process.cwd(), ".env.local");
const existing = await readFile(destination, "utf8").catch(() => "");
const signingSecret = randomBytes(48).toString("base64url");
const contents = [
  `OPENAI_API_KEY=${apiKey}`,
  `OPENAI_FIXTURE_FILE_ID=${existingValue(existing, "OPENAI_FIXTURE_FILE_ID")}`,
  `DEMO_SIGNING_SECRET=${signingSecret}`,
  `GAPWITNESS_DEMO_MODE=${existingValue(existing, "GAPWITNESS_DEMO_MODE")}`,
  `NEXT_PUBLIC_REPOSITORY_URL=${existingValue(existing, "NEXT_PUBLIC_REPOSITORY_URL")}`,
  "",
].join("\n");

await writeFile(destination, contents, { encoding: "utf8", mode: 0o600 });
await chmod(destination, 0o600);
console.info("Saved .env.local with the API key and a newly generated signing secret. Neither secret was displayed.");
