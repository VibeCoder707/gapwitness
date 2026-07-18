# GapWitness release status

Last updated: **July 18, 2026 (CEST)**.

## Proven locally

- Optimized Next.js production build completes successfully.
- Lint and TypeScript checks pass without warnings.
- 46 unit and integration checks pass across schemas, immutable evidence, signed continuations, health reporting, request guards, streaming, replay, usage accounting, and mocked Responses workflows.
- The owned fixture passes all 18 baseline checks.
- The deterministic barrier counterexample exits non-zero with `GAPWITNESS_RESULT fulfilled=2 rejected=0 active=2`.
- 35 browser journeys pass across Chromium, Firefox, WebKit, tablet, and mobile projects. They cover the judge flow, keyboard traversal, responsive layout, WCAG A/AA automation, reduced motion, budget exhaustion with replay recovery, and a slow response.
- The optimized production server passes the replay smoke journey through `/api/health`, `/api/analyze`, signed continuation, and `/api/verify`.
- The production dependency audit reports zero known vulnerabilities.
- The self-contained fixture archive runs its 18-check baseline and deterministic counterexample with networking unavailable and no package installation.

## Release automation ready

- `npm run fixture:bundle` creates the offline hosted-shell fixture.
- `npm run smoke:replay -- https://host` validates deployment health and the replay journey.
- `npm run gate:production -- https://host` requires five live runs, valid exact evidence, R3 selection, a confirmed shell-derived counterexample, and a sub-three-minute duration for every run.
- A passing production gate writes a sanitized `artifacts/production-gate.json` and `fixtures/replay/last-verified-run.json`. It deliberately excludes continuation tokens and OpenAI response, request, and container identifiers.

## External release evidence still required

- Configure the OpenAI API key, uploaded fixture file ID, and signing secret.
- Complete at least one real GPT‑5.6 Sol analysis and verification locally, then the five-run gate against production.
- Restore GitHub authentication, publish the repository, and add its URL.
- Authenticate Vercel, deploy, set the $25 OpenAI project budget, and add the live URL.
- Perform signed-out manual checks in released Chrome, Safari, Firefox, and Edge plus a screen-reader pass.
- Run the primary task’s `/feedback` flow and record the returned Session ID.
- Record and publish the entrant-narrated video, complete Devpost, verify all links, submit, and retain the receipt.
