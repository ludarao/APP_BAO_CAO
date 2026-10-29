import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { compare } from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { COOKIE, hash, requireUser, rateLimit } from "@/lib/auth";
import { body, endpoint, ApiError } from "@/lib/http";
import { resetModes } from "@/lib/reset";
export const maxDuration = 60;
export const GET = endpoint(async () => {
  await requireUser(true);
  const counts = await db().$transaction(
    async (tx) => ({
      units: await tx.unit.count(),
      users: await tx.user.count({ where: { role: { not: "ADMIN" } } }),
      periods: await tx.period.count(),
      reports: await tx.report.count(),
      revisions: await tx.revision.count(),
      contacts: await tx.contact.count(),
    }),
    { isolationLevel: "RepeatableRead" },
  );
  return NextResponse.json({ counts });
});
export const POST = endpoint(async (req) => {
  const actor = await requireUser(true);
  const input = z
    .object({
      mode: z.enum(["REPORTS", "ALL"]),
      confirmation: z.string(),
      password: z.string().min(1).max(200),
      requestId: z.uuid(),
    })
    .parse(await body(req, 4096));
  if (input.confirmation !== resetModes[input.mode].phrase)
    throw new ApiError(400, "Cụm từ xác nhận chưa đúng.");
  await rateLimit(`data-reset:${actor.id}`, 5, 300);
  if (!(await compare(input.password, actor.passwordHash)))
    throw new ApiError(400, "Mật khẩu hiện tại không đúng.");
  const tokenHash = hash((await cookies()).get(COOKIE)?.value || "");
  const result = await db().$transaction(
    async (tx) => {
      // Block submissions first; imports and schedule jobs use the following locks.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(701030)`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(701028)`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(701029)`;
      const session = await tx.session.findUnique({
        where: { tokenHash },
        include: { user: true },
      });
      if (
        !session ||
        session.expiresAt < new Date() ||
        !session.user.active ||
        session.user.role !== "ADMIN" ||
        session.user.passwordHash !== actor.passwordHash
      )
        throw new ApiError(
          401,
          "Phiên quản trị đã thay đổi. Hãy đăng nhập lại.",
        );
      const previous = await tx.audit.findFirst({
        where: { action: "RESET_DATA", target: input.requestId },
      });
      if (previous) {
        const detail = previous.detail as { mode: string; deleted: unknown };
        if (detail.mode !== input.mode || previous.actorId !== actor.id)
          throw new ApiError(
            409,
            "Mã xác nhận đã được dùng cho thao tác khác.",
          );
        return { repeated: true, deleted: detail.deleted };
      }
      const revisions = (await tx.revision.deleteMany()).count;
      const reports = (await tx.report.deleteMany()).count;
      const contacts = (await tx.contact.deleteMany()).count;
      // An already authenticated request must not recreate reports after the reset.
      await tx.session.deleteMany({
        where: { user: { role: { not: "ADMIN" } } },
      });
      let units = 0,
        users = 0,
        periods = 0,
        assignments = 0;
      if (input.mode === "ALL") {
        assignments = (await tx.assignment.deleteMany()).count;
        periods = (await tx.period.deleteMany()).count;
        users = (
          await tx.user.deleteMany({ where: { role: { not: "ADMIN" } } })
        ).count;
        await tx.user.updateMany({
          where: { role: "ADMIN", unitId: { not: null } },
          data: { unitId: null },
        });
        units = (await tx.unit.deleteMany()).count;
        await tx.audit.deleteMany({ where: { action: { not: "RESET_DATA" } } });
        await tx.reportingSchedule.updateMany({
          data: { effectiveFrom: new Date() },
        });
      }
      const deleted = {
        revisions,
        reports,
        contacts,
        units,
        users,
        periods,
        assignments,
      };
      await tx.audit.create({
        data: {
          actorId: actor.id,
          action: "RESET_DATA",
          target: input.requestId,
          detail: { mode: input.mode, deleted },
        },
      });
      return { repeated: false, deleted };
    },
    { maxWait: 10000, timeout: 45000 },
  );
  return NextResponse.json({ ok: true, ...result });
});
