import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, handleError, ok } from "@/lib/api-helpers";
import { paginationSchema } from "@/lib/validators";
import { requireUser, UnauthorizedError } from "@/lib/auth";

// Returns conversations ordered by most recent activity (HITL inbox order).
// Scoped to the signed-in user — only their conversations come back.
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const params = Object.fromEntries(request.nextUrl.searchParams);
    const { limit, offset } = paginationSchema.parse(params);

    const [rows, total] = await prisma.$transaction([
      prisma.conversation.findMany({
        where: { userId: user.id },
        orderBy: { lastActivityAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { id: true, sender: true, message: true, createdAt: true },
          },
        },
      }),
      prisma.conversation.count({ where: { userId: user.id } }),
    ]);

    const conversations = rows.map((row) => ({
      id: row.id,
      phone: row.phone,
      threadId: row.threadId,
      aiPaused: row.aiPaused,
      takenOverBy: row.takenOverBy,
      lastActivityAt: row.lastActivityAt,
      createdAt: row.createdAt,
      lastMessage: row.messages[0] ?? null,
    }));

    return ok(conversations, {
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return fail(401, "UNAUTHORIZED", "Not signed in");
    }
    return handleError(error);
  }
}
