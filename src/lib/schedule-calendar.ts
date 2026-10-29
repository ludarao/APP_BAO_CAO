import { z } from "zod";
import { kinds, type Kind } from "./forms";
const DAY = 86400000,
  VN = 7 * 3600000;
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const scheduleSchema = z
  .object({
    kind: z.enum(["WEEK", "MONTH", "QUARTER", "HALF_YEAR", "YEAR"]),
    enabled: z.boolean(),
    openingDay: z.number().int().min(1).max(31),
    opensTime: time,
    dueTime: time,
    closesTime: time,
    dueAfterDays: z.number().int().min(0).max(31),
    closeAfterDays: z.number().int().min(0).max(62),
  })
  .refine(
    (r) => r.kind !== "WEEK" || r.openingDay <= 7,
    "Ngày mở báo cáo tuần phải từ thứ Hai đến Chủ nhật.",
  )
  .refine(
    (r) => r.dueAfterDays * 1440 + minutes(r.dueTime) >= minutes(r.opensTime),
    "Hạn nộp phải sau thời điểm mở.",
  )
  .refine(
    (r) =>
      r.closeAfterDays * 1440 + minutes(r.closesTime) >=
      r.dueAfterDays * 1440 + minutes(r.dueTime),
    "Thời điểm khóa phải sau hạn nộp.",
  );
export type ScheduleRule = z.infer<typeof scheduleSchema> & {
  effectiveFrom: string | Date;
};
export function minutes(value: string) {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}
function shift(d: Date, amount: number, kind: Kind) {
  if (kind === "WEEK") return new Date(d.getTime() + amount * 7 * DAY);
  const months =
    kind === "MONTH"
      ? 1
      : kind === "QUARTER"
        ? 3
        : kind === "HALF_YEAR"
          ? 6
          : 12;
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + amount * months, 1),
  );
}
function cycleStart(now: Date, kind: Kind) {
  const d = new Date(now.getTime() + VN),
    y = d.getUTCFullYear(),
    m = d.getUTCMonth();
  const day = new Date(Date.UTC(y, m, d.getUTCDate()));
  if (kind === "WEEK")
    return new Date(day.getTime() - ((day.getUTCDay() + 6) % 7) * DAY);
  return new Date(
    Date.UTC(
      y,
      kind === "MONTH"
        ? m
        : kind === "QUARTER"
          ? Math.floor(m / 3) * 3
          : kind === "HALF_YEAR"
            ? Math.floor(m / 6) * 6
            : 0,
      1,
    ),
  );
}
export function plannedPeriods(
  rule: ScheduleRule,
  now = new Date(),
  horizonDays = 366,
) {
  if (!rule.enabled) return [];
  const result = [];
  const limit = now.getTime() + horizonDays * DAY;
  for (
    let boundary = cycleStart(now, rule.kind), i = 0;
    i < 60;
    i++, boundary = shift(boundary, 1, rule.kind)
  ) {
    if (boundary.getTime() - VN > limit) break;
    const start = shift(boundary, -1, rule.kind);
    const maxDay =
      rule.kind === "WEEK"
        ? 7
        : new Date(
            Date.UTC(boundary.getUTCFullYear(), boundary.getUTCMonth() + 1, 0),
          ).getUTCDate();
    const openDay =
      boundary.getTime() + (Math.min(rule.openingDay, maxDay) - 1) * DAY - VN;
    const opensAt = new Date(openDay + minutes(rule.opensTime) * 60000);
    if (opensAt < new Date(rule.effectiveFrom) || opensAt.getTime() > limit)
      continue;
    const startAt = new Date(start.getTime() - VN),
      endAt = new Date(boundary.getTime() - VN - 1);
    const lastDay = new Date(boundary.getTime() - DAY);
    const label =
      rule.kind === "WEEK"
        ? `${start.getUTCDate()}/${start.getUTCMonth() + 1}${start.getUTCFullYear() !== lastDay.getUTCFullYear() ? `/${start.getUTCFullYear()}` : ""}–${lastDay.getUTCDate()}/${lastDay.getUTCMonth() + 1}/${lastDay.getUTCFullYear()}`
        : rule.kind === "MONTH"
          ? `${start.getUTCMonth() + 1}/${start.getUTCFullYear()}`
          : rule.kind === "QUARTER"
            ? `${Math.floor(start.getUTCMonth() / 3) + 1}/${start.getUTCFullYear()}`
            : rule.kind === "HALF_YEAR"
              ? `${start.getUTCMonth() < 6 ? "đầu" : "cuối"} năm ${start.getUTCFullYear()}`
              : `${start.getUTCFullYear()}`;
    result.push({
      autoKey: `${rule.kind}:${start.toISOString().slice(0, 10)}`,
      kind: rule.kind,
      title: `Báo cáo ${kinds[rule.kind].toLowerCase()} ${label}`,
      startAt,
      endAt,
      opensAt,
      dueAt: new Date(
        openDay + rule.dueAfterDays * DAY + minutes(rule.dueTime) * 60000,
      ),
      closesAt: new Date(
        openDay + rule.closeAfterDays * DAY + minutes(rule.closesTime) * 60000,
      ),
    });
  }
  return result;
}
export function periodPriority<
  T extends { opensAt: string | Date; closesAt: string | Date },
>(periods: T[], now = new Date()): T[] {
  const rank = (p: T) =>
    now < new Date(p.opensAt) ? 1 : now > new Date(p.closesAt) ? 2 : 0;
  return [...periods].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (rank(a) === 2
        ? new Date(b.closesAt).getTime() - new Date(a.closesAt).getTime()
        : new Date(a.opensAt).getTime() - new Date(b.opensAt).getTime()),
  );
}
