// Serve an html-report directory on 127.0.0.1 and save review answers to DIR/state.json.
//
// Usage:
//   node tools/serve.ts start <dir> [--port N] [--idle-hours H]   start (or reuse) a background server
//   node tools/serve.ts run <dir> [--port N] [--idle-hours H]     run in the foreground
//   node tools/serve.ts wait <dir> [--timeout S]                  block until answers are submitted
//   node tools/serve.ts chat <dir> [--since N] [--wait S]         print user questions as JSON lines
//   node tools/serve.ts reply <dir> <id> <text>                   answer a question from the page
//   node tools/serve.ts status <dir>                              is the server up, how many answered
//   node tools/serve.ts stop <dir>                                stop the background server
//
// The page polls GET /api/chat?since=N every few seconds; answers PUT /api/state.
// Server state lives beside index.html: state.json (answers), chat.json
// (discussion threads), .server.json (contact info), .server.log.

import { spawn } from "node:child_process";
import {
  existsSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { dirname, extname, isAbsolute, join, normalize, resolve, sep } from "node:path";

const STATE_FILE = "state.json";
const CHAT_FILE = "chat.json";
const INFO_FILE = ".server.json";
const LOG_FILE = ".server.log";
// Answers for one review page are a few KB; 1 MB rejects accidental uploads.
const MAX_BODY = 1_000_000;
// One chat message is a question or a reply; anything longer belongs in the page.
const MAX_TEXT = 4_000;
const MAX_QUOTE = 500;
const DEFAULT_IDLE_HOURS = 4.0;
// Seconds to wait for the background server to bind its port.
const START_TIMEOUT = 10.0;

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

type Message = {
  id: number;
  ts: string;
  role: string;
  text: string;
  quote?: string;
  replyTo?: number;
};

const fail = (code: number, message: string): never => {
  console.error(message);
  process.exit(code);
};

const nowIso = () => new Date().toISOString().replace(/\.\d+Z$/, "Z");

const readJson = (path: string): Record<string, unknown> | null => {
  try {
    const data = JSON.parse(readFileSync(path, "utf8"));
    return data && typeof data === "object" && !Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
};

const readChat = (root: string): { messages: Message[]; next: number } => {
  const data = readJson(join(root, CHAT_FILE));
  const messages = data?.messages;
  if (!Array.isArray(messages)) return { messages: [], next: 1 };
  return { messages: messages as Message[], next: Number(data?.next) || messages.length + 1 };
};

const writeJsonAtomic = (path: string, data: unknown): void => {
  const tmp = join(dirname(path), `.state-${process.pid}-${Date.now()}.tmp`);
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
};

// POST /api/chat and `reply` can overlap; chat.json is a read-modify-write file.
let chatChain: Promise<unknown> = Promise.resolve();
const chatAppend = (root: string, message: Omit<Message, "id" | "ts">): Promise<Message> => {
  const job = chatChain.then(() => {
    const data = readChat(root);
    const saved: Message = { id: data.next, ts: nowIso(), ...message };
    data.messages.push(saved);
    writeJsonAtomic(join(root, CHAT_FILE), { messages: data.messages, next: saved.id + 1 });
    return saved;
  });
  // Keep the chain alive even if one write fails; the caller still sees the error.
  chatChain = job.catch(() => {});
  return job;
};

/** Map any message id in a thread to its root question id. */
const threadRoot = (messages: Message[], mid: number): number => {
  const byId = new Map(messages.map((m) => [m.id, m]));
  let root = mid;
  for (let i = 0; i <= byId.size; i++) {
    const parent = byId.get(root)?.replyTo;
    if (parent === undefined) return root;
    root = parent;
  }
  return mid;
};

const contentVersion = (root: string): number => {
  let newest = 0;
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name !== STATE_FILE && entry.name !== CHAT_FILE) {
        // Dangling symlinks and mid-walk deletions must not fail the walk.
        try {
          newest = Math.max(newest, Math.round(statSync(full).mtimeMs));
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
      }
    }
  };
  walk(root);
  return newest;
};

const readBody = (req: IncomingMessage, limit: number): Promise<Buffer> => {
  const { promise, resolve: pass, reject: stop } = Promise.withResolvers<Buffer>();
  const chunks: Buffer[] = [];
  let size = 0;
  req.on("data", (chunk: Buffer) => {
    size += chunk.length;
    if (size > limit) {
      req.destroy();
      stop(new Error("too large"));
      return;
    }
    chunks.push(chunk);
  });
  req.on("end", () => pass(Buffer.concat(chunks)));
  req.on("error", stop);
  return promise;
};

const serveStatic = (
  root: string,
  pathname: string,
  send: (code: number, head: Record<string, string>, body?: Buffer) => void,
): boolean => {
  const clean = decodeURIComponent(pathname);
  if (clean.includes("\0")) return false;
  const parts = clean.split("/").filter(Boolean);
  if (parts.some((p) => p.startsWith("."))) return false;
  const relative = normalize(parts.join(sep));
  const full = isAbsolute(relative) ? relative : join(root, relative);
  if (full !== root && !full.startsWith(root + sep)) return false;
  let stat;
  try {
    stat = statSync(full);
  } catch {
    return false;
  }
  if (!stat.isFile()) return false; // no directory listing
  const type = MIME[extname(full).toLowerCase()] ?? "application/octet-stream";
  send(200, { "Content-Type": type }, readFileSync(full));
  return true;
};

const makeHandler = (root: string, activity: { last: number }) => {
  return (req: IncomingMessage, res: ServerResponse): void => {
    const sendJson = (code: number, data: unknown): void => {
      const body = Buffer.from(JSON.stringify(data), "utf8");
      res.writeHead(code, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": String(body.length),
        "Cache-Control": "no-store",
      });
      res.end(body);
    };
    const sendError = (code: number, reason: string): void => {
      sendJson(code, { error: reason });
    };

    const handle = async (): Promise<void> => {
      // Malformed targets (e.g. "//") throw in the URL constructor; parse
      // here so the catch below rejects the request instead of the process.
      let url: URL;
      try {
        url = new URL(req.url ?? "/", "http://localhost");
      } catch {
        sendError(400, "malformed request target");
        return;
      }
      const route = url.pathname;
      const host = (req.headers.host ?? "").split(":")[0];

      if (host !== "127.0.0.1" && host !== "localhost") {
        sendError(421, "Unexpected Host header");
        return;
      }
      if (route !== "/api/version") {
        console.error(`${nowIso()} ${req.method} ${route}`);
      }

      if (req.method === "GET" && route === "/api/version") {
        sendJson(200, { version: contentVersion(root) });
        return;
      }
      activity.last = Date.now();

      if (req.method === "GET" && route === "/api/state") {
        sendJson(200, readJson(join(root, STATE_FILE)) ?? {});
        return;
      }
      if (req.method === "GET" && route === "/api/chat") {
        const since = Number(url.searchParams.get("since")) || 0;
        const { messages } = readChat(root);
        sendJson(200, {
          messages: messages.filter((m) => m.id > since),
          cursor: Math.max(since, ...messages.map((m) => m.id), 0),
        });
        return;
      }

      if (
        (req.method === "PUT" && route === "/api/state") ||
        (req.method === "POST" && route === "/api/chat")
      ) {
        const origin = req.headers.origin;
        if (origin && origin !== `http://${req.headers.host ?? ""}`) {
          sendError(403, "cross-origin write rejected");
          return;
        }
        if (!(req.headers["content-type"] ?? "").startsWith("application/json")) {
          sendError(415, "expected Content-Type: application/json");
          return;
        }
        const length = Number(req.headers["content-length"]) || 0;
        if (length <= 0 || length > MAX_BODY) {
          sendError(413, `body must be 1..${MAX_BODY} bytes`);
          return;
        }
        let data: Record<string, unknown>;
        try {
          data = JSON.parse((await readBody(req, MAX_BODY)).toString("utf8"));
        } catch {
          sendError(400, "body is not valid JSON");
          return;
        }
        if (!data || typeof data !== "object" || Array.isArray(data)) {
          sendError(400, "body must be a JSON object");
          return;
        }

        if (req.method === "PUT") {
          data.updated = nowIso();
          writeJsonAtomic(join(root, STATE_FILE), data);
          sendJson(200, data);
          return;
        }

        const text = String(data.text ?? "").trim();
        if (!text || text.length > MAX_TEXT) {
          sendError(400, `text must be 1..${MAX_TEXT} chars`);
          return;
        }
        const message: Omit<Message, "id" | "ts"> = {
          role: "user",
          text,
          quote: String(data.quote ?? "").slice(0, MAX_QUOTE),
        };
        const replyTo = data.replyTo;
        if (replyTo !== undefined && replyTo !== null) {
          const { messages } = readChat(root);
          if (!messages.some((m) => m.id === replyTo)) {
            sendError(404, `no message ${replyTo} to reply to`);
            return;
          }
          // Follow-ups may name any message of the thread; the page keys
          // threads by the root question id, so store that.
          message.replyTo = threadRoot(messages, Number(replyTo));
        }
        const saved = await chatAppend(root, message);
        sendJson(200, { id: saved.id });
        return;
      }

      if (req.method === "GET") {
        const sent = serveStatic(
          root,
          route === "/" ? "/index.html" : route,
          (code, head, body) => {
            res.writeHead(code, {
              ...head,
              "Cache-Control": "no-store",
              "Content-Length": String(body?.length ?? 0),
            });
            res.end(body);
          },
        );
        if (!sent) sendError(404, "Not Found");
        return;
      }

      sendError(405, "Method Not Allowed");
    };

    handle().catch(() => {
      if (!res.headersSent) sendError(500, "internal error");
      else res.end();
    });
  };
};

const serverAlive = async (info: Record<string, unknown> | null): Promise<boolean> => {
  if (!info) return false;
  try {
    process.kill(Number(info.pid), 0);
    const res = await fetch(`${info.url}api/version`, { signal: AbortSignal.timeout(2000) });
    return res.status === 200;
  } catch {
    return false;
  }
};

const runServer = (root: string, port: number, idleHours: number): void => {
  const activity = { last: Date.now() };
  let server: Server;
  try {
    server = createServer(makeHandler(root, activity));
  } catch (error) {
    fail(4, `Cannot create server: ${error}`);
  }
  server.on("error", (error: NodeJS.ErrnoException) => {
    fail(
      4,
      `Cannot bind 127.0.0.1:${port}: ${error.code}. Retry with --port 0 to pick a free port.`,
    );
  });
  server.listen(port, "127.0.0.1", () => {
    const bound = (server.address() as AddressInfo).port;
    writeJsonAtomic(join(root, INFO_FILE), {
      url: `http://127.0.0.1:${bound}/`,
      port: bound,
      dir: root,
      pid: process.pid,
      state: join(root, STATE_FILE),
      started: nowIso(),
    });
    console.error(`${nowIso()} serving ${root} at http://127.0.0.1:${bound}/`);

    // Long enough to read a long report; short enough not to leave servers
    // running for days.
    const idle = setInterval(() => {
      if (Date.now() - activity.last > idleHours * 3_600_000) {
        console.error(`${nowIso()} idle for ${idleHours}h, stopping`);
        shutdown();
      }
    }, 60_000);
    const shutdown = (): void => {
      clearInterval(idle);
      server.close(() => process.exit(0));
      // In-flight keep-alive sockets would keep the process up; force exit.
      setTimeout(() => process.exit(0), 2000).unref();
    };
    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  });
};

const spawnServer = (
  root: string,
  port: number,
  idleHours: number,
): Promise<Record<string, unknown> | null> => {
  const { promise: settled, resolve: pass } = Promise.withResolvers<Record<
    string,
    unknown
  > | null>();
  const logFd = openSync(join(root, LOG_FILE), "a");
  const command = [
    process.execPath,
    resolve(import.meta.filename),
    "run",
    root,
    "--port",
    String(port),
    "--idle-hours",
    String(idleHours),
  ];
  const child = spawn(command[0], command.slice(1), {
    detached: true,
    stdio: ["ignore", logFd, logFd],
  });
  child.unref();
  const deadline = Date.now() + START_TIMEOUT * 1000;
  const poll = async (): Promise<void> => {
    const info = readJson(join(root, INFO_FILE));
    if (info && Number(info.pid) === child.pid && (await serverAlive(info))) {
      pass(info);
      return;
    }
    if (child.exitCode !== null || Date.now() > deadline) {
      child.kill("SIGTERM");
      pass(null);
      return;
    }
    setTimeout(poll, 100);
  };
  poll();
  return settled;
};

const startServer = async (root: string, port: number, idleHours: number): Promise<void> => {
  const info = readJson(join(root, INFO_FILE));
  if (await serverAlive(info)) {
    console.log(JSON.stringify(info));
    return;
  }
  // Reuse the previous port so a tab that is still open reconnects after a restart.
  const lastPort = Number(info?.port) || 0;
  const candidates = port ? [port] : lastPort ? [lastPort, 0] : [0];
  for (const candidate of candidates) {
    const started = await spawnServer(root, candidate, idleHours);
    if (started) {
      console.log(JSON.stringify(started));
      return;
    }
  }
  fail(4, `Server did not start. See ${join(root, LOG_FILE)} for the error.`);
};

const answerCounts = (state: Record<string, unknown> | null): Record<string, unknown> => ({
  answered: Object.keys(state?.answers ?? {}).length,
  unanswered: (state?.unanswered as unknown[] | undefined)?.length ?? 0,
  submitted: Boolean(state?.submitted),
});

const sleep = (ms: number) => new Promise<void>((pass) => setTimeout(pass, ms));

const cmdWait = async (root: string, timeout: number): Promise<void> => {
  const deadline = Date.now() + timeout * 1000;
  for (;;) {
    const state = readJson(join(root, STATE_FILE));
    if (state?.submitted) {
      console.log(JSON.stringify(state, null, 2));
      return;
    }
    if (Date.now() >= deadline) {
      console.log(JSON.stringify({ status: "timeout", ...answerCounts(state) }));
      fail(
        5,
        `No submission within ${timeout}s. Read ${join(root, STATE_FILE)} for partial answers.`,
      );
    }
    await sleep(1000);
  }
};

/** Print new user questions (one JSON per line) as they arrive. */
const cmdChat = async (root: string, since: number, wait: number): Promise<void> => {
  const deadline = Date.now() + wait * 1000;
  let seen = since;
  for (;;) {
    for (const message of readChat(root).messages) {
      if (message.id > seen && message.role === "user") {
        seen = message.id;
        console.log(JSON.stringify(message));
      }
    }
    if (wait <= 0 || Date.now() >= deadline) return;
    await sleep(1000);
  }
};

const cmdReply = async (root: string, mid: number, text: string): Promise<void> => {
  const { messages } = readChat(root);
  if (!messages.some((m) => m.id === mid)) {
    fail(6, `No message ${mid} in ${join(root, CHAT_FILE)}. Run \`chat\` to list questions.`);
  }
  // Any id of a thread works; the page keys threads by the root question id.
  const rootId = threadRoot(messages, mid);
  const saved = await chatAppend(root, { role: "agent", replyTo: rootId, text: text.trim() });
  console.log(JSON.stringify({ id: saved.id, replyTo: rootId }));
};

const cmdStatus = async (root: string): Promise<void> => {
  const info = readJson(join(root, INFO_FILE));
  const running = await serverAlive(info);
  const result = {
    running,
    ...(running ? info : {}),
    ...answerCounts(readJson(join(root, STATE_FILE))),
  };
  console.log(JSON.stringify(result));
};

const cmdStop = async (root: string): Promise<void> => {
  const info = readJson(join(root, INFO_FILE));
  if (!(await serverAlive(info))) {
    console.log(JSON.stringify({ stopped: false, reason: "not running" }));
    return;
  }
  const pid = Number(info?.pid);
  process.kill(pid, "SIGTERM");
  for (let i = 0; i < 50; i++) {
    try {
      process.kill(pid, 0);
    } catch {
      break;
    }
    await sleep(100);
  }
  console.log(JSON.stringify({ stopped: true, pid }));
};

interface Args {
  command: string;
  dir: string;
  port: number;
  idleHours: number;
  timeout: number;
  since: number;
  wait: number;
  id: number;
  text: string;
}

const parseArgs = (): Args => {
  const argv = process.argv.slice(2);
  const command = argv[0];
  if (!command || !["start", "run", "wait", "chat", "reply", "status", "stop"].includes(command)) {
    fail(
      2,
      `usage: node ${import.meta.filename} <start|run|wait|chat|reply|status|stop> <dir> [options]`,
    );
  }
  const rest = argv.slice(1);
  const opts = new Map<string, string | number>();
  const positional: string[] = [];
  for (let i = 0; i < rest.length; i++) {
    const token = rest[i];
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = rest[i + 1];
      if (next === undefined || next.startsWith("--")) opts.set(key, true);
      else {
        opts.set(key, next);
        i++;
      }
    } else {
      positional.push(token);
    }
  }
  const dir = positional[0];
  if (!dir) fail(2, "missing <dir> argument");
  const num = (key: string, fallback: number): number => {
    const value = opts.get(key);
    const parsed = Number(value);
    return value === undefined || Number.isNaN(parsed) ? fallback : parsed;
  };
  return {
    command,
    dir,
    port: num("port", 0),
    idleHours: num("idle-hours", DEFAULT_IDLE_HOURS),
    timeout: num("timeout", 1800),
    since: num("since", 0),
    wait: num("wait", 0),
    id: Number(positional[1]) || 0,
    text: positional.slice(2).join(" "),
  };
};

const main = async (): Promise<void> => {
  const args = parseArgs();
  const root = resolve(args.dir);
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    fail(3, `Directory not found: ${root}. Create it and put index.html inside, then retry.`);
  }
  switch (args.command) {
    case "run":
      runServer(root, args.port, args.idleHours);
      break;
    case "start":
      await startServer(root, args.port, args.idleHours);
      break;
    case "wait":
      await cmdWait(root, args.timeout);
      break;
    case "chat":
      await cmdChat(root, args.since, args.wait);
      break;
    case "reply":
      if (!args.id || !args.text) fail(2, "usage: reply <dir> <id> <text>");
      await cmdReply(root, args.id, args.text);
      break;
    case "status":
      await cmdStatus(root);
      break;
    default:
      await cmdStop(root);
  }
};

void main();
