# AGENTS.md

agent-report-kit is a personal SvelteKit renderer that compiles a `report.json` into one self-contained HTML report page, for AI agents that produce review and decision pages.

## Commands

```bash
mise install                 # set up the toolchain (node, pnpm, oxlint, prek, cocogitto)
pnpm install                 # install dependencies
pnpm dev                     # dev server; /styleguide renders every component
pnpm build                   # production build into build/index.html
node tools/build.ts <report.json> <out.html>   # validate + compile + inject, from any cwd
node tools/serve.ts start <dir>              # start a local session from report.json
mise run lint                # oxlint only
mise run typecheck           # svelte-check only
mise run format              # oxfmt, rewrites in place
mise run check               # full validation — run before every commit
```

Verification is `mise run check`, `pnpm test`, and a build/browser smoke run (see DEVELOPMENT.md). `pnpm exec svelte-kit sync` once per fresh clone before `pnpm check`.

## Engineering Standards

This project follows the shared engineering guidelines:

> https://github.com/fang2hou/ai-coding-guidelines/blob/main/PORTAL.md

Read the portal's reading recipes for your task type before starting.
Repository documentation always takes precedence over remembered summaries.

Project-specific overrides:

- None. This repository follows the shared standards.

## Layout

- `src/` — the renderer: `src/lib/components/` (Block, Review, Chat, Toc, Scroller), `src/lib/schema.ts` (zod contract), `src/app.css` (Tailwind v4 theme tokens), `src/lib/diagrams/` (Mermaid sources and rendered SVG for the demo), `src/routes/` (page shell and the `/styleguide` demo).
- `docs/` — the authoring contract and guides consumed by downstream skills: report-schema.md, components.md, typography.md.
- `tools/` — build.ts and validate.ts (compile pipeline), diagram.ts (Mermaid → themed SVG via Pele), serve.ts (SvelteKit lifecycle/API client).
- `build/` — build output; only `index.html` matters.

## Boundaries

Always:

- Run `mise run check` before every commit
- Keep each change minimal and scoped to the request
- Update `docs/report-schema.md` in the same commit whenever `src/lib/schema.ts` changes

Never:

- Add CDN scripts, web fonts, or remote images — pages must work fully offline
- Break the single-file output: everything the page needs is inlined in `index.html`
- Edit `.svelte-kit/` or `build/` by hand

Ask first:

- New dependencies
- Changes to the invariants in ARCHITECTURE.md
- Removing or redesigning the report.json contract fields other repos consume

## Confirmed Language Policy

| Item                      | Value                                                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Conversation              | Follows the user                                                                                                         |
| Code / comments / commits | English                                                                                                                  |
| UI language               | Multilingual chrome: `zh-CN`, `ja`, `en`, selected by the report's `lang` field; all visible text in the page follows it |
| Tone                      | Technical, plain, no filler                                                                                              |

Do not infer UI language from conversation language.

## Project Conventions

- The renderer owns the look: theme tokens live in `src/app.css` (`@theme` static, `:lang` runtime); style changes never leak into report JSON or consumer skills.
- Utilities for markup-owned styles; `@layer base` for report-content element defaults (content comes from JSON and cannot take classes); `@layer components` only for nodes injected by runtime chat code and the global `.chip` classes.
- Svelte 5 runes only; run `svelte-autofixer` on every component you touch.
- The consumer contract: skills clone this repo, write `report.json`, and run `tools/build.ts` + `tools/serve.ts`. Never assume the skill directory carries template content.

Depth: [DEVELOPMENT.md](./DEVELOPMENT.md) for workflow and toolchain, [CONTRIBUTING.md](./CONTRIBUTING.md) for PR rules, [ARCHITECTURE.md](./ARCHITECTURE.md) for invariants.
