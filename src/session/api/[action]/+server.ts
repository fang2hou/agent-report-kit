import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getSession } from "#lib/server/runtime";

const handle: RequestHandler = async ({ params, request, url }) => {
  const session = getSession();
  const action = params.action;
  const method = request.method;
  const agent =
    request.headers.get("authorization") === `Bearer ${process.env.REPORT_TOKEN}` &&
    !!process.env.REPORT_TOKEN;
  const protectedAction = ["poll", "ack", "close"].includes(action);
  if (protectedAction && !agent) return json({ error: "Agent token required" }, { status: 401 });
  try {
    if (method === "GET") {
      if (action === "report") return json(session.report());
      if (action === "version") return json({ version: session.version() });
      if (action === "state") return json(session.state);
      if (action === "status") return json({ session: session.id, listening: session.listening });
      if (action === "chat") {
        const since = Number(url.searchParams.get("since") ?? 0);
        return json({
          messages: session.journal.messages.filter((message) => message.id > since),
          cursor: session.journal.messages.at(-1)?.id ?? 0,
          listening: session.listening,
        });
      }
      if (action === "poll") {
        const after = url.searchParams.has("since")
          ? Number(url.searchParams.get("since"))
          : undefined;
        const wait = Math.min(5, Math.max(0, Number(url.searchParams.get("wait")) || 0));
        let result = session.poll(after);
        const until = Date.now() + wait * 1_000;
        while (!result.events.length && Date.now() < until && !request.signal.aborted) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          result = session.poll(after);
        }
        return json(result);
      }
    }
    if (method === "PUT" || method === "POST") {
      const raw = await request.text();
      if (Buffer.byteLength(raw) > 1_000_000)
        return json({ error: "Body too large" }, { status: 413 });
      const body = JSON.parse(raw || "{}");
      if (!body || typeof body !== "object" || Array.isArray(body))
        throw new Error("Expected an object");
      if (action === "state" && method === "PUT") return json(session.saveState(body));
      if (action === "chat" && method === "POST") {
        if (body.role === "agent" && !agent)
          return json({ error: "Agent token required" }, { status: 401 });
        return json(session.append(body));
      }
      if (action === "ack" && method === "POST") {
        session.acknowledge(body.cursor);
        return json({ acknowledged: body.cursor });
      }
      if (action === "close" && method === "POST") {
        setTimeout(() => process.kill(process.pid, "SIGTERM"), 100).unref();
        return json({ closed: true });
      }
    }
    return json({ error: "Unknown action or method" }, { status: 404 });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
};

export const GET = handle;
export const POST = handle;
export const PUT = handle;
