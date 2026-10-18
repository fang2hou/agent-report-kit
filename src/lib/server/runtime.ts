import { mkdtempSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import demo from "#lib/report.json";
import { Session } from "./session.ts";

let session: Session | undefined;

export function getSession() {
  if (!session) {
    const root = process.env.REPORT_DIR ?? mkdtempSync(join(tmpdir(), "agent-report-dev-"));
    if (!process.env.REPORT_DIR) writeFileSync(join(root, "report.json"), JSON.stringify(demo));
    session = new Session(root);
  }
  return session;
}

export function startLifecycle() {
  if (!process.env.REPORT_DIR) return;
  const current = getSession();
  const leaseMs = Number(process.env.REPORT_LEASE_MS ?? 60_000);
  const ownerPid = Number(process.env.REPORT_OWNER_PID) || undefined;
  const timer = setInterval(() => {
    if (current.expired(Date.now(), leaseMs, ownerPid)) process.kill(process.pid, "SIGTERM");
  }, 1_000);
  timer.unref();
  process.once("exit", () => {
    clearInterval(timer);
    const path = join(current.root, ".server.json");
    try {
      if (JSON.parse(readFileSync(path, "utf8")).pid === process.pid) unlinkSync(path);
    } catch {
      /* The launcher may already have removed its contact file. */
    }
  });
}
