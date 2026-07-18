# GapWitness demo script — target 2:45

## 0:00–0:20 — Problem and audience

“AI can make a pull request look complete before its requirements are actually proven. GapWitness is a pre-release verification bench for engineering leads and reviewers. It asks one question: what does this change truly prove?”

## 0:20–0:40 — Green baseline

Open the guided TypeScript seat-limit change. Select **Analyze the change**. Point to the hosted shell baseline: 18 passing tests.

“Everything is green. The change must allow a seat below the limit, reject one at the limit, and stay safe when requests overlap.”

## 0:40–1:20 — Proof graph and gap

Show R1 and R2 as supported. Open one exact source reference and its server-validated match. Then point to R3.

“GapWitness maps each criterion to exact code and test evidence. R1 and R2 have implementation and focused test proof. R3 does not. The count and insert are separate operations, and none of the existing tests overlap requests.”

## 1:20–1:55 — Executable counterexample

Select **Generate falsifying test**. Show the barrier sketch, generated Vitest test, and hosted shell output.

“It continues the same reasoning trace and hosted container. GPT‑5.6 generates a two-arrival barrier so both requests read the available seat before either insert. The test fails deterministically: two successes, zero rejections, and two active seats where the limit is one.”

## 1:55–2:20 — GPT‑5.6 implementation

Open Run details.

“GPT‑5.6 Sol performs the semantic mapping. Programmatic Tool Calling orchestrates the OpenAI-hosted shell. Explicit prompt caching avoids paying repeatedly for the stable fixture, and reasoning continuity preserves the analysis between finding and verifying the gap. Every citation is independently checked by the server.”

## 2:20–2:45 — Codex collaboration

“I chose the problem, fixture, race, safety boundaries, product direction, and release decisions. Codex accelerated the implementation, testing, interface refinement, accessibility review, and repair loop. GapWitness turns ‘the tests pass’ into evidence you can inspect and a claim you can execute.”

Record with the entrant’s own English voice. Use no music, third-party logos, or unlicensed media. Show the live mode label; do not record replay as a new live run.
