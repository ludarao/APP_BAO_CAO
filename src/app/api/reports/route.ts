import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hash, requireUser, rateLimit } from "@/lib/auth";
import { body, endpoint, ApiError } from "@/lib/http";
import {
  reportSchema,
  inspectValues,
  canonicalValues,
  FORM_VERSION,
} from "@/lib/forms";
import { Prisma } from "@/generated/prisma/client";
export const POST = endpoint(async (req) => {
  const user = await requireUser();
  if (!user.unitId || user.role !== "UNIT")
    throw new ApiError(403, "Tài khoản này không thuộc đơn vị nhập báo cáo.");
  const input = reportSchema.parse(await body(req));
  await rateLimit(`submit:${user.id}`, 30, 60);
  const payloadHash = hash(JSON.stringify(input));
  const receipt = await db().$transaction(
    async (tx) => {
      const periodRows = await tx.$queryRaw<
        { id: string }[]
      >`SELECT "id" FROM "Period" WHERE "id" = ${input.periodId} FOR SHARE`;
      if (!periodRows.length)
        throw new ApiError(404, "Không tìm thấy kỳ báo cáo.");
      await tx.$queryRaw`SELECT "id" FROM "Assignment" WHERE "periodId" = ${input.periodId} AND "unitId" = ${user.unitId!} FOR UPDATE`;
      const assignment = await tx.assignment.findUnique({
        where: {
          unitId_periodId: { unitId: user.unitId!, periodId: input.periodId },
        },
        include: { period: true, report: true },
      });
      if (!assignment)
        throw new ApiError(403, "Đơn vị chưa được giao kỳ báo cáo này.");
      const duplicate = await tx.revision.findUnique({
        where: {
          unitId_idempotencyKey: {
            unitId: user.unitId!,
            idempotencyKey: input.idempotencyKey,
          },
        },
      });
      if (duplicate) {
        if (duplicate.payloadHash !== payloadHash)
          throw new ApiError(409, "Mã lần gửi đã được dùng với nội dung khác.");
        return {
          id: duplicate.id,
          version: duplicate.version,
          receivedAt: duplicate.receivedAt,
          status: duplicate.status,
          duplicate: true,
        };
      }
      const now = new Date();
      const period = assignment.period;
      if (period.formVersion !== FORM_VERSION)
        throw new ApiError(
          409,
          "Biểu đã thay đổi. Hãy tải lại để đối chiếu bản nháp.",
        );
      if (now < period.opensAt)
        throw new ApiError(403, "Kỳ báo cáo chưa mở nhận dữ liệu.");
      if (now > (assignment.closesAt || period.closesAt))
        throw new ApiError(
          403,
          "Kỳ đã khóa. Bản nháp vẫn được giữ; hãy đề nghị admin mở lại.",
        );
      if ((assignment.report?.version || 0) !== input.version)
        throw new ApiError(
          409,
          "Có người vừa cập nhật báo cáo này. Hãy tải bản máy chủ để đối chiếu trước khi gửi lại.",
        );
      if (assignment.report?.status === "COMPLETE" && input.intent === "DRAFT")
        throw new ApiError(
          400,
          "Báo cáo đã nộp đủ. Hãy gửi bản cập nhật đầy đủ.",
        );
      const inspection = inspectValues(
        period.kind,
        input.values,
        input.optional,
      );
      if (Object.keys(inspection.errors).length)
        throw new ApiError(400, "Có số liệu không hợp lệ.", inspection.errors);
      if (input.intent === "COMPLETE" && !inspection.complete)
        throw new ApiError(400, "Chưa đủ thông tin để nộp hoàn chỉnh.", {
          missing: inspection.missing,
          confirmationsMissing: inspection.confirmationsMissing,
        });
      const values = canonicalValues(period.kind, input.values, input.optional);
      const complete = input.intent === "COMPLETE";
      const version = input.version + 1;
      const data = {
        values: values as Prisma.InputJsonValue,
        notes: input.notes,
        optional: input.optional,
        completed: inspection.completed,
        required: inspection.required,
        status: complete ? "COMPLETE" : "DRAFT",
        reporterName: input.reporterName,
        reporterPhone: input.reporterPhone,
        updatedAt: now,
        firstCompleteAt:
          assignment.report?.firstCompleteAt || (complete ? now : null),
      };
      const report = assignment.report
        ? await tx.report.update({
            where: { id: assignment.report.id },
            data: { ...data, version },
          })
        : await tx.report.create({
            data: {
              ...data,
              assignmentId: assignment.id,
              version,
              firstReceivedAt: now,
            },
          });
      const revision = await tx.revision.create({
        data: {
          reportId: report.id,
          unitId: user.unitId!,
          userId: user.id,
          idempotencyKey: input.idempotencyKey,
          payloadHash,
          version,
          values: values as Prisma.InputJsonValue,
          notes: input.notes,
          optional: input.optional,
          status: report.status,
          reporterName: input.reporterName,
          reporterPhone: input.reporterPhone,
          dueAt: assignment.dueAt || period.dueAt,
          receivedAt: now,
        },
      });
      await tx.contact.upsert({
        where: {
          unitId_phone: { unitId: user.unitId!, phone: input.reporterPhone },
        },
        create: {
          unitId: user.unitId!,
          name: input.reporterName,
          phone: input.reporterPhone,
        },
        update: { name: input.reporterName },
      });
      return {
        id: revision.id,
        version,
        receivedAt: now,
        status: report.status,
        duplicate: false,
      };
    },
    { maxWait: 10000, timeout: 15000 },
  );
  return NextResponse.json({ receipt });
});
