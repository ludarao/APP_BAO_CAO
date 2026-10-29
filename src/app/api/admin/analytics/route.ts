import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { endpoint, ApiError } from "@/lib/http";
import { metricSummary } from "@/lib/aggregation";
export const GET = endpoint(async (req) => {
  await requireUser(true);
  const query = new URL(req.url).searchParams,
    periodId = query.get("periodId"),
    unitId = query.get("unitId");
  if (!periodId) throw new ApiError(400, "Chọn kỳ báo cáo để xem số liệu.");
  const result = await db().$transaction(
    async (tx) => {
      const period = await tx.period.findUnique({
        where: { id: periodId },
        include: {
          assignments: {
            include: {
              unit: true,
              report: {
                select: {
                  id: true,
                  values: true,
                  optional: true,
                  status: true,
                  completed: true,
                  required: true,
                  reporterName: true,
                  reporterPhone: true,
                  firstCompleteAt: true,
                  updatedAt: true,
                },
              },
            },
          },
        },
      });
      if (!period) throw new ApiError(404, "Không tìm thấy kỳ báo cáo.");
      const graph = await tx.unit.findMany({
        select: { code: true, parentCode: true, scope: true },
      });
      const selectedUnit = unitId
        ? period.assignments.find((a) => a.unitId === unitId)
        : null;
      if (unitId && !selectedUnit)
        throw new ApiError(404, "Đơn vị không thuộc kỳ báo cáo này.");
      const input = selectedUnit ? [selectedUnit] : period.assignments;
      const summary = metricSummary(
        period.kind,
        input,
        graph,
        query.get("drafts") === "true",
      );
      const notes = selectedUnit?.report
        ? await tx.report.findUnique({
            where: { id: selectedUnit.report.id },
            select: { notes: true },
          })
        : null;
      return {
        period: {
          id: period.id,
          title: period.title,
          kind: period.kind,
          startAt: period.startAt,
          endAt: period.endAt,
          dueAt: period.dueAt,
        },
        units: period.assignments.map((a) => ({
          id: a.unitId,
          code: a.unit.code,
          name: a.unit.name,
        })),
        ...summary,
        stats: {
          assigned: input.length,
          complete: input.filter((a) => a.report?.status === "COMPLETE").length,
          draft: input.filter((a) => a.report?.status === "DRAFT").length,
          empty: input.filter((a) => !a.report).length,
        },
        detail: selectedUnit
          ? {
              unit: selectedUnit.unit,
              report: selectedUnit.report
                ? {
                    status: selectedUnit.report.status,
                    completed: selectedUnit.report.completed,
                    required: selectedUnit.report.required,
                    reporterName: selectedUnit.report.reporterName,
                    reporterPhone: selectedUnit.report.reporterPhone,
                    updatedAt: selectedUnit.report.updatedAt,
                    firstCompleteAt: selectedUnit.report.firstCompleteAt,
                    notes: notes?.notes,
                  }
                : null,
              dueAt: selectedUnit.dueAt || period.dueAt,
            }
          : null,
        refreshedAt: new Date().toISOString(),
      };
    },
    { isolationLevel: "RepeatableRead", timeout: 15000 },
  );
  return NextResponse.json(result);
});
