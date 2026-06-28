// Single PrismaClient across hot reloads (dev) and the serverless boundary.
//
// Vibex shares a Neon database with another app and lives in the `vibex` Postgres schema.
// The Vercel↔Neon integration injects a managed DATABASE_URL *without* a schema param (and it
// can't be edited), so append `schema=vibex` at the connection level. Idempotent — a URL that
// already specifies a schema (e.g. local .env) is used as-is.

import { PrismaClient } from "@prisma/client";

function vibexDatabaseUrl(): string | undefined {
  const base = process.env.DATABASE_URL ?? process.env.POSTGRES_PRISMA_URL;
  if (!base) return undefined;
  if (/[?&]schema=/.test(base)) return base;
  return base + (base.includes("?") ? "&" : "?") + "schema=vibex";
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ datasourceUrl: vibexDatabaseUrl() });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
