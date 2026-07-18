# GapWitness Design System

## Direction

Verification Bench: a light, paper-like technical workspace used by an engineering lead on a large monitor in daylight before a release. The visual anchors are Linear's navigation speed, Stripe's explanatory hierarchy, and GitHub's familiar code evidence, without copying their branding.

## Color

Use OKLCH tokens. Warm tinted near-white surfaces and graphite text dominate. Semantic green, amber, red, and blue appear only for supported, partial, unsupported, active, and informational states. Never use pure black or white, gradients, glass effects, or color as the sole status signal.

## Typography

Use a system sans stack for interface text and a system monospace stack for code. Keep a compact fixed scale, strong weight contrast, readable prose under 72 characters, and dense code/data where the task requires it.

## Layout

- Compact top bar and five-stage progress strip.
- Desktop split: proof graph at roughly two-thirds width, verification bench at one-third.
- Exact-source evidence drawer spans the bottom.
- Tablet stacks the bench beneath the graph; mobile presents a linear evidence ledger.
- Prefer continuous work surfaces and dividers over nested cards.

## Components

Buttons, evidence nodes, status pills, progress steps, code blocks, evidence links, collapsible source drawer, skeletons, inline errors, and a run-details disclosure. Every interactive component needs default, hover, focus-visible, active, disabled, and loading states.

## Motion

Use 160–220ms ease-out transitions only to communicate state. Stream progress and reveal graph connections without blocking interaction. Respect `prefers-reduced-motion` and never animate layout properties.

## Approved Content

One guided seat-limit sample: 18 passing baseline tests, three requirements, one concurrency proof gap, a generated falsifying test, real failing output, exact file-and-line evidence, and transparent token/cache usage.
