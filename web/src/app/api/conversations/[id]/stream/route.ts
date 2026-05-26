import { NextRequest } from "next/server";
import { createRealtimeSubscriber, realtimeChannel } from "@/lib/realtime";
import { fail } from "@/lib/api-helpers";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { findOwnedConversation } from "@/lib/ownership";

// Server-Sent Events. The browser holds a long-lived connection and the
// server streams events as they happen. One Redis subscriber per request —
// closed when the client disconnects.
//
// Tenancy: refuse to open a stream for a conversation the caller doesn't own.
// Otherwise a curl with a guessed UUID would let any signed-in user tail
// another user's chats.

export const runtime = "nodejs"; // Edge runtime can't use ioredis
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let user;
  try {
    user = await requireUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return fail(401, "UNAUTHORIZED", "Not signed in");
    }
    throw error;
  }

  const { id } = await params;
  const owned = await findOwnedConversation(user.id, id);
  if (!owned) {
    return fail(404, "NOT_FOUND", `Conversation '${id}' not found`);
  }

  const channel = realtimeChannel(id);

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const subscriber = createRealtimeSubscriber();

      const send = (data: string) => {
        try {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch {
          // controller already closed — nothing to do
        }
      };

      // Heartbeat keeps proxies/load balancers from killing the connection.
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          /* ignore */
        }
      }, 25_000);

      await subscriber.subscribe(channel);
      subscriber.on("message", (_channel, message) => {
        send(message);
      });

      // Initial hello so the client knows the connection is live
      send(JSON.stringify({ type: "stream.opened", conversationId: id }));

      const cleanup = async () => {
        clearInterval(heartbeat);
        try {
          await subscriber.unsubscribe(channel);
          subscriber.disconnect();
        } catch {
          /* ignore */
        }
        try {
          controller.close();
        } catch {
          /* ignore */
        }
      };

      request.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
