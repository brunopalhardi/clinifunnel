import crypto from "crypto";

// AES-256-GCM authenticated encryption.
// Formato armazenado: "v1:<iv-b64>:<ciphertext-b64>:<authtag-b64>"
// Prefixo "v1:" permite distinguir valores ja criptografados de plaintext legado
// e abre caminho pra "v2:" quando rotacionarmos a chave no futuro.

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_ENV = "INTEGRATION_TOKENS_KEY";
const PREFIX = "v1:";

let cachedKey: Buffer | null = null;

function loadKey(): Buffer {
  const raw = process.env[KEY_ENV];
  if (!raw) {
    throw new Error(
      `${KEY_ENV} env var nao definida. Gere com: openssl rand -base64 32`,
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      `${KEY_ENV} deve decodar para 32 bytes (got ${key.length}). Use: openssl rand -base64 32`,
    );
  }
  return key;
}

function key(): Buffer {
  if (!cachedKey) cachedKey = loadKey();
  return cachedKey;
}

export function encrypt(plain: string | null | undefined): string | null {
  if (plain == null || plain === "") return null;
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGO, key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${ciphertext.toString("base64")}:${tag.toString("base64")}`;
}

export function decrypt(stored: string | null | undefined): string | null {
  if (stored == null || stored === "") return null;
  if (!stored.startsWith(PREFIX)) {
    // Plaintext legado — retorna como esta. Sera re-encriptado no proximo write
    // (a extension do Prisma encripta data em update/create).
    return stored;
  }
  const parts = stored.slice(PREFIX.length).split(":");
  if (parts.length !== 3) {
    throw new Error(`crypto: formato invalido em valor armazenado`);
  }
  const [ivB64, ctB64, tagB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const ciphertext = Buffer.from(ctB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const decipher = crypto.createDecipheriv(ALGO, key(), iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plain.toString("utf8");
}

export function isEncrypted(stored: string | null | undefined): boolean {
  return typeof stored === "string" && stored.startsWith(PREFIX);
}

// Validacao "fail-fast" no boot. Chamada a partir de src/lib/prisma.ts.
export function assertKeyAvailable(): void {
  key();
}
