import { NextRequest } from "next/server";
import { createRealtimeSubscriber, realtimeChannel } from "@/lib/realtime";

// Server-Sent Events. The browser holds a long-lived connection and the
// server streams events as they happen. One Redis subscriber per request —
// closed when the client disconnects.

export const runtime = "nodejs"; // Edge runtime can't use ioredis
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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
