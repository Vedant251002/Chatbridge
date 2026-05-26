import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, handleError, ok } from "@/lib/api-helpers";
import { botConfigSchema } from "@/lib/validators";
import { requireUser, UnauthorizedError } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();
    const config = await prisma.botConfig.findUnique({ where: { userId: user.id } });
    return ok(config);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return fail(401, "UNAUTHORIZED", "Not signed in");
    }
    return handleError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = botConfigSchema.parse(await request.json());
    const updated = await prisma.botConfig.upsert({
      where: { userId: user.id },
      update: { prompt: body.prompt },
      create: { userId: user.id, prompt: body.prompt },
    });
    return ok(updated);
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
