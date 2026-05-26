import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, handleError, ok } from "@/lib/api-helpers";
import { agentReplySchema, uuidSchema } from "@/lib/validators";
import { enqueueOutbound, phoneToJid } from "@/lib/queue";
import { publishEvent } from "@/lib/realtime";

const AGENT_HEADER = "x-agent-id";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    uuidSchema.parse(id);
    const body = agentReplySchema.parse(await request.json());
    const agent = request.headers.get(AGENT_HEADER) ?? "agent";

    const conversation = await prisma.conversation.findUnique({ where: { id } });
    if (!conversation) {
      return fail(404, "NOT_FOUND", `Conversation '${id}' not found`);
    }

    // Persist first so the agent's reply isn't lost if WhatsApp delivery
    // is delayed. The outbound queue will retry up to 5 times.
    const created = await prisma.message.create({
      data: {
        conversationId: id,
        sender: "agent",
        message: body.text,
        aiOutput: { agent },
      },
    });
    await prisma.conversation.update({
      where: { id },
      data: { lastActivityAt: new Date() },
    });

    await enqueueOutbound({
      jid: phoneToJid(conversation.phone),
      text: body.text,
      conversationId: id,
    });

    await publishEvent({
      type: "message.created",
      conversationId: id,
      messageId: created.id,
    });

    return ok(created);
  } catch (error) {
    if (error instanceof SyntaxError) return fail(400, "VALIDATION_ERROR", "Invalid JSON body");
    return handleError(error);
  }
}
