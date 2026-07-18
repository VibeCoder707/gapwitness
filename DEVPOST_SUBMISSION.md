# Devpost submission draft

## Title

GapWitness

## Tagline

Turn passing tests into inspectable requirement proof, then execute the weakest claim.

## Category

Developer Tools

## Description

AI-generated pull requests can look complete before their written requirements are actually proven. GapWitness is a no-login verification bench for engineering leads and reviewers. It maps each acceptance criterion to exact source and test evidence, validates every file-and-line citation against an immutable server copy, and identifies the weakest proof.

The guided TypeScript fixture contains a workspace seat-limit change. All 18 baseline Vitest checks pass. R1 and R2 have focused implementation and test evidence, but R3 promises safety under concurrent requests without any overlapping test or atomic operation. GapWitness continues the same GPT‑5.6 Sol reasoning trace and OpenAI-hosted container, generates a deterministic two-arrival barrier test, runs it, and confirms the defect: both requests succeed and the workspace reaches two seats although its limit is one.

The live workflow uses GPT‑5.6 Sol at high reasoning effort, Programmatic Tool Calling, an OpenAI-hosted shell with networking disabled, explicit prompt caching, structured outputs, and `previous_response_id` with `reasoning.context: "all_turns"`. The server derives the baseline, exact generated file, and counterexample status from actual shell-call output rather than model prose. If live access is unavailable, the production build can show a sanitized replay of its last verified live run, explicitly labeled as not new; an unconfigured local build uses a separate bundled reference replay.

Codex accelerated the fixture, API workflow, deterministic validation, interface implementation, accessibility and responsive repair, tests, and documentation. The entrant chose the problem, acceptance criteria, deliberate race, safety boundaries, Verification Bench direction, replay honesty policy, and release decisions.

## How to test

1. Open the public live URL with no account.
2. Select **Analyze the change**.
3. Confirm the baseline shows 18 passed and 0 failed.
4. Inspect R1 and R2 evidence, then select an exact file-and-line reference.
5. Confirm R3 is marked unsupported because the count and insert are separate and no baseline check overlaps requests.
6. Select **Generate falsifying test**.
7. Confirm the hosted shell reports `GAPWITNESS_RESULT fulfilled=2 rejected=0 active=2` and the counterexample is confirmed.

If the interface says **Bundled reference replay · not a live run**, the live API is unavailable; that path demonstrates the interface but must not be counted as the required live GPT‑5.6 verification.

## URLs to complete

- Live demo: `PENDING`
- Public repository: `PENDING`
- Public YouTube demo: `PENDING`
- `/feedback` Session ID: `PENDING`
