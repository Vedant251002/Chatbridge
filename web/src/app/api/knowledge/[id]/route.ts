import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, handleError, ok } from "@/lib/api-helpers";
import { uuidSchema } from "@/lib/validators";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { findOwnedKnowledgeDocument } from "@/lib/ownership";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    uuidSchema.parse(id);
    const doc = await findOwnedKnowledgeDocument(user.id, id);
    if (!doc) return fail(404, "NOT_FOUND", `Document '${id}' not found`);

    const chunks = await prisma.knowledgeChunk.findMany({
      where: { documentId: id },
      orderBy: { ordinal: "asc" },
      select: { id: true, ordinal: true, content: true, tokenCount: true, createdAt: true },
    });

    return ok({ document: doc, chunks });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return fail(401, "UNAUTHORIZED", "Not signed in");
    }
    return handleError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    uuidSchema.parse(id);
    const doc = await findOwnedKnowledgeDocument(user.id, id);
    if (!doc) return fail(404, "NOT_FOUND", `Document '${id}' not found`);

    await prisma.knowledgeDocument.delete({ where: { id } });
    return ok({ id });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return fail(401, "UNAUTHORIZED", "Not signed in");
    }
    return handleError(error);
  }
}
