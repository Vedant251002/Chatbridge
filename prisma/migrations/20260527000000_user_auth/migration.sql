-- Users + sessions for email/password admin login.
-- This migration also scopes `allowed_numbers` to a user. The other domain
-- tables (conversations, knowledge, bot_configs) are scoped in the next
-- migration so that DBs which already applied this one cleanly upgrade.

CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatar_url" TEXT,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

CREATE TABLE "sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

ALTER TABLE "sessions"
    ADD CONSTRAINT "sessions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Scope allowed_numbers to a user. Existing rows have no owner so we drop them.
DELETE FROM "allowed_numbers";

ALTER TABLE "allowed_numbers" ADD COLUMN "user_id" UUID NOT NULL;

DROP INDEX IF EXISTS "allowed_numbers_phone_key";
CREATE UNIQUE INDEX "allowed_numbers_user_id_phone_key" ON "allowed_numbers"("user_id", "phone");
CREATE INDEX "allowed_numbers_user_id_idx" ON "allowed_numbers"("user_id");

ALTER TABLE "allowed_numbers"
    ADD CONSTRAINT "allowed_numbers_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
