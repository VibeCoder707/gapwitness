# GapWitness Agent Guide

## Commands

- `npm run dev`: local app
- `npm run lint`: lint
- `npm run typecheck`: TypeScript validation
- `npm test`: unit and integration tests
- `npm run test:fixture`: prove 18 baseline fixture tests pass
- `npm run test:e2e`: Playwright judge flow
- `npm run build`: production build

## Invariants

- Accept only the bundled `seat-limit-race` scenario; no arbitrary uploads, URLs, prompts, or commands.
- Keep OpenAI credentials server-only.
- Validate every displayed evidence excerpt against the immutable local fixture.
- Label replayed and unverified output explicitly.
- Preserve the approved Verification Bench direction and WCAG 2.2 AA behavior.
- Do not weaken schemas, tests, or required behavior to make checks pass.

## Completion Checks

Run lint, typecheck, unit/integration tests, fixture tests, production build, Playwright, and browser inspection at mobile, tablet, and desktop widths. Record remaining live-API or deployment blockers precisely.

## Submission

Keep the README, demo script, submission checklist, decision log, license, testing instructions, and primary Codex `/feedback` Session ID current.
