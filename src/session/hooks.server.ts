import { building } from "$app/env";
import { json } from "@sveltejs/kit";
import type { Handle } from "@sveltejs/kit/hooks";
import { startLifecycle } from "#lib/server/runtime";

if (!building) startLifecycle();

export const handle: Handle = async ({ event, resolve }) => {
  const host = event.url.hostname;
  if (host !== "127.0.0.1" && host !== "localhost" && host !== "[::1]")
    return json({ error: "Unexpected host" }, { status: 421 });
  const origin = event.request.headers.get("origin");
  // adapter-node defaults to HTTPS when there is no proxy protocol header;
  // this service is explicitly bound to local HTTP by the launcher.
  const localOrigin = `http://${event.request.headers.get("host")}`;
  if (origin && origin !== localOrigin)
    return json({ error: "Unexpected origin" }, { status: 403 });
  const response = await resolve(event);
  response.headers.set("Cache-Control", "no-store");
  return response;
};
