import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { body, endpoint, ApiError } from "@/lib/http";
export const POST = endpoint(async (req) => {
  const actor = await requireUser(true);
  const input = z
    .object({
      periodId: z.string(),
      unitIds: z.array(z.string()).max(2000).default([]),
      opensAt: z.iso.datetime().optional(),
      dueAt: z.iso.datetime(),
      closesAt: z.iso.datetime(),
      reason: z.string().trim().min(5, "Ghi rõ lý do thay đổi.").max(1000),
    })
    .parse(await body(req));
  await db().$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Period" WHERE "id" = ${input.periodId} FOR UPDATE`;
    const period = await tx.period.findUnique({
      where: { id: input.periodId },
    });
    if (!period) throw new ApiError(404, "Không tìm thấy kỳ.");
    const opensAt = new Date(input.opensAt || period.opensAt),
      dueAt = new Date(input.dueAt),
      closesAt = new Date(input.closesAt);
    if (opensAt > dueAt || dueAt > closesAt)
      throw new ApiError(400, "Cần đảm bảo mở ≤ hạn ≤ khóa.");
    let before: unknown;
    if (input.unitIds.length) {
      before = await tx.assignment.findMany({
        where: { periodId: input.periodId, unitId: { in: input.unitIds } },
        select: { unitId: true, dueAt: true, closesAt: true },
      });
      if ((before as unknown[]).length !== new Set(input.unitIds).size)
        throw new ApiError(400, "Có đơn vị chưa được giao kỳ.");
      await tx.assignment.updateMany({
        where: { periodId: input.periodId, unitId: { in: input.unitIds } },
        data: { dueAt, closesAt },
      });
    } else {
      const overrides = await tx.assignment.findMany({
        where: { periodId: input.periodId, dueAt: { not: null } },
      });
      if (overrides.some((a) => a.dueAt! < opensAt))
        throw new ApiError(
          400,
          "Mốc mở mới sau hạn riêng của đơn vị. Hãy điều chỉnh hạn riêng trước.",
        );
      before = {
        opensAt: period.opensAt,
        dueAt: period.dueAt,
        closesAt: period.closesAt,
      };
      await tx.period.update({
        where: { id: period.id },
        data: { opensAt, dueAt, closesAt },
      });
    }
    await tx.audit.create({
      data: {
        actorId: actor.id,
        action: "CHANGE_DEADLINE",
        target: period.id,
        detail: JSON.parse(JSON.stringify({ before, after: input })),
      },
    });
  });
  return NextResponse.json({ ok: true });
});
