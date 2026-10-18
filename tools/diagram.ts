import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, extname } from "node:path";
import { render } from "pele";

/*
 * Render a Mermaid diagram source to SVG for a report `figure` block.
 * Build-time only: the page embeds the static SVG, so the single-file
 * output keeps zero runtime JavaScript. The SVG carries Pele's `.pele`
 * root class; src/app.css maps its theme variables onto the design
 * tokens, so diagrams follow the page palette without baked colors.
 */

const inPath = process.argv[2];
const outPath = process.argv[3];
if (!inPath) {
  console.error("usage: node tools/diagram.ts <diagram.mmd> [out.svg]");
  console.error("       no out.svg: the SVG is printed to stdout");
  process.exit(2);
}

// Keep this in sync with the --ui stacks in src/app.css; a merged stack
// keeps label measurement close for every report language.
const fontFamily =
  '"IBM Plex Sans", "IBM Plex Sans SC", "IBM Plex Sans JP", "PingFang SC", sans-serif';

// Pele's default prefix collides when two diagrams land in one page and
// both carry accTitle/accDescr (duplicate id references). Slug the input
// filename so every diagram gets stable, unique ids.
const idPrefix = `pele-${basename(inPath, extname(inPath))
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")}`;

let result;
try {
  result = render(readFileSync(inPath, "utf8"), { fontFamily, fontSize: 17, idPrefix });
} catch (error) {
  console.error(`INVALID: ${inPath}`);
  console.error(`  ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

// The single-file invariant: a diagram must render offline. Mermaid image
// nodes emit <image href="..."> with the original URL; anything but a
// data: URL would make the page fetch remote assets.
const externalImage = /<image[^>]+href="(?!data:)[^"]*"/.exec(result.svg);
if (externalImage) {
  console.error(`INVALID: ${inPath}`);
  console.error(
    "  diagram references an external image; inline it as a data: URL or drop the node",
  );
  process.exit(1);
}

if (!outPath) {
  process.stdout.write(result.svg);
} else {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, result.svg);
  console.log(`OK: ${outPath} (${result.type}, ${result.width}x${result.height})`);
}
