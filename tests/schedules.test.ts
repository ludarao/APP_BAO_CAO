import { describe, expect, it } from "vitest";
import {
  plannedPeriods,
  periodPriority,
  scheduleSchema,
  type ScheduleRule,
} from "../src/lib/schedule-calendar";
const now = new Date("2026-10-29T02:00:00Z");
const rule: ScheduleRule = {
  kind: "WEEK",
  enabled: true,
  openingDay: 1,
  opensTime: "08:00",
  dueTime: "16:00",
  closesTime: "17:00",
  dueAfterDays: 0,
  closeAfterDays: 0,
  effectiveFrom: now,
};
describe("Lịch theo giờ Việt Nam", () => {
  it("tuần trước đầy đủ, mở đúng thứ Hai lúc 08h VN", () => {
    const p = plannedPeriods(rule, now)[0];
    expect(p.startAt.toISOString()).toBe("2026-10-25T17:00:00.000Z");
    expect(p.endAt.toISOString()).toBe("2026-11-01T16:59:59.999Z");
    expect(p.opensAt.toISOString()).toBe("2026-11-02T01:00:00.000Z");
    expect(p.dueAt.toISOString()).toBe("2026-11-02T09:00:00.000Z");
  });
  it("tháng chuyển năm và quý/6 tháng/năm không lệch khoảng", () => {
    const d = new Date("2026-12-28T00:00:00Z");
    const r = { ...rule, effectiveFrom: d };
    expect(
      plannedPeriods(r, d).find((p) =>
        p.startAt.toISOString().startsWith("2026-12-27"),
      )?.title,
    ).toBe("Báo cáo tuần 28/12/2026–3/1/2027");
    const month = plannedPeriods({ ...r, kind: "MONTH" }, d)[0];
    expect(month.startAt.toISOString()).toBe("2026-11-30T17:00:00.000Z");
    expect(month.opensAt.toISOString()).toBe("2027-01-01T01:00:00.000Z");
    expect(
      plannedPeriods({ ...r, kind: "QUARTER" }, d)[0].startAt.toISOString(),
    ).toBe("2026-09-30T17:00:00.000Z");
    expect(
      plannedPeriods({ ...r, kind: "HALF_YEAR" }, d)[0].startAt.toISOString(),
    ).toBe("2026-06-30T17:00:00.000Z");
    expect(
      plannedPeriods({ ...r, kind: "YEAR" }, d)[0].startAt.toISOString(),
    ).toBe("2025-12-31T17:00:00.000Z");
  });
  it("ngày 31 lùi về cuối tháng 2 năm nhuận", () => {
    const d = new Date("2028-02-01T00:00:00Z");
    expect(
      plannedPeriods(
        { ...rule, kind: "MONTH", openingDay: 31, effectiveFrom: d },
        d,
      )[0].opensAt.toISOString(),
    ).toBe("2028-02-29T01:00:00.000Z");
  });
  it("không tạo nghĩa vụ quá hạn trước ngày bắt đầu áp dụng", () => {
    expect(plannedPeriods(rule, now).every((p) => p.opensAt >= now)).toBe(true);
    expect(plannedPeriods({ ...rule, enabled: false }, now)).toEqual([]);
    expect(plannedPeriods(rule, now).length).toBeGreaterThan(50);
  });
  it("hạn qua ngày được tính đúng, từ chối lịch đảo ngược", () => {
    expect(
      plannedPeriods(
        { ...rule, dueAfterDays: 1, closeAfterDays: 2 },
        now,
      )[0].dueAt.toISOString(),
    ).toBe("2026-11-03T09:00:00.000Z");
    expect(
      scheduleSchema.safeParse({ ...rule, dueTime: "07:00" }).success,
    ).toBe(false);
    expect(
      scheduleSchema.safeParse({ ...rule, closesTime: "15:00" }).success,
    ).toBe(false);
    expect(scheduleSchema.safeParse({ ...rule, openingDay: 8 }).success).toBe(
      false,
    );
  });
  it("ưu tiên kỳ đang mở rồi kỳ sắp đến, không đẩy kỳ năm sau lên đầu", () => {
    const list = [
      {
        id: "future",
        opensAt: "2027-01-01T00:00Z",
        closesAt: "2027-01-02T00:00Z",
      },
      {
        id: "active",
        opensAt: "2026-10-28T00:00Z",
        closesAt: "2026-10-30T00:00Z",
      },
      {
        id: "past",
        opensAt: "2026-10-01T00:00Z",
        closesAt: "2026-10-02T00:00Z",
      },
    ];
    expect(periodPriority(list, now).map((x) => x.id)).toEqual([
      "active",
      "future",
      "past",
    ]);
  });
});
