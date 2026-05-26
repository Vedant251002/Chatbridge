import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, handleError, ok } from "@/lib/api-helpers";
import { uuidSchema } from "@/lib/validators";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { findOwnedConversation } from "@/lib/ownership";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const user = await requireUser();
    const { conversationId } = await params;
    uuidSchema.parse(conversationId);

    const conversation = await findOwnedConversation(user.id, conversationId);
    if (!conversation) {
      return fail(404, "NOT_FOUND", `Conversation with id '${conversationId}' not found`);
    }

    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
    });

    return ok(messages);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return fail(401, "UNAUTHORIZED", "Not signed in");
    }
    return handleError(error);
  }
}
