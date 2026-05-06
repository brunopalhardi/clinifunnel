// Setup global pra tests. Roda uma vez antes da suite.
//
// Defaults seguros pra unit tests que nao tocam DB/Redis/network — varias
// libs (crypto, oauth) leem env e crashariam sem essas vars setadas.

process.env.NEXTAUTH_SECRET ??= "test-secret-32-bytes-minimum-length-ok";
// 32 bytes base64 = 44 chars. Chave dummy fixa pra crypto.ts em testes.
process.env.INTEGRATION_TOKENS_KEY ??= "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
