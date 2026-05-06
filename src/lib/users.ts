import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const BCRYPT_ROUNDS = 10;
const TEMP_PASSWORD_LENGTH = 12;
// Charset sem caracteres ambiguos (0/O, 1/l/I) — facilita digitar do papel
// quando admin avisa user pelo telefone/whatsapp.
const TEMP_PASSWORD_CHARS =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

export function generateTemporaryPassword(): string {
  const bytes = crypto.randomBytes(TEMP_PASSWORD_LENGTH);
  let out = "";
  for (let i = 0; i < TEMP_PASSWORD_LENGTH; i++) {
    out += TEMP_PASSWORD_CHARS[bytes[i] % TEMP_PASSWORD_CHARS.length];
  }
  return out;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

interface CreateUserParams {
  email: string;
  name: string;
  clinicId: string;
  role?: string;
}

interface CreateUserResult {
  id: string;
  email: string;
  name: string;
  role: string;
  clinicId: string;
  // Senha em texto claro retornada UMA UNICA VEZ. Admin precisa entregar pro
  // user manualmente. Apos primeiro login + troca, nao tem como recuperar.
  temporaryPassword: string;
}

export async function createUserWithTempPassword(
  params: CreateUserParams,
): Promise<CreateUserResult> {
  const tempPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(tempPassword);
  const user = await prisma.user.create({
    data: {
      email: params.email.trim().toLowerCase(),
      name: params.name.trim(),
      passwordHash,
      role: params.role ?? "user",
      clinicId: params.clinicId,
      mustChangePassword: true,
    },
  });
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    clinicId: user.clinicId,
    temporaryPassword: tempPassword,
  };
}

export async function resetUserPasswordToTemp(
  userId: string,
): Promise<{ id: string; email: string; temporaryPassword: string }> {
  const tempPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(tempPassword);
  const user = await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, mustChangePassword: true },
    select: { id: true, email: true },
  });
  return { ...user, temporaryPassword: tempPassword };
}

const MIN_PASSWORD_LENGTH = 8;

export class WeakPasswordError extends Error {
  constructor() {
    super(`senha precisa ter no minimo ${MIN_PASSWORD_LENGTH} caracteres`);
    this.name = "WeakPasswordError";
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super("senha atual incorreta");
    this.name = "InvalidCredentialsError";
  }
}

// Troca de senha pelo proprio user. Exige conhecer a senha atual.
export async function changeOwnPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new WeakPasswordError();
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!user) throw new InvalidCredentialsError();
  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) throw new InvalidCredentialsError();
  const newHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: newHash, mustChangePassword: false },
  });
}
