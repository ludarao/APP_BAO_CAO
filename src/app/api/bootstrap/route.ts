import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { endpoint } from "@/lib/http";
import { periodPriority } from "@/lib/schedule-calendar";
export const dynamic = "force-dynamic";
export const GET = endpoint(async (req) => {
  const user = await requireUser(false, true);
  const me = {
    id: user.id,
    username: user.username,
    role: user.role,
    unit: user.unit,
    mustChangePassword: user.mustChangePassword,
  };
  if (user.mustChangePassword) return NextResponse.json({ me });
  if (user.role === "ADMIN") {
    const periods = periodPriority(
      await db().period.findMany({
        orderBy: { startAt: "desc" },
        take: 250,
        omit: { formSnapshot: true },
        include: { _count: { select: { assignments: true } } },
      }),
    );
    const selectedId =
      new URL(req.url).searchParams.get("periodId") || periods[0]?.id;
    const [units, assignments] = await Promise.all([
      db().unit.findMany({
        orderBy: { code: "asc" },
        take: 5000,
        include: {
          users: {
            select: {
              id: true,
              username: true,
              active: true,
              mustChangePassword: true,
            },
          },
        },
      }),
      selectedId
        ? db().assignment.findMany({
            where: { periodId: selectedId },
            include: {
              unit: true,
              report: {
                select: {
                  id: true,
                  version: true,
                  status: true,
                  completed: true,
                  required: true,
                  reporterName: true,
                  reporterPhone: true,
                  firstCompleteAt: true,
                  firstReceivedAt: true,
                  updatedAt: true,
                },
              },
            },
          })
        : [],
    ]);
    return NextResponse.json({
      me,
      periods,
      units,
      assignments,
      selectedId,
      refreshedAt: new Date().toISOString(),
    });
  }
  const [assignments, contacts] = await Promise.all([
    db().assignment.findMany({
      where: {
        unitId: user.unitId!,
        OR: [
          {
            period: { opensAt: { lte: new Date(Date.now() + 45 * 86400000) } },
          },
          { report: { isNot: null } },
        ],
      },
      orderBy: { period: { startAt: "desc" } },
      take: 150,
      include: { period: true, report: true },
    }),
    db().contact.findMany({
      where: { unitId: user.unitId! },
      orderBy: { updatedAt: "desc" },
      take: 30,
    }),
  ]);
  const ordered = periodPriority(
    assignments.map((a) => ({
      ...a,
      opensAt: a.period.opensAt,
      closesAt: a.closesAt || a.period.closesAt,
    })),
  );
  return NextResponse.json({ me, assignments: ordered, contacts });
});
