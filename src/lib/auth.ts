import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

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
          console.log("[auth] Missing credentials");
          return null;
        }

        console.log("[auth] Login attempt:", credentials.email);

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { clinic: { select: { id: true, name: true } } },
        });

        if (!user) {
          console.log("[auth] User not found:", credentials.email);
          return null;
        }

        console.log("[auth] User found:", user.email, "id:", user.id);

        const valid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );

        if (!valid) {
          console.log("[auth] Invalid password for:", credentials.email);
          return null;
        }

        console.log("[auth] Login success:", credentials.email);
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          clinicId: user.clinicId,
          clinicName: user.clinic.name,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.clinicId = (user as { clinicId: string }).clinicId;
        token.clinicName = (user as { clinicName: string }).clinicName;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id: string }).id = token.sub as string;
        (session.user as { clinicId: string }).clinicId =
          token.clinicId as string;
        (session.user as { clinicName: string }).clinicName =
          token.clinicName as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};
