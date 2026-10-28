import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { runtimeDatabaseUrl } from "./database-url";
const globalDb = globalThis as unknown as { reportDb?: PrismaClient };
export function db() {
  if (!process.env.DATABASE_URL)
    throw new Error(
      "Chưa cấu hình DATABASE_URL. Xem README để kết nối Prisma Postgres.",
    );
  if (!globalDb.reportDb)
    globalDb.reportDb = new PrismaClient({
      adapter: new PrismaPg({
        connectionString: runtimeDatabaseUrl(process.env.DATABASE_URL),
        max: Number(process.env.DB_POOL_MAX || 2),
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 10000,
      }),
    });
  return globalDb.reportDb;
}
