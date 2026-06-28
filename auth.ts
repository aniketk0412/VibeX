// Auth.js (NextAuth v5) — Google OAuth + email magic links, backed by the Prisma adapter
// with database sessions. Secrets are read from env (AUTH_GOOGLE_ID / _SECRET, AUTH_RESEND_KEY).

import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  pages: { signIn: "/signin" },
  providers: [
    Google,
    Resend({ from: process.env.AUTH_EMAIL_FROM ?? "Vibex <onboarding@resend.dev>" }),
  ],
  callbacks: {
    // Database sessions: expose the user id so server components can scope queries.
    session({ session, user }) {
      if (session.user) session.user.id = user.id;
      return session;
    },
  },
});
