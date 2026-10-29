import { db } from "./db";
import { FORM_VERSION, fields, formatDay } from "./forms";
import { plannedPeriods, type ScheduleRule } from "./schedule-calendar";
import { randomUUID } from "node:crypto";
export async function syncSchedules(
  now = new Date(),
  updateOpen = false,
  actorId = "system",
) {
  return db().$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(701029)`;
      const [rules, existing] = await Promise.all([
        tx.reportingSchedule.findMany(),
        tx.period.findMany({
          where: { startAt: { gte: new Date(now.getTime() - 400 * 86400000) } },
        }),
      ]);
      let created = 0,
        updated = 0,
        skipped = 0;
      const creations: (ReturnType<typeof plannedPeriods>[number] & {
        id: string;
      })[] = [];
      for (const rule of rules)
        for (const plan of plannedPeriods(rule as ScheduleRule, now)) {
          if (plan.closesAt < now) continue;
          const old = existing.find(
            (p) =>
              p.autoKey === plan.autoKey ||
              (p.kind === plan.kind &&
                formatDay(p.startAt) === formatDay(plan.startAt) &&
                formatDay(p.endAt) === formatDay(plan.endAt)),
          );
          if (old) {
            if (
              !old.autoKey ||
              old.scheduleOverride ||
              old.closesAt < now ||
              (!updateOpen && old.opensAt <= now)
            )
              continue;
            if (
              old.opensAt.getTime() === plan.opensAt.getTime() &&
              old.dueAt.getTime() === plan.dueAt.getTime() &&
              old.closesAt.getTime() === plan.closesAt.getTime()
            )
              continue;
            await tx.$queryRaw`SELECT "id" FROM "Period" WHERE "id" = ${old.id} FOR UPDATE`;
            const conflict = await tx.assignment.findFirst({
              where: { periodId: old.id, dueAt: { lt: plan.opensAt } },
              select: { id: true },
            });
            if (conflict) {
              skipped++;
              continue;
            }
            await tx.period.update({
              where: { id: old.id },
              data: {
                opensAt: plan.opensAt,
                dueAt: plan.dueAt,
                closesAt: plan.closesAt,
              },
            });
            updated++;
          } else {
            creations.push({ ...plan, id: randomUUID() });
            created++;
          }
        }
      if (creations.length) {
        await tx.period.createMany({
          data: creations.map((plan) => ({
            ...plan,
            formVersion: FORM_VERSION,
            formSnapshot: fields,
          })),
        });
      }
      const enrolled =
        await tx.$executeRaw`INSERT INTO "Assignment" ("id", "unitId", "periodId")
        SELECT gen_random_uuid()::text, u."id", p."id" FROM "Unit" u CROSS JOIN "Period" p
        WHERE u."active" = true AND p."autoKey" IS NOT NULL AND p."dueAt" >= ${now}
        AND NOT EXISTS (SELECT 1 FROM "Assignment" a WHERE a."unitId" = u."id" AND a."periodId" = p."id")
        ON CONFLICT ("unitId", "periodId") DO NOTHING`;
      if (created || updated)
        await tx.audit.create({
          data: {
            actorId,
            action: "SYNC_SCHEDULES",
            target: "automatic",
            detail: { created, updated, skipped, enrolled, updateOpen },
          },
        });
      return { created, updated, skipped, enrolled };
    },
    { maxWait: 10000, timeout: 60000 },
  );
}
