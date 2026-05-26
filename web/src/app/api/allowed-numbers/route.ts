import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fail, handleError, ok } from "@/lib/api-helpers";
import { allowedNumberSchema } from "@/lib/validators";

function sanitizePhone(phone: string): string {
  const digits = phone.replace(/[\s\-().]/g, "");
  return digits.startsWith("+") ? digits : `+${digits}`;
}

export async function GET() {
  try {
    const items = await prisma.allowedNumber.findMany({
      orderBy: { createdAt: "desc" },
    });
    return ok(items);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = allowedNumberSchema.parse(await request.json());
    const phone = sanitizePhone(body.phone);
    const label = body.label?.trim() ? body.label.trim() : null;

    const created = await prisma.allowedNumber.create({
      data: { phone, label },
    });
    return ok(created, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return fail(400, "VALIDATION_ERROR", "Invalid JSON body");
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return fail(409, "DUPLICATE", "Phone number already in allowlist");
    }
    return handleError(error);
  }
}
