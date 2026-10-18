# report-kit

JSON-driven, single-file HTML report renderer built on SvelteKit. The agent
writes a `report.json`; this repo renders it. Interactive mode runs the dev
server; the final artifact is one self-contained `index.html` that opens from
`file://` with zero external assets (~180 KB baseline).

This repo owns everything visual and structural: the component library, the
theme tokens (Tailwind v4 `@theme` in `src/app.css`), the default chrome
strings per language, and the review/selection-chat machinery. Consumers —
such as the html-report skill in [fang2hou/skills](https://github.com/fang2hou/skills) —
clone this repo, feed it JSON, and never carry template content themselves.

## Commands

```bash
pnpm install
pnpm dev        # interactive mode: /api/state and /api/chat round-trips
pnpm build      # emits build/index.html (self-contained)

node tools/build.ts <report.json> <out.html>
# validate against the zod schema, compile, inject the data — one step;
# works from any cwd

python3 tools/serve.py start <dir>   # serve a compiled page on 127.0.0.1,
# collect review answers to state.json and selection-chat replies to
# chat.json; `python3 tools/serve.py --help` for chat/reply/wait/stop
```

Only `build/index.html` is needed for distribution; `build/_app/version.json`
is unused at runtime with polling disabled.

## Documentation

- `docs/report-schema.md` — the report.json authoring contract; the zod schema
  in `src/lib/schema.ts` is the authority, fix both in the same PR.
- `docs/components.md` — which component fits which content shape, with the
  rendered markup as a visual contract, plus a read-through checklist.
- `docs/typography.md` — font stacks, sizes, color tokens, and how to add a
  language.
- `#/styleguide` (dev server) — every component rendered live with token
  readouts.

Style changes land here alone: adjusting the look, adding a component, or
adding a language requires no change in consuming skills.

## SvelteKit 3 notes

Verified on `@sveltejs/kit` 3.1.0, `svelte` 5.57, `vite` 8.3. Four behaviors
that cost build cycles during the PoC:

1. **`file://` requires the hash router.** The pathname router matches
   `location.pathname`, which under `file://` is a filesystem path, so no route
   matches and the page stays blank. Configure `router: { type: 'hash' }`.
2. **No page options with the hash router.** Exporting `ssr`, `prerender`, or
   `trailingSlash` fails the build with `router_hash_page_options`; client-only
   rendering is implied by the router itself.
3. **`$lib` is now `#lib`** and must be declared as a Node subpath import in
   `package.json` (`"imports": { "#lib/*": "./src/lib/*" }`). `sv create`
   scaffolds add this; hand-rolled ones miss it.
4. **`%sveltekit.head%` must sit bare inside `<head>`.** Wrapping it in
   `<title>` makes the inlined `<style>` land inside the title element, and
   the page ships with no CSS in head.

Also: `version.pollInterval` defaults to one hour, and its `version.json`
fetch is blocked by CORS under `file://`. It is set to `0` here.
