import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, handleError, ok } from "@/lib/api-helpers";
import { togglePauseSchema, uuidSchema } from "@/lib/validators";
import { publishEvent } from "@/lib/realtime";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { findOwnedConversation } from "@/lib/ownership";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    uuidSchema.parse(id);
    const body = togglePauseSchema.parse(await request.json());
    const agent = user.name || user.email;

    const existing = await findOwnedConversation(user.id, id);
    if (!existing) return fail(404, "NOT_FOUND", `Conversation '${id}' not found`);

    if (existing.aiPaused === body.paused) {
      return ok(existing);
    }

    const updated = await prisma.conversation.update({
      where: { id },
      data: {
        aiPaused: body.paused,
        takenOverBy: body.paused ? agent : null,
        lastActivityAt: new Date(),
      },
    });

    // Lifecycle marker so agents see takeover/handback in the timeline
    await prisma.message.create({
      data: {
        conversationId: id,
        sender: "system",
        message: body.paused
          ? `AI paused — ${agent} took over the conversation`
          : `AI resumed — handoff back to bot`,
      },
    });

    await publishEvent(
      body.paused
        ? { type: "conversation.paused", conversationId: id, agent }
        : { type: "conversation.resumed", conversationId: id }
    );

    return ok(updated);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return fail(401, "UNAUTHORIZED", "Not signed in");
    }
    if (error instanceof SyntaxError) return fail(400, "VALIDATION_ERROR", "Invalid JSON body");
    return handleError(error);
  }
}
