import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { endpoint, ApiError } from "@/lib/http";
export const GET = endpoint(async (req) => {
  const user = await requireUser();
  const id = new URL(req.url).searchParams.get("reportId");
  if (id) {
    const report = await db().report.findUnique({
      where: { id },
      include: { assignment: true },
    });
    if (
      !report ||
      (user.role !== "ADMIN" && report.assignment.unitId !== user.unitId)
    )
      throw new ApiError(404, "Không tìm thấy báo cáo.");
    const revisions = await db().revision.findMany({
      where: { reportId: id },
      orderBy: { version: "desc" },
      take: 100,
      select: {
        id: true,
        version: true,
        status: true,
        reporterName: true,
        reporterPhone: true,
        receivedAt: true,
        dueAt: true,
        values: true,
        notes: true,
      },
    });
    return NextResponse.json({ revisions });
  }
  if (user.role !== "ADMIN") throw new ApiError(403, "Không có quyền.");
  return NextResponse.json({
    audits: await db().audit.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  });
});
