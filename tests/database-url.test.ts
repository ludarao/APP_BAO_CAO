import { expect, it } from "vitest";
import { runtimeDatabaseUrl } from "../src/lib/database-url";

it("dùng pooler cho URL trực tiếp Prisma mà không đổi credential hoặc SSL", () => {
  const url = new URL(
    runtimeDatabaseUrl(
      "postgres://example:example%40pw@db.prisma.io:5432/postgres?sslmode=require",
    ),
  );
  expect(url.hostname).toBe("pooled.db.prisma.io");
  expect(url.password).toBe("example%40pw");
  expect(url.searchParams.get("sslmode")).toBe("require");
});
it("giữ nguyên database local và URL đã pooled", () => {
  for (const url of [
    "postgresql://local:example@127.0.0.1:54329/reports",
    "postgres://example:pw@pooled.db.prisma.io:5432/postgres?sslmode=require",
  ]) {
    expect(runtimeDatabaseUrl(url)).toBe(url);
  }
});
it("không nhận URL Accelerate vào pg adapter", () => {
  expect(() =>
    runtimeDatabaseUrl(
      "prisma+postgres://accelerate.prisma-data.net/?api_key=example",
    ),
  ).toThrow();
});
