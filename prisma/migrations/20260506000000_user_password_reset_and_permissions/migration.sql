-- USR-1 foundation: campos pra forcar troca de senha + permissoes granulares
ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "permissions" JSONB;
