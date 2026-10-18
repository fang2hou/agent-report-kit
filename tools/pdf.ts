import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error(
    "Usage: pnpm export:pdf <report.json> <out.pdf> (requires Chrome/Chromium; CHROME_BIN overrides discovery)",
  );
  process.exit(2);
}
const browser =
  process.env.CHROME_BIN ??
  [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    ...(process.env.PROGRAMFILES
      ? [join(process.env.PROGRAMFILES, "Google/Chrome/Application/chrome.exe")]
      : []),
  ].find(existsSync);
if (!browser)
  throw new Error(
    "Chrome/Chromium not found. Set CHROME_BIN, or print the exported HTML to PDF in your browser.",
  );
const scratch = mkdtempSync(join(tmpdir(), "agent-report-pdf-"));
mkdirSync(dirname(resolve(output)), { recursive: true });
try {
  const html = join(scratch, "report.html");
  execFileSync(process.execPath, [join(import.meta.dirname, "build.ts"), resolve(input), html], {
    stdio: "inherit",
  });
  execFileSync(
    browser,
    [
      "--headless",
      "--disable-gpu",
      `--user-data-dir=${join(scratch, "profile")}`,
      "--no-pdf-header-footer",
      "--virtual-time-budget=5000",
      `--print-to-pdf=${resolve(output)}`,
      pathToFileURL(html).href,
    ],
    { stdio: ["ignore", "ignore", "pipe"], timeout: 30_000 },
  );
  if (!existsSync(resolve(output))) throw new Error("Browser did not produce a PDF");
  console.log(`OK: ${resolve(output)}`);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
