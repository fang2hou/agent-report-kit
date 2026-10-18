# Architecture

This document orients contributors and keeps the design from drifting — especially when AI agents make broad changes. Keep it short and stable: name the main modules and boundaries without listing individual files. Revisit it when the architecture changes, not on routine edits.

## Overview

agent-report-kit turns a `report.json` into a single self-contained HTML page. A SvelteKit app defines the component library and chrome; a compile step prerenders it, injects the data, and emits one `index.html` that runs from any delivery channel — static hosting, an attachment, or a locally opened file. An optional local server collects review answers and selection-chat replies from the served page. Consumers (skills such as agent-report) carry no template content — they clone this repo, write JSON, and run the tools.

## Codebase Map

- renderer — SvelteKit routes and the component library: page shell, Block (content blocks), Review (question form), Chat (selection micro-Q&A), Toc (reading-position contents), Scroller (in-page horizontal slider)
- schema — the zod contract for `report.json`; the authority for every field
- theme — Tailwind v4 tokens in `src/app.css`: static `@theme` design tokens, runtime `:lang` font and metric variables
- compile pipeline — `tools/build.ts` and `tools/validate.ts`: validate, prerender, inject data, emit one file; `tools/diagram.ts`: render Mermaid sources to themed SVG (Pele) at authoring time
- server — `tools/serve.ts`: static file serving plus `/api/state` and `/api/chat` for the round trip
- docs — the authoring contract and guides (`docs/`), consumed by downstream skills in-place

## Invariants

What must remain true about the architecture:

- **Single-file output**: the compiled page inlines all CSS, JS, and data; zero network requests at read time; it works offline from every delivery channel, including a locally opened file (hash router).
- **Contract authority**: `src/lib/schema.ts` is the only authority for the report.json contract; `docs/report-schema.md` mirrors it and must change in the same commit.
- **Renderer owns the look**: theme, components, default buttons, and chrome strings live in this repo; consumers never carry template content or override styles per page.
- **Content direction**: report data flows one way — JSON in, page out; the page never mutates the report or re-fetches it.
- **Round trip is optional**: the page degrades gracefully when no server is present (answers stay in localStorage; chat hides).
- **Size budget**: content included, the page stays under the budget documented in `docs/report-schema.md`.

## Cross-Cutting Concerns

- Localization: every UI string comes from per-language `STRINGS` maps; adding a language means renderer changes only (see `docs/typography.md`).
- Trusted rich text: content fields accept a small HTML subset from a trusted author; never extend it for untrusted input.
