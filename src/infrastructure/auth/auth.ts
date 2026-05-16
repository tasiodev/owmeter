import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/infrastructure/database/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID!,
      clientSecret: process.env.AUTH_GITHUB_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  // JWT strategy = edge-compatible (proxy can decode without DB hit)
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    jwt({ token, user }) {
      // On first sign-in, `user` is populated from DB
      if (user?.id) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.id && typeof token.id === "string") {
        session.user.id = token.id;
      }
      return session;
    },
  },
});
