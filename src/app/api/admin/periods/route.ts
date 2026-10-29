import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { body, endpoint, ApiError } from "@/lib/http";
import { periodSchema } from "@/lib/admin";
import { FORM_VERSION, fields } from "@/lib/forms";
export const POST = endpoint(async (req) => {
  const actor = await requireUser(true);
  const input = periodSchema.parse(await body(req));
  const unitIds = [...new Set(input.unitIds)];
  const count = await db().unit.count({
    where: { id: { in: unitIds }, active: true },
  });
  if (count !== unitIds.length)
    throw new ApiError(400, "Có đơn vị không tồn tại hoặc đã bị khóa.");
  const { unitIds: _, ...rest } = input;
  const period = await db().$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(701030)`;
    const created = await tx.period.create({
      data: {
        ...rest,
        formVersion: FORM_VERSION,
        formSnapshot: fields,
        assignments: {
          createMany: { data: unitIds.map((unitId) => ({ unitId })) },
        },
      },
    });
    await tx.audit.create({
      data: {
        actorId: actor.id,
        action: "CREATE_PERIOD",
        target: created.id,
        detail: { title: created.title, units: unitIds.length },
      },
    });
    return created;
  });
  return NextResponse.json({ period });
});
