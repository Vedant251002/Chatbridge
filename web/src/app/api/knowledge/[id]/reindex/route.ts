import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, handleError, ok } from "@/lib/api-helpers";
import { uuidSchema } from "@/lib/validators";
import { enqueueIngest } from "@/lib/queue";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { findOwnedKnowledgeDocument } from "@/lib/ownership";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    uuidSchema.parse(id);
    const doc = await findOwnedKnowledgeDocument(user.id, id);
    if (!doc) return fail(404, "NOT_FOUND", `Document '${id}' not found`);

    await prisma.knowledgeDocument.update({
      where: { id },
      data: { status: "pending", errorMsg: null },
    });
    await enqueueIngest(id);
    return ok({ id, status: "queued" });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return fail(401, "UNAUTHORIZED", "Not signed in");
    }
    return handleError(error);
  }
}
