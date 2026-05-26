import { NextRequest } from "next/server";
import { fail, handleError, ok } from "@/lib/api-helpers";
import { sendMessageSchema } from "@/lib/validators";
import { enqueueAdminInitiated } from "@/lib/queue";

// Async by design: enqueues a job that the Baileys backend processes.
// We return 202 with the job id; the actual reply is delivered via WhatsApp
// and stored in the messages table.
export async function POST(request: NextRequest) {
  try {
    const body = sendMessageSchema.parse(await request.json());
    const jobId = await enqueueAdminInitiated({ phone: body.phone, text: body.message });
    return ok({ jobId, status: "queued" });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return fail(400, "VALIDATION_ERROR", "Invalid JSON body");
    }
    return handleError(error);
  }
}
