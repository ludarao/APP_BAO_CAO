import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { endpoint, ApiError } from "@/lib/http";
export const GET = endpoint(async (req) => {
  const secret = process.env.CRON_SECRET;
  const received = req.headers.get("authorization") || "";
  const expected = `Bearer ${secret || ""}`;
  if (
    !secret ||
    Buffer.byteLength(received) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(received), Buffer.from(expected))
  )
    throw new ApiError(401, "Không có quyền.");
  const now = new Date();
  const [sessions, limits] = await db().$transaction([
    db().session.deleteMany({ where: { expiresAt: { lt: now } } }),
    db().rateLimit.deleteMany({ where: { resetsAt: { lt: now } } }),
  ]);
  return NextResponse.json({
    removedSessions: sessions.count,
    removedLimits: limits.count,
  });
});
