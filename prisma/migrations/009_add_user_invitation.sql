ALTER TABLE "usuario" ADD COLUMN "invitation_token_hash" VARCHAR(64), ADD COLUMN "invitation_expires_at" TIMESTAMPTZ(6);

CREATE UNIQUE INDEX "usuario_invitation_token_hash_key" ON "usuario"("invitation_token_hash");