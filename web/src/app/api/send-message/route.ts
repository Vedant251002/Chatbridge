import { NextRequest } from "next/server";
import { fail, handleError, ok } from "@/lib/api-helpers";
import { sendMessageSchema } from "@/lib/validators";
import { enqueueOutbound, phoneToJid } from "@/lib/queue";
import { requireUser, UnauthorizedError } from "@/lib/auth";

// Admin-initiated outbound message. The backend's outbound worker resolves
// the user's WhatsApp socket and delivers it. Async by design — returns 202.
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = sendMessageSchema.parse(await request.json());

    await enqueueOutbound({
      userId: user.id,
      jid: phoneToJid(body.phone),
      text: body.message,
    });

    return ok({ status: "queued" }, { status: 202 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return fail(401, "UNAUTHORIZED", "Not signed in");
    }
    if (error instanceof SyntaxError) {
      return fail(400, "VALIDATION_ERROR", "Invalid JSON body");
    }
    return handleError(error);
  }
}
