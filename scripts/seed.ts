import "dotenv/config";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import { db } from "../src/lib/db";
import { fields, FORM_VERSION, applicableFields } from "../src/lib/forms";
async function main() {
  const username = process.env.ADMIN_USERNAME || "admin",
    password = process.env.ADMIN_PASSWORD;
  if (!password || password.length < 12 || Buffer.byteLength(password) > 72)
    throw new Error(
      "Đặt ADMIN_PASSWORD từ 12 ký tự và không quá 72 byte trước khi seed.",
    );
  const admin = await db().user.upsert({
    where: { username },
    create: {
      username,
      passwordHash: await hash(password, 12),
      role: "ADMIN",
      mustChangePassword: true,
    },
    update: {},
  });
  console.log(
    `Đã đảm bảo tài khoản quản trị ${admin.username}. Seed không đổi mật khẩu tài khoản có sẵn.`,
  );
  if (process.env.SEED_DEMO !== "true") return;
  const url = new URL(process.env.DATABASE_URL!);
  if (!["localhost", "127.0.0.1"].includes(url.hostname))
    throw new Error("Dữ liệu demo chỉ được seed trên localhost.");
  const credentials = [{ username, password, code: "ADMIN" }];
  const units = [];
  for (let i = 1; i <= 8; i++) {
    const code = `MAU${String(i).padStart(2, "0")}`,
      username = `don_vi_mau_${i}`,
      password = randomBytes(16).toString("base64url");
    let unit = await db().unit.findUnique({ where: { code } });
    if (!unit) {
      unit = await db().unit.create({
        data: {
          code,
          name: `Đơn vị mẫu ${String(i).padStart(2, "0")}`,
          group: i <= 4 ? "Khối phòng nghiệp vụ (mẫu)" : "Khối cơ sở (mẫu)",
          users: {
            create: {
              username,
              passwordHash: await hash(password, 12),
              mustChangePassword: true,
            },
          },
        },
      });
      credentials.push({ code, username, password });
    }
    units.push(unit);
  }
  if (!(await db().period.count())) {
    const now = new Date();
    for (const kind of ["WEEK", "MONTH", "QUARTER"] as const) {
      const period = await db().period.create({
        data: {
          title: `[MẪU] Báo cáo ${kind === "WEEK" ? "tuần" : kind === "MONTH" ? "tháng" : "quý"} chạy thử`,
          kind,
          startAt: new Date(now.getTime() - 7 * 86400000),
          endAt: now,
          opensAt: new Date(now.getTime() - 2 * 86400000),
          dueAt: new Date(now.getTime() + 86400000),
          closesAt: new Date(now.getTime() + 3 * 86400000),
          formVersion: FORM_VERSION,
          formSnapshot: fields,
        },
      });
      for (let i = 0; i < units.length; i++) {
        const dueAt =
          i === 2 || i === 6 ? new Date(now.getTime() - 86400000) : null;
        const a = await db().assignment.create({
          data: { periodId: period.id, unitId: units[i].id, dueAt },
        });
        if (i > 3) continue;
        const optional = { training: false, staffing: false },
          fs = applicableFields(kind, optional);
        const values = Object.fromEntries(
          fs.map((f, j) => [f.key, i === 3 && j > 8 ? null : 0]),
        );
        const input = {
          values,
          notes: {
            highlights:
              "Dữ liệu mẫu dùng kiểm tra giao diện, không phải số liệu thực tế.",
            difficulties: "",
            progress: "",
          },
          optional,
          status: i === 3 ? "DRAFT" : "COMPLETE",
          completed: i === 3 ? 9 : fs.length,
          required: fs.length,
          reporterName: `Người nhập mẫu ${i + 1}`,
          reporterPhone: `090000000${i}`,
          firstCompleteAt: i === 3 ? null : now,
        };
        const report = await db().report.create({
          data: { assignmentId: a.id, ...input },
        });
        await db().revision.create({
          data: {
            reportId: report.id,
            unitId: units[i].id,
            userId: admin.id,
            idempotencyKey: randomUUID(),
            payloadHash: "demo",
            version: 1,
            values,
            notes: input.notes,
            optional,
            status: input.status,
            reporterName: input.reporterName,
            reporterPhone: input.reporterPhone,
            dueAt: dueAt || period.dueAt,
          },
        });
      }
    }
  }
  mkdirSync(".local", { recursive: true });
  if (!existsSync(".local/demo-credentials.json"))
    writeFileSync(
      ".local/demo-credentials.json",
      JSON.stringify(credentials, null, 2),
      { mode: 0o600 },
    );
  console.log(
    "Tài khoản local được lưu tại .local/demo-credentials.json (không đưa lên Git). Dữ liệu có nhãn MẪU.",
  );
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => db().$disconnect());
