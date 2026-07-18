# OpenAI Build Week submission checklist

Internal cutoff: **July 21, 2026 at 18:00 CEST**. Official rules deadline: **July 21, 2026 at 5:00 PM Pacific**. The attached official rules are the compliance baseline; record live-site differences below rather than silently replacing them.

## Eligibility and ownership

- [x] Solo entrant eligibility, legal majority, supported residence, and absence of prohibited conflicts confirmed by the entrant’s stated assumptions.
- [x] Current code and sample data are owned or properly licensed; recheck final narration, screenshots, and video before submission.
- [x] Repository history shows creation during the July 13–21 submission period.

## Product readiness

- [ ] Before final judging, enable the approved live window and confirm production `/api/health` reports `liveReady: true`; it currently reports `replay_only` by deliberate cost control.
- [ ] Five consecutive production runs locate R3, validate every citation, and confirm the counterexample.
- [ ] The five-run gate has captured a last-verified replay and it is unmistakably labeled as not new.
- [x] Automated keyboard, reduced-motion, WCAG A/AA, Chromium, Firefox, WebKit, desktop, tablet, and mobile checks pass.
- [ ] Manual screen-reader and signed-out checks pass in released Chrome, Safari, Firefox, and Edge.
- [ ] OpenAI project budget is capped at $25 through August 9.
- [ ] Vercel deployment will remain public through at least August 10 at 02:00 CEST.

## Repository

- [x] Public MIT repository URL added to README and Devpost.
- [x] Live demo URL added prominently to README and the Devpost draft.
- [ ] Clean install, test, and deployment instructions verified from a fresh checkout.
- [x] `THIRD_PARTY_NOTICES.md`, `DECISIONS.md`, and dated commits checked.
- [ ] Run `/feedback` in primary task `019f72a8-0ee4-7041-8b20-9e65108f671f` and record the returned Session ID: `PENDING`.

## Video — public YouTube, target 2:40–2:50

- [ ] Entrant’s own English voiceover covers the product, Codex, and GPT‑5.6.
- [ ] Shows 18 passing checks, R3 gap, generated test, real hosted-shell failure, and exact evidence.
- [ ] Explains Programmatic Tool Calling, caching, reasoning continuity, and server validation.
- [ ] Distinguishes entrant decisions from Codex acceleration.
- [ ] No copyrighted music, unauthorized trademarks, third-party logos, secrets, or misleading replay.
- [ ] Public YouTube URL opens in a signed-out window.

## Devpost

- [ ] Developer Tools category selected.
- [ ] English title and description complete.
- [ ] Public live demo, repository, YouTube, and testing instructions entered.
- [ ] `/feedback` Session ID entered.
- [ ] Every link tested signed out.
- [ ] Submitted by internal cutoff and proof of receipt retained.

## Live-site discrepancy log

- Observed on **July 18, 2026**: the attached and live rules list judging from July 22 at 10:00 AM Pacific through August 5 at 5:00 PM Pacific.
- Observed on **July 18, 2026**: the live schedule instead lists judging from July 22 at 9:00 AM Pacific through August 9 at 5:00 PM Pacific, with winners announced August 12 at 2:00 PM Pacific.
- Operational availability therefore uses the later endpoint: keep the demo online through at least **August 10 at 02:00 CEST**.
- Recheck [live rules](https://openai.devpost.com/rules) and [dates](https://openai.devpost.com/details/dates) immediately before submission and record timestamped screenshots.
