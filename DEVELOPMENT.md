# Development

How development is performed in this repository, for both humans and AI agents.
User-facing setup lives in the README; this document is for people changing the code.

## Setup

All tools are managed by mise.

```bash
mise install
pnpm install
pnpm exec svelte-kit sync   # once per fresh clone, before the first typecheck
```

| Tool      | Purpose          | Managed via |
| --------- | ---------------- | ----------- |
| node 24   | Runtime          | `mise.toml` |
| pnpm 12   | Package manager  | `mise.toml` |
| oxlint    | Linter           | `mise.toml` |
| oxfmt     | Formatter        | `mise.toml` |
| prek      | Pre-commit hooks | `mise.toml` |
| cocogitto | Commit lint      | `mise.toml` |

Do not substitute tools without explicit approval (see the guidelines repository's toolchain standards).

## Commands

```bash
pnpm dev                                     # dev server; /#/styleguide renders every component
node tools/build.ts <report.json> <out.html>  # full compile, works from any cwd
node tools/diagram.ts <diagram.mmd> [out.svg] # Mermaid → themed SVG (Pele); prints to stdout without out
node tools/serve.ts start <dir>            # serve a compiled page + collect answers
mise run check                               # full validation — what CI runs
mise run lint | typecheck | format | validate # individual gates
```

`mise run` lists every task.

## Workflow

1. Branch from `main`
2. Make the smallest complete change
3. `mise run check` must pass
4. Commit with Conventional Commits (validated by Cocogitto)
5. Open a PR following [CONTRIBUTING.md](./CONTRIBUTING.md)

## Layout

- `src/` — the renderer: components, schema, theme, routes.
- `docs/` — authoring contract and guides for consumer skills.
- `tools/` — compile pipeline and the round-trip server.

## Coding Standards

Follow the guidelines repository's coding standards. Project-specific rules:

- Svelte 5 runes only; run `svelte-autofixer` on every touched component until it reports nothing.
- Style ownership per `ARCHITECTURE.md`: utilities for markup, `@layer base` for content elements, `@layer components` for runtime-injected nodes.

## Testing

There is no automated test suite. Verification for a change is:

1. `mise run check` (lint, format, typecheck, schema validation).
2. Build smoke: `node tools/build.ts src/lib/report.json /tmp/index.html`, then serve it with `tools/serve.ts` and walk the affected surface in a browser (components on `/#/styleguide`, review round trip, selection chat).

Add a real suite before the next contract-breaking change, not after.

## Debugging

- A blank page when the artifact is opened directly usually means the hash router was bypassed or CSS failed to inline — check `router: { type: 'hash' }` and `%sveltekit.head%` placement.
- `node tools/serve.ts` (no args) lists commands; `serve.ts status` shows whether state and chat files are being written.

## Validation

`mise run check` is the entry point for the project's main validation.
It runs the same checks locally that CI runs — do not maintain separate logic.

## Deployment

Not applicable. The artifact is `build/index.html`; distribution belongs to the consumer — any static channel (HTTP server, attachment, locally opened file) works.
