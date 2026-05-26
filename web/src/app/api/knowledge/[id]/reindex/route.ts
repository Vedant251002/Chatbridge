import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, handleError, ok } from "@/lib/api-helpers";
import { uuidSchema } from "@/lib/validators";
import { enqueueIngest } from "@/lib/queue";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    uuidSchema.parse(id);
    const doc = await prisma.knowledgeDocument.findUnique({ where: { id } });
    if (!doc) return fail(404, "NOT_FOUND", `Document '${id}' not found`);

    await prisma.knowledgeDocument.update({
      where: { id },
      data: { status: "pending", errorMsg: null },
    });
    await enqueueIngest(id);
    return ok({ id, status: "queued" });
  } catch (error) {
    return handleError(error);
  }
}
