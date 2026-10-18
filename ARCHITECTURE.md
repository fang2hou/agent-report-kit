# Architecture

This document orients contributors and keeps the design from drifting — especially when AI agents make broad changes. Keep it short and stable: name the main modules and boundaries without listing individual files. Revisit it when the architecture changes, not on routine edits.

## Overview

agent-report-kit renders `report.json` as a temporary local decision website and exports it as standalone HTML or PDF. Both modes use the same Svelte components, schema, theme, and localized chrome. One SvelteKit Node process serves the interactive page and its state APIs. Consumers carry no template content: they write JSON and call the kit's commands.

## Codebase Map

- renderer — shared ReportPage, Block, Review, Chat, Toc, and Scroller components; navigation allocates unique section and question anchors
- schema — the zod contract for `report.json`; the authority for every field
- theme — Tailwind v4 tokens in `src/app.css`: static `@theme` design tokens, runtime `:lang` font and metric variables
- compile pipeline — `tools/build.ts` and `tools/validate.ts`: validate, prerender, inject data, emit one file; `tools/diagram.ts`: render Mermaid sources to themed SVG (Pele) at authoring time
- session — `src/session/` SvelteKit routes and hooks, backed by `src/lib/server/`; the service is the only state writer
- CLI — `tools/serve.ts` starts/closes the SvelteKit process and accesses its API; `tools/pdf.ts` prints an HTML export with an installed browser
- docs — the authoring contract and guides (`docs/`), consumed by downstream skills in-place

## Invariants

What must remain true about the architecture:

- **Standalone export**: exported HTML inlines all CSS, JS, and data, makes no API requests, and works offline or on static HTTP hosting. Export routes use the hash router; session routes use pathname routing. PDF derives from the same HTML and print styles.
- **Contract authority**: `src/lib/schema.ts` is the only authority for the report.json contract; `docs/report-schema.md` mirrors it and must change in the same commit.
- **Renderer owns the look**: theme, components, default buttons, and chrome strings live in this repo; consumers never carry template content or override styles per page.
- **Content direction**: report data flows one way — JSON in, page out. The session loads JSON through SvelteKit and reloads when it changes; answers and discussion never mutate the report. Exports read their embedded JSON.
- **Round trip is optional**: the page degrades gracefully when no server is present (answers stay in localStorage; chat hides).
- **Size budget**: content included, the page stays under the budget documented in `docs/report-schema.md`.
- **One writer**: all answer, event, and message writes go through the SvelteKit service. CLI replies never modify state files directly. Message keys make reply retries idempotent; event acknowledgement follows handling.
- **Temporary ownership**: agent polling renews a bounded lease; browser activity does not. An explicit close, owner process exit, or expired lease closes the service and removes contact metadata, preserving collected content and state.

## Cross-Cutting Concerns

- Localization: every UI string comes from per-language `STRINGS` maps; adding a language means renderer changes only (see `docs/typography.md`).
- Trusted rich text: content fields accept a small HTML subset from a trusted author; never extend it for untrusted input.
