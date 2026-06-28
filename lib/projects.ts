// Project queries — the count drives routing (0 → /new onboarding, ≥1 → dashboard).
import { prisma } from "@/lib/prisma";

export function getProjectCount(userId: string) {
  return prisma.project.count({ where: { userId } });
}

export function listProjects(userId: string) {
  return prisma.project.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });
}
