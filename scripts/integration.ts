import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import ExcelJS from "exceljs";
import { db } from "../src/lib/db";
import { applicableFields, timing } from "../src/lib/forms";

const base = process.env.TEST_APP_URL || "http://localhost:3000";
const tag = `TEST_${Date.now()}`;
const unitIds: string[] = [],
  periodIds: string[] = [],
  userIds: string[] = [];
let actorId = "",
  assertions = 0;
function check(value: unknown, message: string) {
  assert.ok(value, message);
  assertions++;
}
async function request(
  path: string,
  cookie = "",
  data?: unknown,
  method = "POST",
  origin = true,
) {
  const res = await fetch(`${base}${path}`, {
    method: data === undefined ? "GET" : method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(data === undefined
        ? {}
        : {
            "Content-Type": "application/json",
            ...(origin ? { Origin: new URL(base).origin } : {}),
          }),
    },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  const content = await res.json().catch(() => ({}));
  return {
    status: res.status,
    body: content,
    cookie: res.headers.get("set-cookie")?.split(";")[0] || cookie,
  };
}
async function main() {
  const host = new URL(process.env.DATABASE_URL!).hostname;
  if (
    !["localhost", "127.0.0.1"].includes(host) ||
    !["localhost", "127.0.0.1"].includes(new URL(base).hostname)
  )
    throw new Error("Integration test chỉ chạy với app và database local.");
  const adminPassword = randomBytes(18).toString("base64url");
  const actor = await db().user.create({
    data: {
      username: tag.toLowerCase(),
      passwordHash: await hash(adminPassword, 12),
      role: "ADMIN",
      mustChangePassword: false,
    },
  });
  actorId = actor.id;
  userIds.push(actor.id);
  check(
    (await request("/api/bootstrap")).status === 401,
    "Reject unauthenticated",
  );
  const login = await request("/api/auth/login", "", {
    username: actor.username,
    password: adminPassword,
  });
  check(login.status === 200, "Admin login");
  const adminCookie = login.cookie;
  check(
    (await request("/api/admin/units", adminCookie, {}, "POST", false))
      .status === 403,
    "CSRF protection",
  );
  const batchId = randomUUID();
  const rows = [
    {
      code: `${tag}_A`,
      name: "Đơn vị kiểm thử A",
      group: "Test",
      scope: "INCLUDES_CHILDREN",
    },
    {
      code: `${tag}_C`,
      name: "Cấp trung gian không được giao kỳ",
      parentCode: `${tag}_A`,
      group: "Test",
    },
    {
      code: `${tag}_B`,
      name: "Đơn vị kiểm thử B",
      parentCode: `${tag}_C`,
      group: "Test",
    },
  ];
  const imported = await request("/api/admin/units", adminCookie, {
    rows,
    batchId,
  });
  check(
    imported.status === 200 && imported.body.credentials.length === 3,
    "Bulk account creation",
  );
  const unitRecords = await db().unit.findMany({
    where: { code: { startsWith: tag } },
    orderBy: { code: "asc" },
    include: { users: true },
  });
  unitIds.push(...unitRecords.map((u) => u.id));
  userIds.push(...unitRecords.flatMap((u) => u.users.map((x) => x.id)));
  const repeated = await request("/api/admin/units", adminCookie, {
    rows,
    batchId,
  });
  check(
    repeated.status === 200 &&
      repeated.body.repeated &&
      repeated.body.credentials.length === 0,
    "Batch retry idempotent",
  );
  const cycle = await request("/api/admin/units", adminCookie, {
    rows: [{ ...rows[0], parentCode: `${tag}_B` }],
    batchId: randomUUID(),
  });
  check(cycle.status === 400, "Parent cycle rejected");
  const credentials = imported.body.credentials.find(
    (c: { code: string }) => c.code === `${tag}_A`,
  );
  const unitLogin = await request("/api/auth/login", "", {
    username: credentials.username,
    password: credentials.password,
  });
  check(
    unitLogin.status === 200 && unitLogin.body.mustChangePassword,
    "First login forces password change",
  );
  check(
    (await request("/api/reports", unitLogin.cookie, {})).status === 428,
    "Password change gate enforced server-side",
  );
  const changed = await request("/api/auth/password", unitLogin.cookie, {
    oldPassword: credentials.password,
    newPassword: "IntegrationTest!2026ABC",
  });
  check(changed.status === 200, "Password change");
  const unitCookie = changed.cookie;
  check(
    (await request("/api/bootstrap", unitLogin.cookie)).status === 401,
    "Old session revoked after password change",
  );
  check(
    (await request("/api/admin/units", unitCookie, {})).status === 403,
    "Unit cannot administer",
  );
  const now = Date.now();
  const periodResult = await request("/api/admin/periods", adminCookie, {
    title: tag,
    kind: "WEEK",
    startAt: new Date(now - 7 * 86400000).toISOString(),
    endAt: new Date(now).toISOString(),
    opensAt: new Date(now - 3600000).toISOString(),
    dueAt: new Date(now - 60000).toISOString(),
    closesAt: new Date(now + 3600000).toISOString(),
    unitIds: unitIds.slice(0, 2),
  });
  check(periodResult.status === 200, "Create report period");
  const period = periodResult.body.period;
  periodIds.push(period.id);
  const bootstrap = await request("/api/bootstrap", unitCookie);
  check(
    bootstrap.status === 200 &&
      bootstrap.body.assignments.length === 1 &&
      bootstrap.body.assignments[0].unitId === unitIds[0],
    "Unit sees own assignment only",
  );
  const values = Object.fromEntries(
    applicableFields("WEEK", { training: false, staffing: false }).map((f) => [
      f.key,
      0,
    ]),
  );
  values["23"] = 10;
  const payload = {
    periodId: period.id,
    formVersion: 1,
    version: 0,
    idempotencyKey: randomUUID(),
    intent: "DRAFT",
    values: {},
    optional: { training: false, staffing: false },
    notes: { highlights: "Test", difficulties: "", progress: "" },
    reporterName: "Người kiểm thử",
    reporterPhone: "0901234567",
  };
  check(
    (
      await request("/api/reports", unitCookie, {
        ...payload,
        periodId: "not-found",
      })
    ).status === 404,
    "Unknown period rejected",
  );
  check(
    (
      await request("/api/reports", unitCookie, {
        ...payload,
        values: { "23": -1 },
      })
    ).status === 400,
    "Reject negative values",
  );
  check(
    (
      await request("/api/reports", unitCookie, {
        ...payload,
        intent: "COMPLETE",
      })
    ).status === 400,
    "Reject incomplete submission",
  );
  const draft = await request("/api/reports", unitCookie, payload);
  check(
    draft.status === 200 && draft.body.receipt.version === 1,
    "Partial submission accepted",
  );
  const retry = await request("/api/reports", unitCookie, payload);
  check(
    retry.status === 200 &&
      retry.body.receipt.id === draft.body.receipt.id &&
      retry.body.receipt.duplicate,
    "Repeated request gets same receipt",
  );
  check(
    (
      await request("/api/reports", unitCookie, {
        ...payload,
        reporterName: "Khác",
      })
    ).status === 409,
    "Idempotency key cannot change payload",
  );
  const parallel = await Promise.all(
    [1, 2].map(() =>
      request("/api/reports", unitCookie, {
        ...payload,
        idempotencyKey: randomUUID(),
        version: 1,
        values,
      }),
    ),
  );
  check(
    parallel.filter((r) => r.status === 200).length === 1 &&
      parallel.filter((r) => r.status === 409).length === 1,
    "Concurrent edit conflict preserved",
  );
  const finalPayload = {
    ...payload,
    idempotencyKey: randomUUID(),
    version: 2,
    intent: "COMPLETE",
    values,
  };
  const complete = await request("/api/reports", unitCookie, finalPayload);
  check(
    complete.status === 200 && complete.body.receipt.version === 3,
    "Full submission accepted",
  );
  const assignment = await db().assignment.findUniqueOrThrow({
    where: { unitId_periodId: { unitId: unitIds[0], periodId: period.id } },
    include: { report: true },
  });
  check(
    timing(period.dueAt, assignment.report!.firstCompleteAt) === "LATE",
    "Partial before completion does not fake timely completion",
  );
  check(
    (await db().revision.count({
      where: { reportId: assignment.report!.id },
    })) === 3,
    "Exactly three distinct revisions",
  );
  const siblingUser = unitRecords[1].users[0];
  const siblingToken = randomBytes(32).toString("base64url");
  const { hash: digest } = await import("../src/lib/auth");
  await db().user.update({
    where: { id: siblingUser.id },
    data: { mustChangePassword: false },
  });
  await db().session.create({
    data: {
      tokenHash: digest(siblingToken),
      userId: siblingUser.id,
      expiresAt: new Date(now + 3600000),
    },
  });
  check(
    (
      await request("/api/reports", `report_session=${siblingToken}`, {
        ...finalPayload,
        intent: "DRAFT",
        version: 0,
        idempotencyKey: randomUUID(),
        values: { ...values, "23": 3 },
      })
    ).status === 200,
    "Child draft accepted",
  );
  const draftExport = await fetch(
    `${base}/api/admin/export?periodId=${period.id}`,
    { headers: { Cookie: adminCookie } },
  );
  const draftWorkbook = new ExcelJS.Workbook();
  await draftWorkbook.xlsx.load(await draftExport.arrayBuffer());
  check(
    draftWorkbook.getWorksheet("Chi tiết đơn vị")!.rowCount === 2,
    "Default detail export omits drafts",
  );
  check(
    draftWorkbook.getWorksheet("Nhận xét")!.rowCount === 2,
    "Default notes export omits drafts",
  );
  check(
    (
      await request("/api/reports", `report_session=${siblingToken}`, {
        ...finalPayload,
        version: 1,
        idempotencyKey: randomUUID(),
        values: { ...values, "23": 3 },
      })
    ).status === 200,
    "Child unit submits separately",
  );
  const exported = await fetch(
    `${base}/api/admin/export?periodId=${period.id}`,
    { headers: { Cookie: adminCookie } },
  );
  check(exported.status === 200, "Excel export");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await exported.arrayBuffer());
  check(
    workbook.worksheets.length === 5 &&
      workbook.getWorksheet("Tổng hợp")!.rowCount === 21,
    "Excel has correct sheets and weekly indicators",
  );
  check(
    workbook.getWorksheet("Tổng hợp")!.getRow(2).getCell(4).value === 10,
    "Exclude covered child even when intermediary is not assigned to period",
  );
  const overridden = await request("/api/admin/deadlines", adminCookie, {
    periodId: period.id,
    unitIds: [unitIds[0]],
    dueAt: new Date(now + 1800000).toISOString(),
    closesAt: new Date(now + 3600000).toISOString(),
    reason: "Gia hạn kiểm thử",
  });
  check(overridden.status === 200, "Per-unit deadline override");
  const revision = await db().revision.findUniqueOrThrow({
    where: { id: complete.body.receipt.id },
  });
  check(
    revision.dueAt.toISOString() === period.dueAt,
    "Original receipt deadline preserved",
  );
  check(
    (
      await request(
        `/api/admin/history?reportId=${assignment.report!.id}`,
        `report_session=${siblingToken}`,
      )
    ).status === 404,
    "Sibling cannot read history",
  );
  const closeResult = await request("/api/admin/deadlines", adminCookie, {
    periodId: period.id,
    unitIds: [unitIds[0]],
    dueAt: new Date(now - 1800000).toISOString(),
    closesAt: new Date(now - 60000).toISOString(),
    reason: "Khóa kỳ kiểm thử",
  });
  check(closeResult.status === 200, "Close unit window");
  check(
    (
      await request("/api/reports", unitCookie, {
        ...finalPayload,
        idempotencyKey: randomUUID(),
        version: 3,
      })
    ).status === 403,
    "Reject new submission after close",
  );
  check(
    (await request("/api/reports", unitCookie, finalPayload)).body.receipt
      .id === complete.body.receipt.id,
    "Retry acknowledged even after close",
  );
  await request(
    "/api/admin/units",
    adminCookie,
    { unitId: unitIds[0], active: false },
    "PATCH",
  );
  check(
    (await request("/api/bootstrap", unitCookie)).status === 401,
    "Lock unit revokes access",
  );
  console.log(
    `PASS: ${assertions} integration assertions against real local PostgreSQL + HTTP API.`,
  );
}
async function cleanup() {
  if (unitIds.length) {
    await db().revision.deleteMany({ where: { unitId: { in: unitIds } } });
    await db().report.deleteMany({
      where: { assignment: { unitId: { in: unitIds } } },
    });
    await db().contact.deleteMany({ where: { unitId: { in: unitIds } } });
    await db().assignment.deleteMany({ where: { unitId: { in: unitIds } } });
  }
  await db().period.deleteMany({ where: { id: { in: periodIds } } });
  await db().audit.deleteMany({ where: { actorId } });
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
