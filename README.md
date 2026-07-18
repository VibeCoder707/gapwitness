# GapWitness

GapWitness is an evidence-backed validation bench for AI-generated code. It maps written acceptance criteria to exact source and test evidence, finds the weakest proof, then generates and runs a deterministic counterexample.

The guided fixture looks reassuring: all 18 baseline tests pass. GapWitness shows that the concurrency guarantee is still unproven, then uses a two-arrival barrier to make the race fail every time.

> Live demo: `PENDING — add the production Vercel URL before submission.` The final URL must require no login or rebuild.

## Judge flow

1. Open the live demo and select **Analyze the change**.
2. Confirm the hosted baseline reports 18 passing checks.
3. Inspect the exact file-and-line proof for R1 and R2 and the R3 proof gap.
4. Select **Generate falsifying test**.
5. Inspect the generated Vitest test and hosted shell failure: both requests succeed although only one should.

The full flow is designed to finish in under three minutes. After the production reliability gate, API outages use a sanitized replay of the last verified live run. Until that artifact exists, local and unconfigured deployments use a clearly labeled bundled reference replay. Neither path is presented as a new live run.

## Local setup

Requirements: Node.js 20.9 or later and npm.

```bash
npm install
npm run setup:secrets
npm run dev
```

The setup command accepts the API key through a hidden Terminal prompt, creates `.env.local` with private file permissions, and generates the signing secret. Open `http://localhost:3000`. Until the fixture file ID is added, the app intentionally uses its bundled reference replay.

Environment variables:

- `OPENAI_API_KEY`: server-side API key.
- `OPENAI_FIXTURE_FILE_ID`: OpenAI Files API ID for a zip of `fixtures/seat-limit-race`.
- `DEMO_SIGNING_SECRET`: at least 32 random characters for 30-minute continuation tokens.
- `GAPWITNESS_DEMO_MODE=replay`: optional explicit replay-only mode.

No secret is exposed to the browser. The API accepts no uploads, URLs, repositories, prompts, credentials, or arbitrary commands.

## Architecture

The Next.js server owns the OpenAI call, evidence validator, continuation signer, and immutable fixture. `/api/analyze` asks `gpt-5.6-sol` at high reasoning effort to inspect the fixed fixture with Programmatic Tool Calling and the OpenAI-hosted shell. The server then verifies each claimed path, line range, and excerpt against its own copy. `/api/verify` uses `previous_response_id`, `reasoning.context: "all_turns"`, and the same hosted container to generate and execute the barrier test.

The stable instructions and fixture use explicit prompt caching under `gapwitness:seat-limit-race:v1`. Cache reads, cache writes, and tool-call counts appear in Run details. If Programmatic Tool Calling cannot begin, analysis retries with direct hosted-shell access under the same bounded schema.

## Commands

```bash
npm run lint
npm run typecheck
npm test
npm run test:fixture
npm run test:counterexample  # expected to exit 1 and expose two successes
npm run test:e2e
npm run build
```

## Deployment

1. Run `npm run fixture:bundle`. Upload `dist/seat-limit-race.zip` to the OpenAI Files API and retain its file ID. The bundle includes its locked Vitest runtime so the hosted container can keep networking disabled.
   For the guided setup, `npm run fixture:upload` performs the upload with the stored API key and saves the returned file ID privately.
2. Import this repository into Vercel.
3. Add the three required environment variables as Vercel secrets.
4. Deploy, then confirm `/api/health` reports `liveReady: true` without revealing identifiers.
5. Run `npm run gate:production -- https://your-production-host`. This performs five complete live passes, rejects any invalid evidence or run lasting three minutes or more, and writes sanitized proof to `artifacts/production-gate.json`.
6. Review and commit `fixtures/replay/last-verified-run.json`, redeploy, and confirm an intentionally forced replay says **Replay of last verified run · not a new live run**. The artifact excludes continuation tokens, request IDs, response IDs, and container IDs.

Set the OpenAI project budget to **$25 through August 9, 2026** in the project settings. Keep the public deployment available through at least August 10 at 02:00 CEST.

## Built with Codex and GPT‑5.6

Codex accelerated the repository setup, fixture implementation, API schemas, evidence validator, signed continuation flow, tests, interface implementation, and review-repair loop. GPT‑5.6 Sol supplies the live semantic requirement mapping, Programmatic Tool Calling orchestration, hosted-shell inspection and test execution, and continuation-aware counterexample generation.

The entrant owned the problem selection, name, single-fixture scope, acceptance criteria, deliberate race design, Verification Bench direction, safety limits, replay honesty policy, release timing, and final product and submission decisions. The generated UI was used only as a directional probe; the shipped interface is semantic HTML and CSS.

Primary Codex project task ID: `019f72a8-0ee4-7041-8b20-9e65108f671f`. Before submission, run `/feedback` in that primary task and record the returned Session ID separately; do not assume the task ID is the required feedback ID.

## Supported platforms and accessibility

The app targets current Chrome, Safari, Firefox, and Edge on desktop and tablet. Automated judge-flow coverage runs Chromium, Firefox, and WebKit at desktop size plus Chromium at tablet and mobile widths. A final signed-out check in the released Chrome, Safari, Firefox, and Edge builds remains part of the production release gate. The interface provides semantic landmarks, keyboard operation, visible focus, screen-reader progress announcements, non-color status marks, responsive stacking, and reduced-motion behavior. Automated Axe checks cover WCAG A and AA rules, with WCAG 2.2 AA as the release target.

## License and attribution

GapWitness is MIT licensed. Runtime dependencies are Next.js, React, the official OpenAI JavaScript SDK, and Zod; development uses TypeScript, Vitest, ESLint, and Playwright. Their licenses are recorded in `THIRD_PARTY_NOTICES.md`.
