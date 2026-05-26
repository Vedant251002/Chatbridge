import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, handleError, ok } from "@/lib/api-helpers";
import { enqueueIngest } from "@/lib/queue";

// pdf-parse ships with a CJS index that does test-mode init when require'd
// without args; we bypass that by importing the lib path directly.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (
  buf: Buffer
) => Promise<{ text: string; numpages: number }>;

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
      const parsed = await pdfParse(buf);
      text = parsed.text;
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
