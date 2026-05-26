import { getCurrentUser } from "@/lib/auth";
import { ok } from "@/lib/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  return ok(user);
}
