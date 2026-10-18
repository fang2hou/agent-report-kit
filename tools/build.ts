import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { reportSchema } from "../src/lib/schema.ts";

const jsonPath = process.argv[2];
const outPath = process.argv[3] ?? "build/report.html";
if (!jsonPath) {
  console.error("usage: node tools/build.ts <report.json> [out.html]");
  process.exit(2);
}

const reportText = readFileSync(jsonPath, "utf8");
const parsed = reportSchema.safeParse(JSON.parse(reportText));
if (!parsed.success) {
  console.error(`INVALID: ${jsonPath}`);
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join(".") || "(root)"}: ${issue.message}`);
  }
  process.exit(1);
}

execSync("pnpm exec vite build", { stdio: "inherit" });

let template = readFileSync("build/index.html", "utf8");
const tag = (json: string) => `<script id="report-data" type="application/json">${json}</script>`;
// "</" would terminate the script tag from inside a JSON string; "\/" is a valid JSON escape.
const payload = reportText.replace(/<\//g, "<\\/");

const placeholder = /<script id="report-data" type="application\/json">[\s\S]*?<\/script>/;
if (placeholder.test(template)) {
  template = template.replace(placeholder, () => tag(payload));
} else {
  const body = /<body[^>]*>/;
  if (!body.test(template)) {
    console.error("FATAL: no <body> anchor in build/index.html");
    process.exit(1);
  }
  template = template.replace(body, (m) => `${m}${tag(payload)}`);
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, template);
console.log(`OK: ${outPath} (${template.length} bytes)`);
