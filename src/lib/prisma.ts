import { PrismaClient } from "@prisma/client";
import { assertKeyAvailable, decrypt, encrypt } from "./crypto";

// Validacao fail-fast no boot. Sem INTEGRATION_TOKENS_KEY o app nao sobe —
// melhor crashar cedo do que tentar gravar token e falhar no meio do request.
assertKeyAvailable();

// Campos sensiveis em Clinic. Encriptados automaticamente no write,
// decriptados automaticamente no read via $extends.
const TOKEN_FIELDS = [
  "kommoToken",
  "clinicorpToken",
  "metaAccessToken",
  "googleAdsRefreshToken",
] as const;

type TokenData = Partial<Record<(typeof TOKEN_FIELDS)[number], unknown>>;

function encryptTokens<T extends TokenData>(data: T): T {
  const out = { ...data } as TokenData;
  for (const f of TOKEN_FIELDS) {
    const v = out[f];
    // Strings vazias e null/undefined ficam como estao (encrypt retorna null
    // pra esses casos, o que mantem o comportamento atual).
    if (typeof v === "string" && v.length > 0) {
      out[f] = encrypt(v);
    }
  }
  return out as T;
}

function makeClient() {
  return new PrismaClient().$extends({
    name: "encrypt-clinic-tokens",
    query: {
      clinic: {
        async create({ args, query }) {
          if (args.data) args.data = encryptTokens(args.data);
          return query(args);
        },
        async update({ args, query }) {
          if (args.data) args.data = encryptTokens(args.data);
          return query(args);
        },
        async upsert({ args, query }) {
          if (args.create) args.create = encryptTokens(args.create);
          if (args.update) args.update = encryptTokens(args.update);
          return query(args);
        },
        async updateMany({ args, query }) {
          if (args.data) args.data = encryptTokens(args.data);
          return query(args);
        },
      },
    },
    result: {
      clinic: {
        kommoToken: {
          needs: { kommoToken: true },
          // Schema: kommoToken e String (nao-null). decrypt sempre retorna string
          // pra input nao-vazio. Fallback "" cobre caso defensivo.
          compute({ kommoToken }) {
            return decrypt(kommoToken) ?? "";
          },
        },
        clinicorpToken: {
          needs: { clinicorpToken: true },
          compute({ clinicorpToken }) {
            return decrypt(clinicorpToken);
          },
        },
        metaAccessToken: {
          needs: { metaAccessToken: true },
          compute({ metaAccessToken }) {
            return decrypt(metaAccessToken);
          },
        },
        googleAdsRefreshToken: {
          needs: { googleAdsRefreshToken: true },
          compute({ googleAdsRefreshToken }) {
            return decrypt(googleAdsRefreshToken);
          },
        },
      },
    },
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof makeClient> | undefined;
};

export const prisma = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
