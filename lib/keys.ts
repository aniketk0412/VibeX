// BYOK key vault — per-user provider keys, encrypted at rest (AES-256-GCM via lib/crypto).
// Server-only.

import { prisma } from "@/lib/prisma";
import { encryptSecret, decryptSecret } from "@/lib/crypto";

export type ProviderId = "anthropic" | "openai" | "google" | "openrouter" | "github" | "vercel" | "netlify";

export const KEY_PROVIDERS: { id: ProviderId; label: string; hint: string }[] = [
  { id: "anthropic", label: "Anthropic (Claude)", hint: "sk-ant-…" },
  { id: "openrouter", label: "OpenRouter (free models)", hint: "sk-or-…" },
  { id: "openai", label: "OpenAI (GPT)", hint: "sk-…" },
  { id: "google", label: "Google (Gemini)", hint: "AIza…" },
  { id: "github", label: "GitHub (export)", hint: "ghp_… personal access token, repo scope" },
  { id: "vercel", label: "Vercel (deploy)", hint: "Vercel token — vercel.com/account/tokens" },
  { id: "netlify", label: "Netlify (deploy)", hint: "Netlify PAT — app.netlify.com/user/applications" },
];

export type UserKeys = Partial<Record<ProviderId, string>>;

// Decrypted keys for the engine.
export async function getUserKeys(userId: string): Promise<UserKeys> {
  const rows = await prisma.apiKey.findMany({ where: { userId } });
  const out: UserKeys = {};
  for (const r of rows) {
    try {
      out[r.provider as ProviderId] = decryptSecret({ ciphertext: r.ciphertext, iv: r.iv, authTag: r.authTag });
    } catch {
      /* skip a key we can't decrypt (e.g. ENCRYPTION_KEY rotated) */
    }
  }
  return out;
}

// Which providers have a key (no secrets) — for the settings UI.
export async function listKeyProviders(userId: string): Promise<ProviderId[]> {
  const rows = await prisma.apiKey.findMany({ where: { userId }, select: { provider: true } });
  return rows.map((r) => r.provider as ProviderId);
}

// Single decrypted key for a provider (e.g. the GitHub PAT for export). Returns null if unset.
export async function getUserKey(userId: string, provider: ProviderId): Promise<string | null> {
  const row = await prisma.apiKey.findUnique({ where: { userId_provider: { userId, provider } } });
  if (!row) return null;
  try {
    return decryptSecret({ ciphertext: row.ciphertext, iv: row.iv, authTag: row.authTag });
  } catch {
    return null;
  }
}

export async function saveUserKey(userId: string, provider: ProviderId, key: string) {
  const enc = encryptSecret(key.trim());
  await prisma.apiKey.upsert({
    where: { userId_provider: { userId, provider } },
    create: { userId, provider, ...enc },
    update: enc,
  });
}

export async function deleteUserKey(userId: string, provider: ProviderId) {
  await prisma.apiKey.deleteMany({ where: { userId, provider } });
}
