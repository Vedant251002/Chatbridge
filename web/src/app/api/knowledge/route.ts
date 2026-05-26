import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, handleError, ok } from "@/lib/api-helpers";
import { knowledgeUploadSchema } from "@/lib/validators";
import { enqueueIngest } from "@/lib/queue";
import { requireUser, UnauthorizedError } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();
    const docs = await prisma.knowledgeDocument.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    return ok(docs);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return fail(401, "UNAUTHORIZED", "Not signed in");
    }
    return handleError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = knowledgeUploadSchema.parse(await request.json());

    const doc = await prisma.knowledgeDocument.create({
      data: {
        userId: user.id,
        title: body.title,
        sourceType: body.sourceType,
        sourceUrl: body.sourceType === "url" ? body.sourceUrl : null,
        sourceText: body.sourceType === "url" ? "" : body.sourceText,
        status: "pending",
      },
    });

    await enqueueIngest(doc.id);
    return ok(doc, { status: 202 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return fail(401, "UNAUTHORIZED", "Not signed in");
    }
    if (error instanceof SyntaxError) return fail(400, "VALIDATION_ERROR", "Invalid JSON body");
    return handleError(error);
  }
}
