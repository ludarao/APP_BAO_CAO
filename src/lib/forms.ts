import indicators from "./indicators.json";
import { z } from "zod";

export const FORM_VERSION = 1;
export const fields = indicators;
export const kinds = {
  WEEK: "Tuần",
  MONTH: "Tháng",
  QUARTER: "Quý",
  HALF_YEAR: "6 tháng",
  YEAR: "Năm",
};
export type Kind = keyof typeof kinds;
export const groups = [
  {
    id: 1,
    name: "Chỉ đạo và quán triệt",
    description: "Văn bản, hội nghị và học tập điều lệnh",
  },
  {
    id: 2,
    name: "Tập huấn và hoạt động",
    description: "Tập huấn, hội thi, hội thao và câu lạc bộ",
  },
  {
    id: 3,
    name: "Trách nhiệm lãnh đạo",
    description: "Đối thoại và chấp hành điều lệnh",
  },
  {
    id: 4,
    name: "Kiểm tra và xử lý",
    description: "Kiểm tra, phát hiện và xử lý vi phạm",
  },
  {
    id: 5,
    name: "Lực lượng kiểm tra",
    description: "Cán bộ kiểm tra bán chuyên trách",
  },
  {
    id: 6,
    name: "Tuyên truyền và biểu dương",
    description: "Tin bài, sáng kiến và khen thưởng",
  },
];
export type Values = Record<string, number | null>;
export type Optional = { training: boolean | null; staffing: boolean | null };
export const phoneSchema = z
  .string()
  .trim()
  .regex(
    /^(?:0[0-9]{9}|\+84[0-9]{9})$/,
    "Số điện thoại gồm 10 số bắt đầu bằng 0 hoặc +84.",
  );
export const reportSchema = z.object({
  periodId: z.string().min(1).max(100),
  formVersion: z.literal(FORM_VERSION),
  version: z.number().int().nonnegative(),
  idempotencyKey: z.uuid(),
  intent: z.enum(["DRAFT", "COMPLETE"]),
  values: z.record(
    z.string(),
    z.number().int().min(0).max(100_000_000).nullable(),
  ),
  optional: z.object({
    training: z.boolean().nullable(),
    staffing: z.boolean().nullable(),
  }),
  notes: z.object({
    highlights: z.string().max(5000),
    difficulties: z.string().max(5000),
    progress: z.string().max(5000),
  }),
  reporterName: z.string().trim().min(2, "Nhập tên người gửi.").max(120),
  reporterPhone: phoneSchema,
});
export type ReportInput = z.infer<typeof reportSchema>;
export const draftImportSchema = reportSchema
  .omit({ idempotencyKey: true, intent: true })
  .extend({
    reporterName: z.string().max(120),
    reporterPhone: z.string().max(30),
  });
export function applicableFields(kind: string, optional: Optional) {
  return fields.filter((f) =>
    kind === "WEEK"
      ? f.weekly
      : kind === "MONTH"
        ? f.monthly ||
          (f.group === 2 && optional.training === true) ||
          (f.group === 5 && optional.staffing === true)
        : true,
  );
}
export function inspectValues(
  kind: string,
  values: Values,
  optional: Optional,
) {
  const applicable = applicableFields(kind, optional);
  const missing = applicable
    .filter((f) => values[f.key] == null)
    .map((f) => f.key);
  const errors: Record<string, string> = {};
  const allowed = new Set(applicable.map((f) => f.key));
  for (const [key, value] of Object.entries(values)) {
    if (!allowed.has(key)) errors[key] = "Chỉ tiêu không thuộc biểu đang nhập.";
    if (
      value != null &&
      (!Number.isSafeInteger(value) || value < 0 || value > 100_000_000)
    )
      errors[key] = "Nhập số nguyên từ 0 đến 100.000.000.";
  }
  const compare = (a: string, b: string) => {
    if (
      allowed.has(a) &&
      values[a] != null &&
      values[b] != null &&
      values[a]! > values[b]!
    )
      errors[a] = `Không được lớn hơn chỉ tiêu ${b}.`;
  };
  compare("04", "03");
  compare("06", "05");
  const a = values["25_1"],
    b = values["25_2"],
    u = values["25_3"];
  if (a != null && b != null && u != null && (u < Math.max(a, b) || u > a + b))
    errors["25_3"] =
      "Tổng không trùng phải nằm giữa số lớn nhất của hai loại và tổng hai loại.";
  const confirmationsMissing =
    kind === "MONTH" &&
    (optional.training === null || optional.staffing === null);
  return {
    missing,
    errors,
    completed: applicable.length - missing.length,
    required: applicable.length,
    complete:
      !missing.length && !Object.keys(errors).length && !confirmationsMissing,
    confirmationsMissing,
  };
}
export function canonicalValues(
  kind: string,
  values: Values,
  optional: Optional,
): Values {
  return Object.fromEntries(
    applicableFields(kind, optional).map((f) => [f.key, values[f.key] ?? null]),
  );
}
export function initialValues(
  kind: string,
  optional: Optional,
  stored: Values = {},
): Values {
  return Object.fromEntries(
    applicableFields(kind, optional).map((f) => [f.key, stored[f.key] ?? 0]),
  );
}
export function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 70);
}
export function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}
export function formatDay(value: string | Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}
export function timing(
  due: string | Date,
  firstComplete?: string | Date | null,
  now = new Date(),
) {
  if (firstComplete)
    return new Date(firstComplete) <= new Date(due) ? "ON_TIME" : "LATE";
  return now > new Date(due) ? "OVERDUE" : "PENDING";
}
