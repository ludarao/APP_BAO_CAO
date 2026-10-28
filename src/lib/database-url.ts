/** Marketplace injects a direct Prisma Postgres URL. Runtime requests use its pooler. */
export function runtimeDatabaseUrl(connectionString: string) {
  const url = new URL(connectionString);
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error(
      "DATABASE_URL cần là kết nối PostgreSQL trực tiếp, không phải Accelerate.",
    );
  }
  if (url.hostname === "db.prisma.io") url.hostname = "pooled.db.prisma.io";
  return url.toString();
}
