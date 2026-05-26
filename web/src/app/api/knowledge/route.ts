import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, handleError, ok } from "@/lib/api-helpers";
import { knowledgeUploadSchema } from "@/lib/validators";
import { enqueueIngest } from "@/lib/queue";

export async function GET() {
  try {
    const docs = await prisma.knowledgeDocument.findMany({
      orderBy: { createdAt: "desc" },
    });
    return ok(docs);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = knowledgeUploadSchema.parse(await request.json());

    const doc = await prisma.knowledgeDocument.create({
      data: {
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
    if (error instanceof SyntaxError) return fail(400, "VALIDATION_ERROR", "Invalid JSON body");
    return handleError(error);
  }
}
