import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import { requireUser, rateLimit } from "@/lib/auth";
import { endpoint, ApiError } from "@/lib/http";
import { fields, timing, formatDate } from "@/lib/forms";
import { aggregateScope, metricSummary } from "@/lib/aggregation";
export const maxDuration = 60;
export const GET = endpoint(async (req) => {
  const user = await requireUser(true);
  await rateLimit(`export:${user.id}`, 10, 60);
  const url = new URL(req.url);
  const periodId = url.searchParams.get("periodId");
  if (!periodId) throw new ApiError(400, "Hãy chọn kỳ báo cáo.");
  const includeDrafts = url.searchParams.get("drafts") === "true";
  const { period, unitGraph } = await db().$transaction(
    async (tx) => ({
      period: await tx.period.findUnique({
        where: { id: periodId },
        include: { assignments: { include: { unit: true, report: true } } },
      }),
      unitGraph: await tx.unit.findMany({
        select: { code: true, parentCode: true, scope: true },
      }),
    }),
    { isolationLevel: "RepeatableRead" },
  );
  if (!period) throw new ApiError(404, "Không tìm thấy kỳ.");
  const unitId = url.searchParams.get("unitId");
  if (unitId) {
    period.assignments = period.assignments.filter((a) => a.unitId === unitId);
    if (!period.assignments.length)
      throw new ApiError(404, "Đơn vị không thuộc kỳ này.");
  }
  const wb = new ExcelJS.Workbook();
  wb.creator = "Cổng báo cáo đơn vị";
  wb.created = new Date();
  const meta = wb.addWorksheet("Thông tin");
  meta.addRows([
    ["BÁO CÁO TỔNG HỢP", period.title],
    ["Thời điểm chốt", formatDate(new Date())],
    [
      "Khoảng số liệu",
      `${formatDate(period.startAt)} – ${formatDate(period.endAt)}`,
    ],
    ["Phiên bản biểu", period.formVersion],
    [
      "Phạm vi",
      includeDrafts ? "Gồm cả bản gửi tạm" : "Chỉ bản nộp đủ hiện hành",
    ],
    [
      "Lưu ý",
      "Chỉ tổng hợp giữa đơn vị trong một kỳ. Không cộng các kỳ thời gian. Ô thiếu không đổi thành 0.",
    ],
    [
      "Phạm vi cấp trên",
      "Đơn vị có số liệu bao gồm cấp dưới sẽ thay thế các cấp dưới khi đơn vị đó có bản được chọn tổng hợp.",
    ],
  ]);
  const detail = wb.addWorksheet("Chi tiết đơn vị");
  detail.addRow([
    "Mã đơn vị",
    "Tên đơn vị",
    "Trạng thái",
    ...fields.map((f) => `${f.key} · ${f.label} (${f.unit})`),
  ]);
  const progress = wb.addWorksheet("Tiến độ");
  progress.addRow([
    "Mã",
    "Đơn vị",
    "Tiến độ",
    "Hoàn thành",
    "Hạn nộp",
    "Đủ lần đầu",
    "Sửa cuối",
    "Thời hạn",
    "Người nhập",
    "Điện thoại",
  ]);
  const notes = wb.addWorksheet("Nhận xét");
  notes.addRow([
    "Mã",
    "Đơn vị",
    "Trạng thái",
    "Hoạt động nổi bật",
    "Khó khăn kiến nghị",
    "Tiến độ nhiệm vụ",
  ]);
  const { selected, excluded } = aggregateScope(
    period.assignments,
    unitGraph,
    includeDrafts,
  );
  const eligible = period.assignments.filter(
    (a) => a.report && (includeDrafts || a.report.status === "COMPLETE"),
  );
  meta.addRow([
    "Đơn vị được chọn",
    unitId ? period.assignments[0].unit.name : "Tất cả đơn vị được giao",
  ]);
  meta.addRow([
    "Đơn vị tính vào tổng",
    selected.map((a) => a.unit.code).join(", "),
  ]);
  meta.addRow([
    "Đơn vị loại để tránh cộng trùng cấp trên",
    eligible
      .filter((a) => !selected.includes(a))
      .map((a) => a.unit.code)
      .join(", "),
  ]);
  meta.addRow([
    "Đơn vị chưa nộp đủ trong kỳ",
    period.assignments
      .filter((a) => a.report?.status !== "COMPLETE")
      .map((a) => a.unit.code)
      .join(", "),
  ]);
  for (const a of period.assignments) {
    const r = a.report;
    const due = a.dueAt || period.dueAt;
    progress.addRow([
      a.unit.code,
      a.unit.name,
      !r
        ? "Chưa nhận dữ liệu"
        : r.status === "COMPLETE"
          ? "Đã nộp đủ"
          : "Gửi tạm",
      r ? `${r.completed}/${r.required}` : "",
      formatDate(due),
      r?.firstCompleteAt ? formatDate(r.firstCompleteAt) : "",
      r ? formatDate(r.updatedAt) : "",
      {
        ON_TIME: "Đúng hạn",
        LATE: "Nộp muộn",
        OVERDUE: "Quá hạn chưa đủ",
        PENDING: "Còn hạn",
      }[timing(due, r?.firstCompleteAt)],
      r?.reporterName || "",
      r?.reporterPhone || "",
    ]);
    if (r && (includeDrafts || r.status === "COMPLETE")) {
      const v = r.values as Record<string, number | null>;
      const n = r.notes as Record<string, string>;
      detail.addRow([
        a.unit.code,
        a.unit.name,
        r.status === "COMPLETE" ? "Đủ" : "Tạm",
        ...fields.map((f) => v[f.key] ?? null),
      ]);
      notes.addRow([
        a.unit.code,
        a.unit.name,
        r.status === "COMPLETE" ? "Đủ" : "Tạm",
        n.highlights,
        n.difficulties,
        n.progress,
      ]);
    }
  }
  const summary = wb.addWorksheet("Tổng hợp");
  summary.addRow([
    "Mã",
    "Nội dung",
    "Đơn vị tính",
    "Tổng số đã nhận",
    "Nguồn chọn có số liệu",
    "Nguồn chọn thiếu ô",
    "Ghi chú",
  ]);
  for (const f of metricSummary(
    period.kind,
    period.assignments,
    unitGraph,
    includeDrafts,
  ).metrics) {
    summary.addRow([
      f.key,
      f.label,
      f.unit,
      f.value,
      f.contributors,
      f.missing,
      f.conditional
        ? "Chỉ tính đơn vị xác nhận có phát sinh/thay đổi."
        : "Tổng nguồn đã chọn trong cùng kỳ; không mặc định là tổng toàn bộ đơn vị phải nộp. Xem sheet Tiến độ.",
    ]);
  }
  for (const sheet of wb.worksheets) {
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF116B59" },
    };
    sheet.columns.forEach((col, i) => {
      col.width = i === 1 ? 52 : 24;
    });
    sheet.eachRow((row) => {
      row.alignment = { vertical: "top", wrapText: true };
    });
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: Math.max(1, sheet.rowCount), column: sheet.columnCount },
    };
  }
  const buffer = await wb.xlsx.writeBuffer();
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="bao-cao-${period.id}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
});
