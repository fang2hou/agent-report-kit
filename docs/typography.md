# Typography and Color

Why the template looks the way it does, and how to change it without losing readability. Load this only when changing fonts, sizes, or colors, or when writing a page in a language the template does not cover.

Contents:

- [Font stacks by language](#font-stacks-by-language)
- [Sizes and spacing](#sizes-and-spacing)
- [CJK line breaking and spacing](#cjk-line-breaking-and-spacing)
- [Color tokens](#color-tokens)
- [Corners](#corners)
- [Adding a language](#adding-a-language)

## Font stacks by language

Each language sets `--ui` and `--body` on `:lang(...)`: `--ui` for headings, tables, labels, and controls; `--body` for long prose. `--font-mono` is one static token for code in every language. Because `--ui` and `--body` are set per element, an element with its own `lang` attribute switches fonts inside a page of another language. All tokens are defined once in the renderer's `src/app.css` (`@theme` block; Tailwind v4).

| Language         | `--ui` (first choice → fallback)                                        | `--body`                                                          | Why                                                                                                                          |
| ---------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| zh-CN            | IBM Plex Sans SC → Source Han Sans SC VF → PingFang SC                  | FZPingXianYaSong-R-GBK → LXGW Neo ZhiSong Screen Full → Songti SC | The user prefers Song-style serif for long reading; FZ PingXian YaSong is drawn for screens.                                 |
| ja               | IBM Plex Sans JP → Source Han Sans VF → Hiragino Sans                   | Hiragino Mincho ProN → Yu Mincho → Source Han Serif JP            | Mincho matches the Song-style preference. BIZ UDMincho is excluded: its Latin letters are monospaced and look broken.        |
| en (and default) | IBM Plex Sans → IBM Plex Sans JP → system sans                          | Charter → Iowan Old Style → Georgia                               | Charter is a screen-friendly serif shipped with macOS. Plex Sans JP carries the same Latin glyphs when Plex Sans is missing. |
| code (all)       | JetBrainsMono Nerd Font → JetBrains Mono → IBM Plex Mono → ui-monospace | —                                                                 | The user's code font.                                                                                                        |

Emphasis never switches font family inside prose: `strong` stays in `--body` everywhere. Mixing a sans face into Song-style body text offsets adjacent baselines (the reader sees neighboring characters sit at different heights), so one family per paragraph wins over the Gothic-emphasis convention. Single-weight Song faces get the 600 weight synthesized by the browser — same family, same baseline.

Family names must match what the system installed, not the marketing name. Check with `fc-list : family | rg -i "<name>"`. Variable-font installs often add a suffix, such as `Source Han Sans SC VF`.

## Sizes and spacing

The user found earlier reports too small (body 16.5 px, tables 13–14.5 px, labels 11–13 px). The template sets:

| Element               | Latin                 | CJK                   |
| --------------------- | --------------------- | --------------------- |
| Body text             | 18 px, line 1.65      | 17.5 px, line 1.8–1.9 |
| Letter spacing (body) | 0                     | zh 0.02em, ja 0.04em  |
| Line length           | 68ch                  | 36–38em               |
| Tables, controls      | 0.9em (about 16 px)   | 0.9em                 |
| Smallest text (chips) | 14 px                 | 14 px                 |
| h1 / h2 / h3          | 2em / 1.42em / 1.14em | same                  |

Rules when changing sizes:

- Keep at least a 1.25× step between heading levels; the user reads hierarchy from size, and small steps look flat.
- Do not set any text below 14 px.
- Keep CJK line height at 1.8 or more; CJK glyphs fill the em box and need more space between lines than Latin.
- Set letter spacing to 0 inside code, tables, and controls; tracking hurts dense text.

## CJK line breaking and spacing

- Writers type a half-width space between CJK characters and Latin letters or digits (a natural-writing convention). `text-autospace: normal` on `body` adds a smaller gap wherever a space is missing; it adds nothing where one is typed. A typed space is also a line-break point, so short headings join a trailing number and its counter with `&nbsp;` (`3&nbsp;个`, `3&nbsp;個`).
- Japanese uses `line-break: strict` (no small kana or prolonged sound marks at line start) and `word-break: auto-phrase` on headings, which breaks at phrase boundaries. Chrome applies `auto-phrase` only when `lang="ja"`.
- `text-wrap: balance` on headings and `text-wrap: pretty` on prose avoid one-word last lines.

These properties are ignored by browsers that lack them; the page still reads correctly.

## Color tokens

Contrast ratios are against the cream background `--color-bg` `#faf6ef`. Every text color passes WCAG AA (4.5:1). Black is softened to blue-black for a calmer page without losing contrast. Figure SVGs and rich text reference these by their full names, `var(--color-accent)` and so on.

| Token                               | Value                | Contrast | Use                                              |
| ----------------------------------- | -------------------- | -------- | ------------------------------------------------ |
| `--color-ink`                       | `#28303b`            | 12.4     | Body text and headings                           |
| `--color-ink-2`                     | `#4a5462`            | 7.1      | Secondary text, table headers                    |
| `--color-muted`                     | `#646c78`            | 4.9      | Meta lines, hints, captions; the lightest text   |
| `--color-accent`                    | `#3a5470`            | 7.3      | Links, focus, selected controls, one data series |
| `--color-ok` / `--color-ok-soft`    | `#3d6a4c`            | 5.8      | Done, safe, keep                                 |
| `--color-warn`                      | `#85571a`            | 5.8      | Needs attention                                  |
| `--color-risk`                      | `#99392f`            | 6.5      | Breaking, unsafe, missing                        |
| `--color-line`, `--color-line-2`    | `#e4dccf`, `#d3c9b8` | —        | Rules and borders only, never text               |
| `--color-mark`, `--color-mark-soft` | `#f0e2ad`, `#f8f1d6` | —        | Selection-chat highlights on quoted passages     |

Do not add colors for decoration. If a chart needs a second series, use `--color-ink-2` or `--color-muted`, not a new hue. Never use a gray lighter than `--color-muted` for text; earlier reports used `#8a8175` (3.5:1), which the user found hard to read.

## Corners

Three tiers. Large surfaces (cards, the summary, question cards, the submit bar) use 14 px corners, upgraded to a 20 px squircle where `corner-shape` is supported. Form controls — every text field, single- or multi-line, and every button — share 10 px (12 px on the taller option rows), squircle where supported. Full-round stadiums are reserved for chip-like marks (TOC entries, the pick chip, the status pill) and are never used on form controls. A rounded element nested in another keeps concentric corners: inner radius = outer radius − the gap between them (count the border).

## Controls and scrollbars

Radio buttons and checkboxes are drawn by the renderer at 1.15 em, so they match the option text instead of the small browser default. Every scrollbar on the page — the page itself included — is themed the same way: a thin rounded thumb in the line color over a transparent track. Horizontal scroll regions (wide tables, wide figures) hide the native bar and draw the in-page slider instead, which stays visible whenever the region can scroll.

## Adding a language

1. Add a `:lang(xx)` block next to the others with `--ui`, `--body`, `--fs`, `--lh`, `--ls`, and `--measure`.
2. Choose fonts that are installed (`fc-list`), with a system fallback last.
3. Adding a language now means changing the renderer: add the `STRINGS` entry in agent-report-kit (`Review.svelte`, `Chat.svelte`, `Toc.svelte`, `+page.svelte`) and the `:lang` font block in `src/app.css`, then rebuild.
4. Render a sample paragraph with mixed Latin text and digits, and check line breaks and spacing in a screenshot.
