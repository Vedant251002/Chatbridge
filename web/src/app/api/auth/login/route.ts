import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, handleError, ok } from "@/lib/api-helpers";
import { loginSchema } from "@/lib/validators";
import {
  createSession,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = loginSchema.parse(await request.json());

    const user = await prisma.user.findUnique({
      where: { email: body.email },
    });

    // Same response for "user not found" and "wrong password" so an
    // attacker can't enumerate accounts. We still run verifyPassword on
    // a dummy hash when the user is missing to keep timing roughly equal.
    const dummy =
      "scrypt:00000000000000000000000000000000:" + "0".repeat(128);
    const stored = user?.passwordHash ?? dummy;
    const valid = await verifyPassword(body.password, stored);

    if (!user || !valid) {
      return fail(401, "INVALID_CREDENTIALS", "Email or password is incorrect");
    }

    const token = await createSession(user.id);
    await setSessionCookie(token);

    return ok({
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return fail(400, "VALIDATION_ERROR", "Invalid JSON body");
    }
    return handleError(error);
  }
}
