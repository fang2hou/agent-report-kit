import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";

const root = resolve(import.meta.dirname, "..");
const lock = join(root, ".compile-lock");

export async function compile(target: "export" | "session") {
  const deadline = Date.now() + 120_000;
  for (;;) {
    try {
      mkdirSync(lock);
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      try {
        const pid = Number(readFileSync(join(lock, "pid"), "utf8"));
        try {
          process.kill(pid, 0);
        } catch (cause) {
          if ((cause as NodeJS.ErrnoException).code === "ESRCH") {
            rmSync(lock, { recursive: true });
            continue;
          }
        }
      } catch {
        /* Another compiler may still be writing its pid. */
      }
      if (Date.now() > deadline) throw new Error("Timed out waiting for the kit compiler lock");
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  writeFileSync(join(lock, "pid"), String(process.pid));
  try {
    execFileSync("pnpm", [target === "export" ? "build" : "build:server"], {
      cwd: root,
      stdio: ["ignore", 2, 2],
    });
  } finally {
    rmSync(lock, { recursive: true, force: true });
  }
}
