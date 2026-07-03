// CLI access tokens (vibex CLI / future desktop clients) — mint, list, revoke, resolve.
// Only a SHA-256 hash is stored; the plaintext (vx_<48 hex>) is shown exactly once at mint
// time. Bearer auth carries no ambient browser credentials, so routes that accept it are
// exempt from the same-origin (CSRF) check that guards the cookie path. Server-only.

import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

const TOKEN_RE = /^Bearer (vx_[a-f0-9]{48})$/;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Returns the plaintext token — the only time it ever exists outside the caller's clipboard.
export async function mintToken(userId: string, name: string): Promise<string> {
  const token = `vx_${randomBytes(24).toString("hex")}`;
  await prisma.accessToken.create({
    data: { userId, name: (name.trim() || "CLI token").slice(0, 64), tokenHash: hashToken(token) },
  });
  return token;
}

export async function listTokens(userId: string) {
  return prisma.accessToken.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, createdAt: true, lastUsedAt: true },
  });
}

export async function revokeToken(userId: string, tokenId: string) {
  await prisma.accessToken.deleteMany({ where: { id: tokenId, userId } });
}

// Authorization header → user id (or null). Touches lastUsedAt without blocking the request.
export async function resolveBearer(req: Request): Promise<string | null> {
  const m = TOKEN_RE.exec(req.headers.get("authorization") ?? "");
  if (!m) return null;
  const row = await prisma.accessToken.findUnique({ where: { tokenHash: hashToken(m[1]) } });
  if (!row) return null;
  prisma.accessToken
    .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {/* bookkeeping only */});
  return row.userId;
}
