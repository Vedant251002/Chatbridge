CREATE TABLE "bot_configs" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "prompt" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bot_configs_pkey" PRIMARY KEY ("id")
);
