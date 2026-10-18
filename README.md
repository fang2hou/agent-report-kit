# report-kit

JSON-driven, single-file HTML report renderer built on SvelteKit. The agent
writes a `report.json`; this app renders it. Interactive mode runs the dev
server; the final artifact is one self-contained `index.html` that opens from
`file://` with zero external assets.

## Commands

```bash
pnpm install
pnpm dev     # interactive mode (chat/state APIs land here in phase 3)
pnpm build   # emits build/index.html (self-contained, ~94 KB baseline)
```

Only `build/index.html` is needed for distribution; `build/_app/version.json`
is unused at runtime with polling disabled.

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
   `<title>` makes the inlined `<style>` land inside the title element, and the
   page ships with no CSS in head.

Also: `version.pollInterval` defaults to one hour, and its `version.json`
fetch is blocked by CORS under `file://`. It is set to `0` here.

## Status

Phase 1 (PoC) complete. See the html-report skill in
[fang2hou/skills](https://github.com/fang2hou/skills) for the driving use
case. Next: component parity with the existing template, then the JSON schema
and build/serve scripts.
