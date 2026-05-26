import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleError, ok } from "@/lib/api-helpers";
import { paginationSchema } from "@/lib/validators";

// Returns conversations ordered by most recent activity (HITL inbox order).
// Each row includes the last message preview and unread count proxy
// (count of inbound user messages with no reply after them).
export async function GET(request: NextRequest) {
  try {
    const params = Object.fromEntries(request.nextUrl.searchParams);
    const { limit, offset } = paginationSchema.parse(params);

    const [rows, total] = await prisma.$transaction([
      prisma.conversation.findMany({
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
      prisma.conversation.count(),
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
    return handleError(error);
  }
}
