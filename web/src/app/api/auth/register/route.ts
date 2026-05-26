import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fail, handleError, ok } from "@/lib/api-helpers";
import { registerSchema } from "@/lib/validators";
import {
  createSession,
  hashPassword,
  setSessionCookie,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = registerSchema.parse(await request.json());
    const passwordHash = await hashPassword(body.password);

    const user = await prisma.user.create({
      data: {
        email: body.email,
        name: body.name,
        passwordHash,
      },
      select: { id: true, email: true, name: true, avatarUrl: true },
    });

    const token = await createSession(user.id);
    await setSessionCookie(token);

    return ok(user, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return fail(400, "VALIDATION_ERROR", "Invalid JSON body");
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return fail(409, "DUPLICATE", "An account with this email already exists");
    }
    return handleError(error);
  }
}
