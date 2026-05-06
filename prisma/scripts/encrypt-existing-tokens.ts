// Migration one-shot: criptografa tokens em texto claro de Clinics existentes.
//
// Rodar APOS deploy de v0.21.0 com INTEGRATION_TOKENS_KEY ja setada:
//   docker exec $(docker ps -q -f name=clinifunnel_web) \
//     npx tsx prisma/scripts/encrypt-existing-tokens.ts
//
// Idempotente: detecta valores ja com prefixo "v1:" e pula.
//
// Importante: usa PrismaClient *cru* (sem $extends) para escrever os valores
// ja-criptografados literalmente no banco. Se usasse `prisma` de @/lib/prisma,
// a extension chamaria encrypt() de novo, gerando "v1:enc(v1:enc(plain))".

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { encrypt, isEncrypted } from "../../src/lib/crypto";

type TokenField =
  | "kommoToken"
  | "clinicorpToken"
  | "metaAccessToken"
  | "googleAdsRefreshToken";

const FIELDS: TokenField[] = [
  "kommoToken",
  "clinicorpToken",
  "metaAccessToken",
  "googleAdsRefreshToken",
];

async function main() {
  const prisma = new PrismaClient();
  let totalUpdated = 0;
  const clinics = await prisma.clinic.findMany();
  console.log(`Found ${clinics.length} clinic(s)`);

  for (const c of clinics) {
    const patch: Partial<Record<TokenField, string>> = {};
    for (const f of FIELDS) {
      const v = c[f];
      if (typeof v === "string" && v.length > 0 && !isEncrypted(v)) {
        const enc = encrypt(v);
        if (enc) patch[f] = enc;
      }
    }
    if (Object.keys(patch).length === 0) {
      console.log(`[${c.id}] all encrypted, skipping`);
      continue;
    }
    await prisma.clinic.update({ where: { id: c.id }, data: patch });
    console.log(`[${c.id}] encrypted: ${Object.keys(patch).join(", ")}`);
    totalUpdated++;
  }

  console.log(`\nDone. ${totalUpdated}/${clinics.length} clinics updated.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
