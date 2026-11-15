ALTER TABLE "usuario"
ADD COLUMN "password_reset_token_hash" VARCHAR(64),
ADD COLUMN "password_reset_expires_at" TIMESTAMPTZ(6);

CREATE UNIQUE INDEX "usuario_password_reset_token_hash_key" ON "usuario"("password_reset_token_hash");