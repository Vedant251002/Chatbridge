import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fail, handleError, ok } from "@/lib/api-helpers";
import { uuidSchema } from "@/lib/validators";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const validId = uuidSchema.parse(id);
    await prisma.allowedNumber.delete({ where: { id: validId } });
    return ok({ id: validId });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return fail(404, "NOT_FOUND", "Allowed number not found");
    }
    return handleError(error);
  }
}
