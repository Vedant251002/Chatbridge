import { z } from "zod";

export const sendMessageSchema = z.object({
  phone: z.string().regex(/^\+?[1-9]\d{6,19}$/, "Invalid phone number format"),
  message: z.string().min(1, "Message cannot be empty").max(4096),
});

export const allowedNumberSchema = z.object({
  phone: z.string().regex(/^\+?[1-9]\d{6,19}$/, "Invalid phone number format"),
  label: z.string().trim().max(100).optional().nullable(),
});

export const botConfigSchema = z.object({
  prompt: z
    .string()
    .min(1, "Prompt cannot be empty")
    .max(4000, "Prompt must be 4000 characters or less"),
});

export const paginationSchema = z.object({
  limit: z.coerce.number().min(1).max(200).default(50),
  offset: z.coerce.number().min(0).default(0),
});

export const uuidSchema = z.string().uuid("Must be a valid UUID");

export const agentReplySchema = z.object({
  text: z.string().min(1, "Reply cannot be empty").max(4096),
});

export const togglePauseSchema = z.object({
  paused: z.boolean(),
});

export const knowledgeUploadSchema = z.discriminatedUnion("sourceType", [
  z.object({
    sourceType: z.literal("text"),
    title: z.string().min(1).max(200),
    sourceText: z.string().min(1).max(500_000),
  }),
  z.object({
    sourceType: z.literal("markdown"),
    title: z.string().min(1).max(200),
    sourceText: z.string().min(1).max(500_000),
  }),
  z.object({
    sourceType: z.literal("url"),
    title: z.string().min(1).max(200),
    sourceUrl: z.string().url().max(2048),
  }),
]);
