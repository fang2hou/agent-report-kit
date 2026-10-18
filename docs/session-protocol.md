# Local report sessions

The SvelteKit service is the only writer. Agents use `tools/serve.ts` as an API
client; reading saved JSON is useful for inspection, but editing it while the
service runs bypasses its event and retry guarantees.

## Commands

Run from the kit or use `pnpm -C <kit>` from another directory.

| Command                                                                | Result                                                                                                                                     |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `report:start <dir> [--owner-pid PID] [--lease-seconds 60] [--port N]` | Validate/load report.json, compile the SvelteKit app, start or reuse its local service; print URL, PID, state path, and lifecycle settings |
| `report:poll <dir> [--since N] [--wait 5]`                             | Renew the Agent lease and return unacknowledged chat/state events plus current state; wait is bounded to 5 seconds                         |
| `node tools/serve.ts reply <dir> <message-id> <text> [--key K]`        | Persist an Agent reply in the incoming message's thread; retries use the same idempotency key                                              |
| `node tools/serve.ts ack <dir> <cursor>`                               | Confirm that every event through this cursor has been handled                                                                              |
| `node tools/serve.ts chat <dir> [--since N]`                           | Inspect messages; does not renew the lease                                                                                                 |
| `node tools/serve.ts status <dir>`                                     | Check process availability and recent Agent listening; does not renew the lease                                                            |
| `report:stop <dir>`                                                    | Close and verify termination; retain collected data                                                                                        |
| `export:html <report.json> <out.html>`                                 | Produce an offline, single-file report with no service requests                                                                            |
| `export:pdf <report.json> <out.pdf>`                                   | Print the same content with Chrome/Chromium; `CHROME_BIN` overrides discovery                                                              |

## Consumer loop

One Agent owns the cursor. Use a background subagent when the harness supports
it; otherwise keep the main Agent actively executing the collection loop.
Do not finish the turn and assume a background shell wakes the model.

1. Poll with `--wait 5`.
2. Read each event in order. Form autosaves are drafts; only a submitted state
   indicates the reader wants decisions processed. Unsent chat drafts are not
   transmitted.
3. Answer explanation requests with `reply`, targeting the incoming message id.
   Forward new decisions and modification requests to the main Agent.
4. Acknowledge the batch cursor after handling it. Repeat. On retry, unanswered
   events return again and a reply with the same key is not duplicated.
5. After handling submission and outstanding discussion, close explicitly and
   verify `running:false`. Also close on cancellation or an error path.

The page distinguishes a reachable service from an Agent that polled in the
last 15 seconds. A quiet loop still polls every 5 seconds; it need not produce
chat noise. Session expiry is 60 seconds without polling. An owning PID can be
supplied explicitly; the CLI otherwise searches its ancestors for a known
harness, and reports whether one was found. PID exit closes promptly; when
ownership cannot be established, lease expiry provides bounded cleanup.
Browsing, refresh checks, and message reads never renew that lease.

## Files and API

- `report.json` is content. Changes reload the local page without recompiling.
- `state.json` is the latest saved form, including `submitted` and `unanswered`.
- `events.json` persists messages, incoming events, and the acknowledged cursor.
- `chat.json` is a readable message snapshot, written by the service.
- `.server.json` stores contact information and a local Agent token. The CLI
  omits the token from its printed output; service closure removes this file.
- `.server.log` remains for diagnostics. Closing preserves all content and data.

SvelteKit exposes `/api/report`, `/api/version`, `/api/state` (GET/PUT),
`/api/chat` (GET/POST), `/api/status`, `/api/poll`, `/api/ack`, and `/api/close`.
Agent polling, acknowledgement, Agent-role messages, and close require the
token. Browser writes are checked against the local origin. Each new incoming
event has a monotonically increasing event id; message ids are a separate
sequence. `replyTo` resolves to a root thread, while the reply's retry key
defaults to the incoming message id.

Exports share components but contain no runtime connection, polling, or chat.
Offline form drafts remain in the reader's browser; PDF prints question text
and choices and expands evidence details. PDF is a document, not a live form.
