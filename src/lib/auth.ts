import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

const log = logger.child({ scope: "auth" });

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          log.info("missing credentials");
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
          include: { clinic: { select: { id: true, name: true } } },
        });

        if (!user) {
          log.info({ email: credentials.email }, "user not found");
          return null;
        }

        const valid = await bcrypt.compare(
          credentials.password,
          user.passwordHash,
        );

        if (!valid) {
          log.info({ userId: user.id }, "invalid password");
          return null;
        }

        log.info({ userId: user.id }, "login success");
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          clinicId: user.clinicId,
          clinicName: user.clinic.name,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.role = (user as { role: string }).role;
        token.clinicId = (user as { clinicId: string }).clinicId;
        token.clinicName = (user as { clinicName: string }).clinicName;
        token.mustChangePassword = (
          user as { mustChangePassword: boolean }
        ).mustChangePassword;
      }
      // Quando user troca senha (POST /api/auth/change-password), chama
      // signIn com trigger=update — refazemos load do DB pra refletir flag.
      if (trigger === "update" && token.sub) {
        const fresh = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { mustChangePassword: true },
        });
        if (fresh) token.mustChangePassword = fresh.mustChangePassword;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const u = session.user as Record<string, unknown>;
        u.id = token.sub as string;
        u.role = token.role as string;
        u.clinicId = token.clinicId as string;
        u.clinicName = token.clinicName as string;
        u.mustChangePassword = (token.mustChangePassword as boolean) ?? false;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};
