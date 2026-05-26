import { prisma } from "./prisma";

// Tenancy guards. Each helper either returns the row when the signed-in
// user owns it, or null. Routes use this to convert "not yours" into
// 404 — never leaking the row's existence to non-owners.

export async function findOwnedConversation(userId: string, id: string) {
  const row = await prisma.conversation.findFirst({
    where: { id, userId },
  });
  return row;
}

export async function findOwnedKnowledgeDocument(userId: string, id: string) {
  const row = await prisma.knowledgeDocument.findFirst({
    where: { id, userId },
  });
  return row;
}
