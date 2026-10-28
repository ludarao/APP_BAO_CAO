import EmbeddedPostgres from "embedded-postgres";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import dotenv from "dotenv";
dotenv.config({ quiet: true });
async function main() {
  mkdirSync(".local", { recursive: true });
  if (!existsSync(".env")) {
    const password = randomBytes(24).toString("hex");
    writeFileSync(
      ".env",
      `DATABASE_URL="postgresql://local:${password}@127.0.0.1:54329/reports"\nDIRECT_URL="postgresql://local:${password}@127.0.0.1:54329/reports"\nAPP_URL="http://localhost:3000"\nLOCAL_AUTH_BYPASS="true"\nADMIN_USERNAME="admin"\nADMIN_PASSWORD="${randomBytes(18).toString("base64url")}"\nDB_POOL_MAX="2"\nSEED_DEMO="true"\n`,
      { mode: 0o600 },
    );
    dotenv.config({ override: true, quiet: true });
  }
  const url = new URL(process.env.DATABASE_URL!);
  if (
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    url.port !== "54329"
  )
    throw new Error(
      "db:local chỉ dành cho database local cổng 54329. Không thay đổi cấu hình cloud.",
    );
  const pg = new EmbeddedPostgres({
    databaseDir: resolve(".local/postgres"),
    port: 54329,
    user: url.username,
    password: decodeURIComponent(url.password),
    persistent: true,
    postgresFlags: ["-h", "127.0.0.1"],
    onLog: () => {},
    onError: (e: unknown) => {
      const msg = String(e);
      if (/FATAL|PANIC/.test(msg)) console.error(msg);
    },
  });
  if (!existsSync(".local/postgres/PG_VERSION")) await pg.initialise();
  await pg.start();
  const client = pg.getPgClient();
  await client.connect();
  const found = await client.query(
    "SELECT 1 FROM pg_database WHERE datname = $1",
    ["reports"],
  );
  await client.end();
  if (!found.rowCount) await pg.createDatabase("reports");
  console.log(
    "Postgres local đã sẵn sàng tại 127.0.0.1:54329. Dữ liệu trong .local/postgres.",
  );
  console.log(
    "Tiếp theo: npm run db:migrate && npm run db:seed && npm run dev",
  );
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    await pg.stop();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  setInterval(() => {}, 60000);
}
main().catch((e) => {
  console.error(
    e instanceof Error
      ? e.message.replace(/postgresql:\/\/\S+/g, "[database URL]")
      : "Không mở được database local.",
  );
  process.exit(1);
});
