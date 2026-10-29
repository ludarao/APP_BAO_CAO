import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { Client } from "pg";
import { hash as passwordHash } from "bcryptjs";
import { db } from "../src/lib/db";
import { hash } from "../src/lib/auth";
import { applicableFields, fields } from "../src/lib/forms";
const original = new URL(process.env.DATABASE_URL!);
assert.ok(
  ["127.0.0.1", "localhost"].includes(original.hostname),
  "Reset tests require local PostgreSQL",
);
const database = `reset_test_${Date.now()}`;
const adminDb = new Client({ connectionString: original.toString() });
const isolated = new URL(original);
isolated.pathname = `/${database}`;
const base = "http://127.0.0.1:3101";
let server: ReturnType<typeof spawn> | undefined;
let assertions = 0;
const check = (value: unknown, message: string) => {
  assert.ok(value, message);
  assertions++;
};
async function request(cookie = "", data?: unknown, origin = true) {
  const response = await fetch(`${base}/api/admin/reset`, {
    method: data ? "POST" : "GET",
    headers: {
      Cookie: cookie,
      ...(data
        ? {
            "Content-Type": "application/json",
            ...(origin ? { Origin: base } : {}),
          }
        : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  return { status: response.status, data: await response.json() };
}
async function session(userId: string) {
  const token = randomBytes(32).toString("hex");
  await db().session.create({
    data: {
      tokenHash: hash(token),
      userId,
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  return `report_session=${token}`;
}
async function main() {
  await adminDb.connect();
  await adminDb.query(`CREATE DATABASE "${database}"`);
  process.env.DATABASE_URL = isolated.toString();
  process.env.DIRECT_URL = isolated.toString();
  const env = { ...process.env, APP_URL: base, DB_POOL_MAX: "4" };
  const migration = spawnSync(
    process.execPath,
    ["node_modules/prisma/build/index.js", "migrate", "deploy"],
    { env, encoding: "utf8" },
  );
  assert.equal(migration.status, 0, migration.stderr);
  server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--port",
      "3101",
      "--hostname",
      "127.0.0.1",
    ],
    { env, stdio: "ignore" },
  );
  for (let i = 0; i < 100; i++) {
    try {
      await fetch(base);
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  const password = randomBytes(20).toString("hex"),
    encoded = await passwordHash(password, 12);
  const admin = await db().user.create({
    data: {
      username: "reset_admin",
      role: "ADMIN",
      mustChangePassword: false,
      passwordHash: encoded,
    },
  });
  const other = await db().user.create({
    data: {
      username: "other_admin",
      role: "ADMIN",
      mustChangePassword: false,
      passwordHash: encoded,
    },
  });
  const adminCookie = await session(admin.id);
  const otherCookie = await session(other.id);
  const unit = await db().unit.create({
    data: { code: "RESET", name: "Disposable reset fixture" },
  });
  const user = await db().user.create({
    data: {
      username: "reset_unit",
      unitId: unit.id,
      passwordHash: encoded,
      mustChangePassword: false,
    },
  });
  const unitCookie = await session(user.id);
  const period = await db().period.create({
    data: {
      title: "Disposable",
      kind: "WEEK",
      startAt: new Date(),
      endAt: new Date(),
      opensAt: new Date(Date.now() - 60000),
      dueAt: new Date(Date.now() + 60000),
      closesAt: new Date(Date.now() + 120000),
      formSnapshot: fields,
    },
  });
  const assignment = await db().assignment.create({
    data: {
      unitId: unit.id,
      periodId: period.id,
      dueAt: new Date(Date.now() + 90000),
    },
  });
  const values = Object.fromEntries(
    applicableFields("WEEK", { training: null, staffing: null }).map((f) => [
      f.key,
      0,
    ]),
  );
  const payload = {
    periodId: period.id,
    formVersion: 1,
    values,
    notes: { highlights: "", difficulties: "", progress: "" },
    optional: { training: null, staffing: null },
    intent: "COMPLETE",
    version: 0,
    idempotencyKey: randomUUID(),
    reporterName: "Test reset",
    reporterPhone: "0901234567",
  };
  async function submit(cookie: string, body = payload) {
    return fetch(`${base}/api/reports`, {
      method: "POST",
      headers: {
        Cookie: cookie,
        Origin: base,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  }
  const initial = await submit(unitCookie);
  check(initial.status === 200, "Create complete report through API");
  check((await request()).status === 401, "Anonymous cannot inspect reset");
  check(
    (await request(unitCookie)).status === 403,
    "Unit cannot inspect reset",
  );
  const input = {
    mode: "REPORTS",
    confirmation: "XOA BAO CAO",
    password,
    requestId: randomUUID(),
  };
  check((await request(unitCookie, input)).status === 403, "Unit cannot reset");
  check(
    (await request(adminCookie, input, false)).status === 403,
    "CSRF rejected",
  );
  check(
    (await request(adminCookie, { ...input, confirmation: "" })).status === 400,
    "Missing confirmation rejected",
  );
  check(
    (await request(adminCookie, { ...input, mode: "BAD" })).status === 400,
    "Unknown scope rejected",
  );
  check(
    (await request(adminCookie, { ...input, password: "wrong" })).status ===
      400,
    "Wrong admin password rejected",
  );
  check((await db().report.count()) === 1, "Rejected attempts preserve data");
  const preview = await request(adminCookie);
  check(
    preview.data.counts.reports === 1 && preview.data.counts.units === 1,
    "Preview counts",
  );
  const blocker = new Client({ connectionString: isolated.toString() });
  await blocker.connect();
  await blocker.query("SELECT pg_advisory_lock_shared(701030)");
  async function waitForBlocked(count: number) {
    for (let i = 0; i < 100; i++) {
      const r = await blocker.query(
        "SELECT count(*)::int AS n FROM pg_locks WHERE locktype = 'advisory' AND objid = 701030 AND NOT granted AND database = (SELECT oid FROM pg_database WHERE datname = current_database())",
      );
      if (r.rows[0].n >= count) return;
      await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error("Timed out waiting for concurrent reset/submission locks");
  }
  let reset: Awaited<ReturnType<typeof request>>;
  try {
    const pendingReset = request(adminCookie, input);
    await waitForBlocked(1);
    const pendingSubmit = submit(unitCookie, {
      ...payload,
      version: 1,
      idempotencyKey: randomUUID(),
    });
    await waitForBlocked(2);
    await blocker.query("SELECT pg_advisory_unlock_shared(701030)");
    reset = await pendingReset;
    check(
      (await pendingSubmit).status === 401,
      "Submission authenticated before reset cannot recreate deleted data",
    );
  } finally {
    await blocker.query("SELECT pg_advisory_unlock_shared(701030)");
    await blocker.end();
  }
  check(
    reset.status === 200 &&
      reset.data.deleted.reports === 1 &&
      reset.data.deleted.revisions === 1,
    "Reports reset deletes data and revisions",
  );
  check(
    (await db().contact.count()) === 0 &&
      (await db().report.count()) === 0 &&
      (await db().revision.count()) === 0,
    "No report personal details remain",
  );
  check(
    (await db().unit.count()) === 1 &&
      (await db().user.count()) === 3 &&
      (await db().period.count()) === 1 &&
      (await db().assignment.count()) === 1,
    "Reports reset retains structure and accounts",
  );
  check(
    (
      await db().assignment.findUnique({ where: { id: assignment.id } })
    )?.dueAt?.getTime() === assignment.dueAt?.getTime(),
    "Individual deadline preserved",
  );
  check(
    (await submit(unitCookie)).status === 401,
    "Old unit session cannot recreate data",
  );
  check(
    (await fetch(`${base}/api/bootstrap`, { headers: { Cookie: adminCookie } }))
      .status === 200,
    "Admin remains signed in",
  );
  const freshCookie = await session(user.id);
  check(
    (await submit(freshCookie, { ...payload, idempotencyKey: randomUUID() }))
      .status === 200,
    "Unit may explicitly submit after reauthentication",
  );
  const repeat = await request(adminCookie, input);
  check(
    repeat.status === 200 &&
      repeat.data.repeated &&
      (await db().report.count()) === 1,
    "Retry does not delete new reports",
  );
  const fullInput = {
    mode: "ALL",
    confirmation: "XOA TOAN BO",
    password,
    requestId: randomUUID(),
  };
  // Use the second admin to avoid sharing the per-admin password-attempt limit.
  const resetAll = await request(otherCookie, fullInput);
  check(resetAll.status === 200, "Full reset succeeds");
  check(
    (await db().unit.count()) === 0 &&
      (await db().assignment.count()) === 0 &&
      (await db().period.count()) === 0,
    "Full reset removes units, assignments and periods",
  );
  check(
    (await db().report.count()) === 0 &&
      (await db().revision.count()) === 0 &&
      (await db().contact.count()) === 0,
    "Full reset removes all reporting details",
  );
  check(
    (await db().user.count()) === 2 && (await db().session.count()) === 2,
    "Both admin accounts and sessions survive",
  );
  check(
    (await db().reportingSchedule.count()) === 5,
    "Default schedules survive",
  );
  check(
    (await db().audit.count({ where: { action: "RESET_DATA" } })) === 2,
    "Reset audit preserved",
  );
  check(
    (await request(otherCookie, fullInput)).data.repeated,
    "Full reset retry idempotent",
  );
  const { syncSchedules } = await import("../src/lib/schedules");
  await syncSchedules();
  check(
    (await db().period.count()) > 50 &&
      (await db().unit.count()) === 0 &&
      (await db().assignment.count()) === 0,
    "Future schedule regenerates without old units or reports",
  );
  console.log(
    `PASS: ${assertions} reset assertions on disposable database ${database}.`,
  );
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    server?.kill("SIGTERM");
    await db().$disconnect();
    await adminDb
      .query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`)
      .catch(() => {});
    await adminDb.end();
  });
