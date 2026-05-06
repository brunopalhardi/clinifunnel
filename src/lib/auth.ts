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
          permissions: (user.permissions as never) ?? null,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        const u = user as {
          role: string;
          clinicId: string;
          clinicName: string;
          mustChangePassword: boolean;
          permissions: unknown;
        };
        token.role = u.role;
        token.clinicId = u.clinicId;
        token.clinicName = u.clinicName;
        token.mustChangePassword = u.mustChangePassword;
        token.permissions = (u.permissions as never) ?? null;
      }
      // Quando user troca senha ou tem permissions atualizadas pelo admin,
      // refaz load do DB. Permissions e cache leve no token, atualiza on update.
      if (trigger === "update" && token.sub) {
        const fresh = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { mustChangePassword: true, permissions: true },
        });
        if (fresh) {
          token.mustChangePassword = fresh.mustChangePassword;
          token.permissions = (fresh.permissions as never) ?? null;
        }
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
        u.permissions = (token.permissions as never) ?? null;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};
