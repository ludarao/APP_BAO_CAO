import { expect, it } from "vitest";
import {
  aggregateScope,
  metricSummary,
  type DataSource,
} from "../src/lib/aggregation";
import { initialValues, inspectValues } from "../src/lib/forms";
const optional = { training: false, staffing: false };
const parent: DataSource = {
  unitId: "A",
  unit: { code: "A", parentCode: null, scope: "INCLUDES_CHILDREN" },
  report: { status: "COMPLETE", values: { "23": 10 }, optional },
};
const child: DataSource = {
  unitId: "B",
  unit: { code: "B", parentCode: "C", scope: "DIRECT" },
  report: { status: "COMPLETE", values: { "23": 3 }, optional },
};
const graph = [
  parent.unit,
  child.unit,
  { code: "C", parentCode: "A", scope: "DIRECT" },
];
it("không cộng trùng cả khi cấp trung gian không được giao kỳ", () => {
  const summary = metricSummary("WEEK", [parent, child], graph);
  expect(summary.metrics.find((f) => f.key === "23")?.value).toBe(10);
  expect(summary.excluded).toEqual(["B"]);
  expect(
    metricSummary("WEEK", [child], graph).metrics.find((f) => f.key === "23")
      ?.value,
  ).toBe(3);
});
it("bản tạm chỉ phủ số cấp dưới khi người xem chọn bao gồm bản tạm", () => {
  const draft = { ...parent, report: { ...parent.report!, status: "DRAFT" } };
  expect(
    aggregateScope([draft, child], graph).selected.map((s) => s.unitId),
  ).toEqual(["B"]);
  expect(
    aggregateScope([draft, child], graph, true).selected.map((s) => s.unitId),
  ).toEqual(["A"]);
});
it("phân biệt tổng 0 với chưa có số liệu và giữ mức thiếu nguồn", () => {
  const empty = {
    ...child,
    unitId: "D",
    unit: { ...child.unit, code: "D", parentCode: null },
    report: null,
  };
  const zero = {
    ...parent,
    report: { ...parent.report!, values: { "23": 0 } },
  };
  const metrics = metricSummary("WEEK", [zero, empty], graph).metrics;
  expect(metrics.find((f) => f.key === "23")).toMatchObject({
    value: 0,
    contributors: 1,
    expected: 2,
    missing: 1,
  });
  expect(metrics.find((f) => f.key === "26")?.value).toBeNull();
});
it("mục tháng không phát sinh không bị coi là nhập thiếu", () => {
  const metrics = metricSummary("MONTH", [parent], graph).metrics;
  expect(metrics.find((f) => f.key === "09")).toMatchObject({
    conditional: true,
    expected: 0,
    missing: 0,
    value: null,
  });
});
it("biểu mới có số 0, giữ số đã nhập và tạo 0 khi mở mục bổ sung", () => {
  const week = initialValues("WEEK", optional, { "23": 12, "24": 0 });
  expect(Object.keys(week)).toHaveLength(20);
  expect(week["23"]).toBe(12);
  expect(week["25_1"]).toBe(0);
  expect(inspectValues("WEEK", week, optional).complete).toBe(true);
  expect(
    Object.keys(initialValues("MONTH", { training: true, staffing: true })),
  ).toHaveLength(47);
});
