import "dotenv/config";
import { randomBytes, randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { mkdirSync, writeFileSync } from "node:fs";
import { db } from "../src/lib/db";
import { hash } from "../src/lib/auth";
import { fields, applicableFields } from "../src/lib/forms";
import { withRetry } from "../src/lib/retry";
const base = process.env.TEST_APP_URL || "http://127.0.0.1:3000";
const total = Number(process.env.LOAD_USERS || 100);
const tag = `LOAD_${Date.now()}`;
const unitIds: string[] = [],
  userIds: string[] = [];
let periodId = "";
async function main() {
  if (
    !["localhost", "127.0.0.1"].includes(
      new URL(process.env.DATABASE_URL!).hostname,
    ) ||
    !["localhost", "127.0.0.1"].includes(new URL(base).hostname)
  )
    throw new Error("Load script chỉ được dùng trên local.");
  if (!Number.isInteger(total) || total < 1 || total > 500)
    throw new Error("LOAD_USERS cần từ 1–500.");
  const sessions: string[] = [];
  for (let i = 0; i < total; i++) {
    const unit = await db().unit.create({
      data: {
        code: `${tag}_${i}`,
        name: `Đơn vị kiểm tải ${i}`,
        users: {
          create: {
            username: `${tag}_${i}`.toLowerCase(),
            passwordHash: "unused-load-test",
            mustChangePassword: false,
          },
        },
      },
      include: { users: true },
    });
    unitIds.push(unit.id);
    userIds.push(unit.users[0].id);
    const token = randomBytes(32).toString("base64url");
    sessions.push(token);
    await db().session.create({
      data: {
        tokenHash: hash(token),
        userId: unit.users[0].id,
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
  }
  const now = Date.now();
  const period = await db().period.create({
    data: {
      title: tag,
      kind: "WEEK",
      startAt: new Date(now - 86400000),
      endAt: new Date(now),
      opensAt: new Date(now - 3600000),
      dueAt: new Date(now + 1800000),
      closesAt: new Date(now + 3600000),
      formVersion: 1,
      formSnapshot: fields,
      assignments: {
        createMany: { data: unitIds.map((unitId) => ({ unitId })) },
      },
    },
  });
  periodId = period.id;
  const values = Object.fromEntries(
    applicableFields("WEEK", { training: false, staffing: false }).map((f) => [
      f.key,
      0,
    ]),
  );
  const start = performance.now();
  const results = await Promise.all(
    sessions.map(async (token, i) => {
      const sentAt = performance.now();
      const payload = {
        periodId,
        version: 0,
        formVersion: 1,
        idempotencyKey: randomUUID(),
        intent: "COMPLETE",
        values,
        optional: { training: false, staffing: false },
        notes: { highlights: "", difficulties: "", progress: "" },
        reporterName: `Người kiểm tải ${i}`,
        reporterPhone: "0901234567",
      };
      let attempts = 0;
      try {
        const result = await withRetry(async () => {
          attempts++;
          const response = await fetch(`${base}/api/reports`, {
            method: "POST",
            headers: {
              Cookie: `report_session=${token}`,
              Origin: new URL(process.env.APP_URL || base).origin,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });
          const data = await response.json();
          if (!response.ok)
            throw Object.assign(new Error(data.error), {
              status: response.status,
            });
          return { status: response.status, received: !!data.receipt };
        });
        return {
          ms: performance.now() - sentAt,
          ...result,
          cause: "",
          attempts,
        };
      } catch (error) {
        return {
          ms: performance.now() - sentAt,
          status: (error as { status?: number }).status || 0,
          received: false,
          cause: String(
            (error as { cause?: { code?: string; message?: string } }).cause
              ?.code || (error as Error).message,
          ),
          attempts,
        };
      }
    }),
  );
  const sorted = results.map((r) => r.ms).sort((a, b) => a - b);
  const count = await db().report.count({
    where: { assignment: { periodId } },
  });
  const revisions = await db().revision.count({
    where: { report: { assignment: { periodId } } },
  });
  const summary = {
    environment:
      "LOCAL PostgreSQL + local Next.js; NOT a Vercel/Prisma cloud benchmark; preauthenticated sessions; all users send once simultaneously with up to 3 transient retries; no login hashing measured",
    users: total,
    wallMs: Math.round(performance.now() - start),
    success: results.filter((r) => r.received).length,
    retried: results.filter((r) => r.attempts > 1).length,
    totalAttempts: results.reduce((sum, r) => sum + r.attempts, 0),
    errors: results
      .filter((r) => !r.received)
      .map((r) => ({ status: r.status, cause: r.cause })),
    p50Ms: Math.round(sorted[Math.floor(total * 0.5)]),
    p95Ms: Math.round(sorted[Math.min(total - 1, Math.floor(total * 0.95))]),
    p99Ms: Math.round(sorted[Math.min(total - 1, Math.floor(total * 0.99))]),
    reports: count,
    revisions,
    createdAt: new Date().toISOString(),
  };
  mkdirSync(".local", { recursive: true });
  writeFileSync(`.local/load-${total}.json`, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  if (
    count !== total ||
    revisions !== total ||
    results.some((r) => !r.received)
  )
    process.exitCode = 1;
}
async function cleanup() {
  await db().revision.deleteMany({ where: { unitId: { in: unitIds } } });
  await db().report.deleteMany({
    where: { assignment: { unitId: { in: unitIds } } },
  });
  await db().contact.deleteMany({ where: { unitId: { in: unitIds } } });
  await db().assignment.deleteMany({ where: { unitId: { in: unitIds } } });
  if (periodId) await db().period.delete({ where: { id: periodId } });
  await db().user.deleteMany({ where: { id: { in: userIds } } });
  await db().unit.deleteMany({ where: { id: { in: unitIds } } });
  await db().$disconnect();
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(cleanup);
