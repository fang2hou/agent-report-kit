// Lifecycle and agent client for the SvelteKit report session.
import { spawn, execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { compile } from "./compile.ts";
import { reportSchema } from "../src/lib/schema.ts";

const KIT = resolve(import.meta.dirname, "..");
const [command, directory, ...args] = process.argv.slice(2);
const root = resolve(directory ?? ".");
const infoPath = join(root, ".server.json");
type Info = { url: string; pid: number; token: string; dir: string; state: string };
const flag = (name: string, fallback: string) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : (args[i + 1] ?? fallback);
};
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const readInfo = (): Info | null => {
  try {
    return JSON.parse(readFileSync(infoPath, "utf8"));
  } catch {
    return null;
  }
};
const request = async (action: string, body?: unknown, method = "POST") => {
  const info = readInfo();
  if (!info) throw new Error("No session. Run report:start first.");
  const response = await fetch(`${info.url}api/${action}`, {
    method: body === undefined ? "GET" : method,
    headers: { authorization: `Bearer ${info.token}`, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);
  return response.json();
};
const status = async () => {
  try {
    return { ...(await request("status")), running: true };
  } catch {
    return { running: false };
  }
};
const owner = () => {
  const explicit = flag("--owner-pid", "");
  if (explicit) {
    const pid = Number(explicit);
    if (!Number.isInteger(pid) || pid < 2)
      throw new Error("--owner-pid must be a process id greater than 1");
    process.kill(pid, 0);
    return pid;
  }
  let pid = process.ppid;
  for (let n = 0; n < 8 && pid > 1; n++) {
    try {
      const row = execFileSync("ps", ["-p", String(pid), "-o", "ppid=,args="], {
        encoding: "utf8",
      }).trim();
      const match = row.match(/^(\d+)\s+(.*)$/);
      if (!match) break;
      if (/(?:^|[/\s])(?:pi|codex|claude)(?:[/\s.]|$)/i.test(match[2]!)) return pid;
      pid = Number(match[1]);
    } catch {
      break;
    }
  }
  return undefined;
};

async function launch() {
  if (!existsSync(join(root, "report.json"))) throw new Error("Directory must contain report.json");
  reportSchema.parse(JSON.parse(readFileSync(join(root, "report.json"), "utf8")));
  if ((await status()).running) {
    const info = readInfo()!;
    return { url: info.url, pid: info.pid, dir: root, state: info.state, reused: true };
  }
  const previous = readInfo();
  if (previous && !previous.token) {
    let alive = false;
    try {
      process.kill(previous.pid, 0);
      alive = true;
    } catch {
      /* Stale contact metadata. */
    }
    if (alive)
      throw new Error(
        "An older report service is running here. Close it with its original kit before restarting.",
      );
  }
  const lease = Number(flag("--lease-seconds", "60"));
  if (!Number.isFinite(lease) || lease < 1) throw new Error("--lease-seconds must be at least 1");
  const ownerPid = owner();
  await compile("session");
  const port =
    Number(flag("--port", "0")) ||
    (await new Promise<number>((resolve, reject) => {
      const server = createServer();
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => {
        const address = server.address();
        const selected = typeof address === "object" && address ? address.port : 0;
        server.close(() => resolve(selected));
      });
    }));
  const token = randomUUID();
  const log = openSync(join(root, ".server.log"), "a");
  const child = spawn(process.execPath, [join(KIT, "dist/server/index.js")], {
    cwd: KIT,
    detached: true,
    stdio: ["ignore", log, log],
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
      REPORT_DIR: root,
      REPORT_TOKEN: token,
      REPORT_LEASE_MS: String(lease * 1_000),
      REPORT_OWNER_PID: ownerPid ? String(ownerPid) : "",
      SHUTDOWN_TIMEOUT: "1",
    },
  });
  closeSync(log);
  const info: Info = {
    url: `http://127.0.0.1:${port}/`,
    pid: child.pid!,
    token,
    dir: root,
    state: join(root, "state.json"),
  };
  writeFileSync(infoPath, JSON.stringify(info), { mode: 0o600 });
  child.unref();
  for (let n = 0; n < 100; n++) {
    if ((await status()).running)
      return {
        url: info.url,
        pid: info.pid,
        dir: root,
        state: info.state,
        ownerPid,
        leaseSeconds: lease,
      };
    await sleep(100);
  }
  try {
    child.kill("SIGTERM");
  } catch {
    /* Startup already failed. */
  }
  if (existsSync(infoPath)) unlinkSync(infoPath);
  throw new Error(`Session did not start; read ${join(root, ".server.log")}`);
}

async function start() {
  const lock = join(root, ".server-start.lock");
  const deadline = Date.now() + 130_000;
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
            rmSync(lock, { recursive: true, force: true });
            continue;
          }
        }
      } catch {
        try {
          if (Date.now() - statSync(lock).mtimeMs > 2_000) {
            rmSync(lock, { recursive: true, force: true });
            continue;
          }
        } catch {
          /* Lock owner completed. */
        }
      }
      if (Date.now() > deadline)
        throw new Error("Timed out waiting for this report's startup lock");
      await sleep(100);
    }
  }
  writeFileSync(join(lock, "pid"), String(process.pid));
  try {
    return await launch();
  } finally {
    rmSync(lock, { recursive: true, force: true });
  }
}

try {
  let result: unknown;
  if (command === "start") result = await start();
  else if (command === "status") result = await status();
  else if (command === "stop") {
    if ((await status()).running) await request("close", {});
    for (let n = 0; n < 30 && (await status()).running; n++) await sleep(100);
    if ((await status()).running) throw new Error("Session did not stop");
    result = { running: false, dir: root };
  } else if (command === "poll") {
    const params = new URLSearchParams({ wait: flag("--wait", "5") });
    if (args.includes("--since")) params.set("since", flag("--since", "0"));
    result = await request(`poll?${params}`);
  } else if (command === "ack") result = await request("ack", { cursor: Number(args[0]) });
  else if (command === "reply") {
    result = await request("chat", {
      role: "agent",
      replyTo: Number(args[0]),
      text: args[1],
      key: flag("--key", `reply:${args[0]}`),
    });
  } else if (command === "chat")
    result = await request(`chat?since=${Number(flag("--since", "0"))}`);
  else if (command === "wait") {
    const until = Date.now() + Number(flag("--timeout", "60")) * 1_000;
    do {
      const batch = await request("poll?wait=5");
      if (batch.state.submitted) {
        result = batch.state;
        break;
      }
      await sleep(500);
    } while (Date.now() < until);
    if (!result) process.exitCode = 5;
  } else
    throw new Error("Usage: serve.ts start|status|poll|ack|reply|chat|wait|stop <dir> [options]");
  if (result) console.log(JSON.stringify(result));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
