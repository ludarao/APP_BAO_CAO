import { z } from "zod";
export const unitRowSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .regex(/^[A-Za-z0-9_-]+$/, "Mã đơn vị chỉ gồm chữ không dấu, số, _ và -."),
  name: z.string().trim().min(2).max(200),
  group: z.string().trim().max(100).default("Đơn vị trực thuộc"),
  parentCode: z.string().trim().max(50).default(""),
  scope: z.enum(["DIRECT", "INCLUDES_CHILDREN"]).default("DIRECT"),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .max(100)
    .regex(
      /^[a-z0-9_]*$/,
      "Tên đăng nhập chỉ gồm chữ thường không dấu, số và _.",
    )
    .default(""),
});
export const periodSchema = z
  .object({
    title: z.string().trim().min(3).max(150),
    kind: z.enum(["WEEK", "MONTH", "QUARTER", "HALF_YEAR", "YEAR"]),
    startAt: z.iso.datetime(),
    endAt: z.iso.datetime(),
    opensAt: z.iso.datetime(),
    dueAt: z.iso.datetime(),
    closesAt: z.iso.datetime(),
    unitIds: z.array(z.string().min(1).max(100)).min(1).max(2000),
  })
  .refine(
    (v) => new Date(v.startAt) <= new Date(v.endAt),
    "Ngày bắt đầu phải trước ngày kết thúc số liệu.",
  )
  .refine(
    (v) =>
      new Date(v.opensAt) <= new Date(v.dueAt) &&
      new Date(v.dueAt) <= new Date(v.closesAt),
    "Cần đảm bảo thời gian mở ≤ hạn nộp ≤ thời gian khóa.",
  );
