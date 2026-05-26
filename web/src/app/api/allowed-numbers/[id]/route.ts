import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, handleError, ok } from "@/lib/api-helpers";
import { uuidSchema } from "@/lib/validators";
import { requireUser, UnauthorizedError } from "@/lib/auth";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const validId = uuidSchema.parse(id);

    // Scoped delete — returns count, gives us a clean 404 when the row
    // exists but belongs to someone else without leaking that detail.
    const result = await prisma.allowedNumber.deleteMany({
      where: { id: validId, userId: user.id },
    });
    if (result.count === 0) {
      return fail(404, "NOT_FOUND", "Allowed number not found");
    }
    return ok({ id: validId });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return fail(401, "UNAUTHORIZED", "Not signed in");
    }
    return handleError(error);
  }
}
