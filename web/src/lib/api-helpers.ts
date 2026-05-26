import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function ok<T>(data: T, extra?: Record<string, unknown> & { status?: number }) {
  const { status, ...rest } = extra ?? {};
  return NextResponse.json(
    { success: true, data, ...rest },
    status ? { status } : undefined
  );
}

export function fail(
  status: number,
  code: string,
  message: string,
  fields?: Record<string, string[]>
) {
  return NextResponse.json(
    { success: false, error: { code, message, ...(fields ? { fields } : {}) } },
    { status }
  );
}

export function handleError(error: unknown) {
  if (error instanceof ZodError) {
    const fields = error.issues.reduce<Record<string, string[]>>((acc, issue) => {
      const path = issue.path.join(".") || "root";
      acc[path] = [...(acc[path] ?? []), issue.message];
      return acc;
    }, {});
    return fail(400, "VALIDATION_ERROR", "Validation failed", fields);
  }

  console.error("Unhandled API error:", error);
  return fail(500, "INTERNAL_ERROR", "An unexpected error occurred");
}
