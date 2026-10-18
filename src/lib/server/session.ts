import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { reportSchema } from "../schema.ts";

export type Message = {
  id: number;
  ts: string;
  role: "user" | "agent";
  text: string;
  quote?: string;
  replyTo?: number;
  key?: string;
};
type ReviewState = {
  answers?: Record<string, unknown>;
  submitted?: boolean;
  updated?: string;
  [key: string]: unknown;
};
type Event = { id: number; type: "chat" | "state"; message?: Message; state?: ReviewState };
type Journal = { messages: Message[]; events: Event[]; acknowledged: number };

export class Session {
  readonly root: string;
  readonly id: string;
  journal: Journal;
  state: ReviewState;
  lastPoll = 0;
  readonly started = Date.now();

  constructor(root: string) {
    this.root = root;
    this.id = randomUUID();
    const read = <T>(name: string, fallback: T): T => {
      const path = join(root, name);
      return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as T) : fallback;
    };
    if (existsSync(join(root, "events.json"))) {
      this.journal = read<Journal>("events.json", { messages: [], events: [], acknowledged: 0 });
    } else {
      const legacy = read<{ messages: Message[] }>("chat.json", { messages: [] }).messages;
      const latest = new Map<number, Message>();
      for (const message of legacy) latest.set(message.replyTo ?? message.id, message);
      const pending = [...latest.values()].filter((message) => message.role === "user");
      this.journal = {
        messages: legacy,
        events: pending.map((message, i) => ({ id: i + 1, type: "chat", message })),
        acknowledged: 0,
      };
    }
    this.state = read<ReviewState>("state.json", {});
  }

  write(name: string, contents: unknown) {
    const target = join(this.root, name);
    const tmp = `${target}.${process.pid}.tmp`;
    writeFileSync(tmp, `${JSON.stringify(contents, null, 2)}\n`);
    renameSync(tmp, target);
  }

  report() {
    return reportSchema.parse(JSON.parse(readFileSync(join(this.root, "report.json"), "utf8")));
  }

  version() {
    return statSync(join(this.root, "report.json")).mtimeMs;
  }
  get cursor() {
    return this.journal.events.at(-1)?.id ?? 0;
  }
  get listening() {
    return Date.now() - this.lastPoll < 15_000;
  }

  saveState(state: ReviewState) {
    if (
      !state ||
      typeof state !== "object" ||
      Array.isArray(state) ||
      !state.answers ||
      typeof state.answers !== "object"
    ) {
      throw new Error("state.answers must be an object");
    }
    this.state = { ...state, updated: new Date().toISOString() };
    this.write("state.json", this.state);
    this.journal.events.push({ id: this.cursor + 1, type: "state", state: this.state });
    this.write("events.json", this.journal);
    return this.state;
  }

  append(input: {
    role?: unknown;
    text?: unknown;
    quote?: unknown;
    replyTo?: unknown;
    key?: unknown;
  }) {
    if (typeof input.text !== "string" || !input.text.trim() || input.text.length > 4_000)
      throw new Error("text must contain 1–4000 characters");
    if (input.role !== undefined && input.role !== "user" && input.role !== "agent")
      throw new Error("invalid role");
    if (input.quote !== undefined && (typeof input.quote !== "string" || input.quote.length > 500))
      throw new Error("quote exceeds 500 characters");
    if (input.key !== undefined && (typeof input.key !== "string" || input.key.length > 200))
      throw new Error("invalid message key");
    const existing =
      input.key && this.journal.messages.find((message) => message.key === input.key);
    if (existing) return existing;
    let replyTo: number | undefined;
    if (input.replyTo !== undefined) {
      const parent = this.journal.messages.find((message) => message.id === input.replyTo);
      if (!parent) throw new Error("unknown replyTo");
      replyTo = parent.replyTo ?? parent.id;
    }
    if (input.role === "agent" && replyTo === undefined)
      throw new Error("agent replies require replyTo");
    const message: Message = {
      id: (this.journal.messages.at(-1)?.id ?? 0) + 1,
      ts: new Date().toISOString(),
      role: input.role ?? "user",
      text: input.text.trim(),
      ...(typeof input.quote === "string" ? { quote: input.quote } : {}),
      ...(typeof input.key === "string" ? { key: input.key } : {}),
      ...(replyTo === undefined ? {} : { replyTo }),
    };
    this.journal.messages.push(message);
    if (message.role === "user")
      this.journal.events.push({ id: this.cursor + 1, type: "chat", message });
    this.write("events.json", this.journal);
    this.write("chat.json", { messages: this.journal.messages, next: message.id + 1 });
    return message;
  }

  poll(after = this.journal.acknowledged) {
    if (!Number.isInteger(after) || after < 0 || after > this.cursor)
      throw new Error("invalid event cursor");
    this.lastPoll = Date.now();
    return {
      session: this.id,
      cursor: this.cursor,
      events: this.journal.events.filter((event) => event.id > after),
      state: this.state,
    };
  }

  acknowledge(cursor: number) {
    if (!Number.isInteger(cursor) || cursor < this.journal.acknowledged || cursor > this.cursor)
      throw new Error("invalid acknowledgement");
    this.journal.acknowledged = cursor;
    this.lastPoll = Date.now();
    this.write("events.json", this.journal);
  }

  expired(now: number, leaseMs: number, ownerPid?: number) {
    if (ownerPid) {
      try {
        process.kill(ownerPid, 0);
      } catch {
        return true;
      }
    }
    return now - (this.lastPoll || this.started) > leaseMs;
  }
}
