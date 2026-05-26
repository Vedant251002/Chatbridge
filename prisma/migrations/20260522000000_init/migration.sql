CREATE TABLE "conversations" (
    "id" UUID NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "thread_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "sender" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "ai_output" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "conversations_phone_idx" ON "conversations"("phone");

CREATE INDEX "messages_conversation_id_idx" ON "messages"("conversation_id");

ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey"
    FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
