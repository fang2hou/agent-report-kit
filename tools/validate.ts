import { readFileSync } from "node:fs";
import { reportSchema } from "../src/lib/schema.ts";

const path = process.argv[2] ?? "src/lib/report.json";
const parsed = reportSchema.safeParse(JSON.parse(readFileSync(path, "utf8")));

if (parsed.success) {
  console.log(`OK: ${path} matches the report schema`);
} else {
  console.error(`INVALID: ${path}`);
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join(".") || "(root)"}: ${issue.message}`);
  }
  process.exit(1);
}
