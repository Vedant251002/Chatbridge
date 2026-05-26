import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, handleError, ok } from "@/lib/api-helpers";
import { enqueueIngest } from "@/lib/queue";
import { PDFParse } from "pdf-parse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PDF_BYTES = 20 * 1024 * 1024; // 20 MB

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const titleRaw = form.get("title");

    if (!(file instanceof File)) {
      return fail(400, "VALIDATION_ERROR", "Missing 'file' field");
    }
    if (file.size > MAX_PDF_BYTES) {
      return fail(400, "VALIDATION_ERROR", `File exceeds ${MAX_PDF_BYTES} bytes`);
    }
    const title = typeof titleRaw === "string" && titleRaw.trim().length > 0
      ? titleRaw.trim().slice(0, 200)
      : file.name.slice(0, 200);

    const buf = Buffer.from(await file.arrayBuffer());

    let text = "";
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      const parser = new PDFParse({ data: buf });
      try {
        const result = await parser.getText();
        text = result.text;
      } finally {
        await parser.destroy();
      }
    } else {
      // Treat anything else as text (markdown, txt, etc.)
      text = buf.toString("utf-8");
    }

    if (!text.trim()) {
      return fail(400, "VALIDATION_ERROR", "Could not extract any text from the file");
    }

    const doc = await prisma.knowledgeDocument.create({
      data: {
        title,
        sourceType: "text",
        sourceUrl: null,
        sourceText: text,
        status: "pending",
      },
    });

    await enqueueIngest(doc.id);
    return ok(doc, { status: 202 });
  } catch (error) {
    return handleError(error);
  }
}
