CREATE TABLE "allowed_numbers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "phone" VARCHAR(20) NOT NULL,
    "label" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "allowed_numbers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "allowed_numbers_phone_key" ON "allowed_numbers"("phone");
