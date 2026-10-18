<div align="center">

# agent-report-kit

JSON in, one self-contained HTML report out — a renderer for AI agents that produce review and decision pages.

[![CI](https://github.com/fang2hou/agent-report-kit/actions/workflows/check.yml/badge.svg)](https://github.com/fang2hou/agent-report-kit/actions/workflows/check.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

</div>

The agent writes a `report.json`; this renderer compiles it into one self-contained `index.html` with zero external assets, multilingual chrome, an optional review-question form, and a selection micro-Q&A. It is not a general site builder: one page, one finding, one decision.

![A rendered report page: masthead, summary box, and figure row](docs/screenshot.png)

## 🚀 Usage / Quick Start

**With an AI coding agent** — paste this into the agent to hand it the repository:

```text
Work in this repository. Read AGENTS.md at the repository root first and follow it.
```

The agent-report skill in [fang2hou/skills](https://github.com/fang2hou/skills) already drives this renderer end to end: it clones the repo, writes `report.json`, and runs the tools below. The kit is not bound to one harness — any skill or script that produces a `report.json` can use the same build-and-serve flow.

**As a human** — requires [mise](https://mise.jdx.dev/) on macOS or Linux, plus Python 3.11+ for the answer-collection server. Runtime versions are pinned in `mise.toml`.

```bash
mise install && pnpm install
node tools/build.ts <report.json> out/index.html   # validate + compile + inject
node tools/diagram.ts <diagram.mmd> out/diagram.svg # Mermaid → themed SVG for figure blocks
node tools/serve.ts start out/                   # serve it, collect answers
```

Distribution is channel-neutral: the compiled `index.html` is a standalone artifact — serve its directory over HTTP with any static server (`tools/serve.ts` adds the answer round trip), hand the file to the reader, or open it directly in a browser. `mise run` lists every other task (`check`, `format`, `lint`, `typecheck`, `validate`).

<details>
<summary>Authoring reference and the styleguide</summary>

- `docs/report-schema.md` — every field, block, and question type.
- `docs/components.md` — which component fits which content shape.
- `pnpm dev`, then open `/#/styleguide` — every component rendered live with token readouts.

</details>

## 💡 Concepts

- **Data, not markup** — the page is compiled from `report.json`; the renderer owns every style, component, and default string. Consumers never carry template content.
- **One self-contained file** — CSS, JS, and data are inlined; the page opens offline and stays small.
- **The round trip** — a served page writes review answers to `state.json` and selection questions to `chat.json`, so the agent reads decisions instead of asking the user to paste them.
- **Reader's language** — `lang` (`zh-CN`, `ja`, `en`) switches fonts, metrics, and every chrome string.

## ✨ Features

- **15 content blocks** — paragraphs, lists, tables, bars, comparisons, translated quote pairs, figures, style galleries, collapsible evidence — picked by content shape, not by styling taste.
- **Mermaid diagrams and charts, themed for free** — `tools/diagram.ts` renders flowcharts, pie, xychart, and sequence diagrams through Pele; the page maps the result onto its design tokens, so they match every language and theme with no baked colors.
- **Reading aids** — the body keeps the reading measure; wide tables and diagrams break out to ~1.35× and scroll in an auto-hiding in-page slider, while a scroll-following TOC tracks the reader's position.
- **Review questions** — single choice, verdict lists, and free text; localStorage draft, progress count, one submit.
- **Selection micro-Q&A** — highlight any passage and ask about it; the question anchors to the text and the reply lands inline.
- **Verified output** — the zod schema validates at build time; the whole pipeline runs from any cwd.

## 📚 Learn More

| Goal                  | Read                                             |
| --------------------- | ------------------------------------------------ |
| Author a report       | [docs/report-schema.md](./docs/report-schema.md) |
| Understand the system | [ARCHITECTURE.md](./ARCHITECTURE.md)             |
| Develop and validate  | [DEVELOPMENT.md](./DEVELOPMENT.md)               |
| Contribute a change   | [CONTRIBUTING.md](./CONTRIBUTING.md)             |
| Give it to an agent   | [AGENTS.md](./AGENTS.md)                         |

## 📄 License

MIT — see [LICENSE](./LICENSE).
