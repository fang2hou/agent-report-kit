import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { test } from "node:test";
import { compile } from "./compile.ts";

const root = resolve(import.meta.dirname, "..");
const run = promisify(execFile);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
await compile("session");

async function fixture(leaseMs = 60_000, ownerPid = process.pid) {
  const directory = mkdtempSync(join(tmpdir(), "report-http-test-"));
  writeFileSync(
    join(directory, "report.json"),
    JSON.stringify({ lang: "en", title: "Decision", summary: ["Evidence"], sections: [] }),
  );
  const socket = createServer();
  socket.listen(0, "127.0.0.1");
  await once(socket, "listening");
  const address = socket.address();
  assert.ok(address && typeof address !== "string");
  const port = address.port;
  await new Promise<void>((resolve) => socket.close(() => resolve()));
  const token = randomUUID();
  const child = spawn(process.execPath, [join(root, "dist/server/index.js")], {
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
      REPORT_DIR: directory,
      REPORT_OWNER_PID: String(ownerPid),
      REPORT_LEASE_MS: String(leaseMs),
      REPORT_TOKEN: token,
      SHUTDOWN_TIMEOUT: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const url = `http://127.0.0.1:${port}/`;
  writeFileSync(
    join(directory, ".server.json"),
    JSON.stringify({ url, pid: child.pid, token, dir: directory }),
  );
  const request = async (action: string, body?: unknown, method = "POST") => {
    const response = await fetch(`${url}api/${action}`, {
      method: body === undefined ? "GET" : method,
      headers: {
        authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        origin: url.slice(0, -1),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(3_000),
    });
    assert.equal(response.status, 200, await response.clone().text());
    return response.json();
  };
  try {
    for (let n = 0; ; n++) {
      try {
        await request("status");
        break;
      } catch (error) {
        if (n > 50) throw error;
        await sleep(50);
      }
    }
  } catch (error) {
    child.kill();
    rmSync(directory, { recursive: true, force: true });
    throw error;
  }
  return {
    directory,
    child,
    request,
    async close() {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGTERM");
        await once(child, "exit");
      }
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

test(
  "HTTP and 64 concurrent CLI replies share one writer; browser-style saves and acknowledgements round-trip",
  { timeout: 30_000 },
  async () => {
    const f = await fixture();
    try {
      const question = await f.request("chat", { text: "Why?", quote: "Evidence" });
      const incoming = await f.request("poll");
      assert.equal(incoming.events.length, 1);
      await Promise.all(
        Array.from({ length: 64 }, (_, i) =>
          run(process.execPath, [
            join(root, "tools/serve.ts"),
            "reply",
            f.directory,
            String(question.id),
            `Explanation ${i}`,
            "--key",
            `stress-${i}`,
          ]),
        ),
      );
      const chat = await f.request("chat");
      assert.equal(chat.messages.length, 65);
      assert.equal(new Set(chat.messages.map((message: { id: number }) => message.id)).size, 65);
      await f.request("chat", {
        role: "agent",
        text: "Explanation 0",
        replyTo: question.id,
        key: "stress-0",
      });
      assert.equal((await f.request("chat")).messages.length, 65);
      await f.request("ack", { cursor: incoming.cursor });
      assert.equal((await f.request("poll")).events.length, 0);
      await f.request("state", { answers: { choice: { value: "small" } }, submitted: true }, "PUT");
      assert.equal((await f.request("poll")).state.submitted, true);
      assert.equal(
        JSON.parse(readFileSync(join(f.directory, "state.json"), "utf8")).answers.choice.value,
        "small",
      );
    } finally {
      await f.close();
    }
  },
);

test("browser polling cannot keep a lease-expired service alive", { timeout: 10_000 }, async () => {
  const f = await fixture(1_500);
  try {
    const until = Date.now() + 5_000;
    while (f.child.exitCode === null && f.child.signalCode === null && Date.now() < until) {
      await f.request("chat").catch(() => {});
      await sleep(100);
    }
    assert.ok(f.child.exitCode !== null || f.child.signalCode !== null);
    assert.equal(existsSync(join(f.directory, ".server.json")), false);
    assert.equal(existsSync(join(f.directory, "report.json")), true);
  } finally {
    await f.close();
  }
});

test(
  "an owning process exit closes the service while preserving saved decisions",
  { timeout: 10_000 },
  async () => {
    const owner = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
      stdio: "ignore",
    });
    const f = await fixture(60_000, owner.pid!);
    try {
      await f.request("state", { answers: { choice: { value: "keep" } } }, "PUT");
      const exited = once(f.child, "exit");
      owner.kill("SIGTERM");
      await exited;
      assert.equal(existsSync(join(f.directory, ".server.json")), false);
      assert.equal(
        JSON.parse(readFileSync(join(f.directory, "state.json"), "utf8")).answers.choice.value,
        "keep",
      );
    } finally {
      owner.kill();
      await f.close();
    }
  },
);

test("simultaneous starts of one report reuse a single service", { timeout: 30_000 }, async () => {
  const directory = mkdtempSync(join(tmpdir(), "report-start-test-"));
  const pids = new Set<number>();
  writeFileSync(
    join(directory, "report.json"),
    JSON.stringify({ lang: "en", title: "Start", summary: [], sections: [] }),
  );
  try {
    const results = await Promise.all(
      [0, 1].map(async () => {
        const result = await run(process.execPath, [
          join(root, "tools/serve.ts"),
          "start",
          directory,
          "--owner-pid",
          String(process.pid),
        ]);
        const info = JSON.parse(result.stdout);
        pids.add(info.pid);
        return info;
      }),
    );
    assert.equal(results[0].url, results[1].url);
    assert.equal(pids.size, 1);
  } finally {
    await run(process.execPath, [join(root, "tools/serve.ts"), "stop", directory]).catch(() => {});
    for (const pid of pids) {
      try {
        process.kill(pid, "SIGTERM");
      } catch {
        /* Already closed. */
      }
    }
    rmSync(directory, { recursive: true, force: true });
  }
});
