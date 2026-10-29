import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { body, endpoint } from "@/lib/http";
import { scheduleSchema } from "@/lib/schedule-calendar";
import { syncSchedules } from "@/lib/schedules";
export const maxDuration = 60;
export const GET = endpoint(async () => {
  await requireUser(true);
  return NextResponse.json({
    schedules: await db().reportingSchedule.findMany({
      orderBy: { kind: "asc" },
    }),
  });
});
export const POST = endpoint(async (req) => {
  const actor = await requireUser(true);
  const { schedule, applyToOpen } = z
    .object({
      schedule: scheduleSchema,
      applyToOpen: z.boolean().default(false),
    })
    .parse(await body(req));
  await db().$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(701029)`;
    const old = await tx.reportingSchedule.findUnique({
      where: { kind: schedule.kind },
    });
    await tx.reportingSchedule.upsert({
      where: { kind: schedule.kind },
      create: schedule,
      update: {
        ...schedule,
        ...(!old?.enabled && schedule.enabled
          ? { effectiveFrom: new Date() }
          : {}),
      },
    });
    await tx.audit.create({
      data: {
        actorId: actor.id,
        action: "CHANGE_SCHEDULE",
        target: schedule.kind,
        detail: JSON.parse(
          JSON.stringify({ before: old, after: schedule, applyToOpen }),
        ),
      },
    });
  });
  const result = await syncSchedules(new Date(), applyToOpen, actor.id);
  return NextResponse.json({ ok: true, ...result });
});
