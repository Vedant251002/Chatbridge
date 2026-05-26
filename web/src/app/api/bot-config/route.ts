import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, handleError, ok } from "@/lib/api-helpers";
import { botConfigSchema } from "@/lib/validators";

const SINGLETON_ID = "default";

export async function GET() {
  try {
    const config = await prisma.botConfig.findUnique({ where: { id: SINGLETON_ID } });
    return ok(config);
  } catch (error) {
    return handleError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = botConfigSchema.parse(await request.json());
    const updated = await prisma.botConfig.upsert({
      where: { id: SINGLETON_ID },
      update: { prompt: body.prompt },
      create: { id: SINGLETON_ID, prompt: body.prompt },
    });
    return ok(updated);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return fail(400, "VALIDATION_ERROR", "Invalid JSON body");
    }
    return handleError(error);
  }
}
