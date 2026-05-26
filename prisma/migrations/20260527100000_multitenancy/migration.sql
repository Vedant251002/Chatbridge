-- Full multi-tenancy: scope conversations, messages, knowledge documents,
-- and the bot prompt to a user. Existing rows have no owner so we wipe them
-- — every user starts fresh after this migration.

-- Wipe pre-tenancy data. Cascading order matters even with TRUNCATE...CASCADE
-- since some of these may be empty.
TRUNCATE
  "knowledge_chunks",
  "knowledge_documents",
  "messages",
  "conversations",
  "bot_configs"
RESTART IDENTITY CASCADE;

-- ─── conversations: scope to user, unique (user, phone) ─────────────────────
ALTER TABLE "conversations" ADD COLUMN "user_id" UUID NOT NULL;

CREATE INDEX "conversations_user_id_idx" ON "conversations"("user_id");
CREATE UNIQUE INDEX "conversations_user_id_phone_key" ON "conversations"("user_id", "phone");

ALTER TABLE "conversations"
    ADD CONSTRAINT "conversations_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── knowledge_documents: scope to user ─────────────────────────────────────
ALTER TABLE "knowledge_documents" ADD COLUMN "user_id" UUID NOT NULL;

CREATE INDEX "knowledge_documents_user_id_idx" ON "knowledge_documents"("user_id");

ALTER TABLE "knowledge_documents"
    ADD CONSTRAINT "knowledge_documents_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── bot_configs: one row per user, drop the singleton id ───────────────────
ALTER TABLE "bot_configs" DROP CONSTRAINT "bot_configs_pkey";
ALTER TABLE "bot_configs" DROP COLUMN "id";
ALTER TABLE "bot_configs" ADD COLUMN "id" UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE "bot_configs" ADD CONSTRAINT "bot_configs_pkey" PRIMARY KEY ("id");

ALTER TABLE "bot_configs" ADD COLUMN "user_id" UUID NOT NULL;
CREATE UNIQUE INDEX "bot_configs_user_id_key" ON "bot_configs"("user_id");

ALTER TABLE "bot_configs"
    ADD CONSTRAINT "bot_configs_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
