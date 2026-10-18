import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { Session } from "../src/lib/server/session.ts";
import { navigation } from "../src/lib/navigation.ts";

test("unacknowledged events survive retries and restarts; duplicate reply keys do not append", () => {
  const root = mkdtempSync(join(tmpdir(), "report-state-test-"));
  try {
    const session = new Session(root);
    const question = session.append({ text: "Why this option?", key: "question" });
    const batch = session.poll();
    assert.deepEqual(session.poll().events, batch.events);
    const reply = session.append({
      role: "agent",
      replyTo: question.id,
      text: "Because…",
      key: "answer",
    });
    assert.equal(
      session.append({ role: "agent", replyTo: question.id, text: "Because…", key: "answer" }).id,
      reply.id,
    );
    const restarted = new Session(root);
    assert.equal(restarted.poll().events.length, 1);
    restarted.acknowledge(batch.cursor);
    assert.equal(new Session(root).poll().events.length, 0);
    assert.equal(restarted.journal.messages.length, 2);
    assert.throws(() => restarted.acknowledge(999));
    assert.throws(() => restarted.append({ text: "lost", replyTo: 999 }));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("autosaved decisions are available before submit; browser reads cannot renew an Agent lease", () => {
  const root = mkdtempSync(join(tmpdir(), "report-lease-test-"));
  try {
    writeFileSync(
      join(root, "report.json"),
      JSON.stringify({ lang: "en", title: "Example", summary: [], sections: [] }),
    );
    const session = new Session(root);
    session.saveState({ answers: { strategy: { value: "small" } }, submitted: false });
    assert.equal(new Session(root).state.submitted, false);
    session.report();
    session.version();
    assert.equal(session.expired(session.started + 2_000, 1_000), true);
    session.poll();
    assert.equal(session.listening, true);
    assert.equal(session.expired(session.lastPoll + 500, 1_000), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("TOC covers short reports, questions, and colliding explicit/generated ids", () => {
  const nav = navigation(
    {
      lang: "en",
      title: "Example",
      summary: [],
      sections: [
        { heading: "A", blocks: [] },
        { id: "sec-1", heading: "B", blocks: [] },
        { id: "review", heading: "C", blocks: [] },
      ],
      review: { questions: [{ id: "scope", type: "text", text: "What scope?" }] },
    },
    "To decide",
  );
  assert.equal(nav.entries.length, 5);
  assert.equal(new Set(nav.entries.map((entry) => entry.id)).size, 5);
  assert.equal(nav.sections[1]?.id, "sec-1");
  assert.equal(nav.questions[0]?.id, "question-scope");
});

test("older discussion files retain history and replay only unanswered follow-ups", () => {
  const root = mkdtempSync(join(tmpdir(), "report-upgrade-test-"));
  try {
    writeFileSync(
      join(root, "chat.json"),
      JSON.stringify({
        messages: [
          { id: 1, role: "user", text: "Question" },
          { id: 2, role: "agent", text: "Answer", replyTo: 1 },
          { id: 3, role: "user", text: "Follow-up", replyTo: 1 },
        ],
      }),
    );
    const session = new Session(root);
    assert.equal(session.journal.messages.length, 3);
    assert.equal(session.poll().events[0]?.message?.id, 3);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
