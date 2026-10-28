import { NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { db } from "@/lib/db";
import { requireUser, rateLimit } from "@/lib/auth";
import { body, endpoint, ApiError } from "@/lib/http";
export const POST = endpoint(async (req) => {
  const actor = await requireUser(true);
  await rateLimit(`reset:${actor.id}`, 20, 60);
  const { userId } = z.object({ userId: z.string() }).parse(await body(req));
  const target = await db().user.findUnique({ where: { id: userId } });
  if (!target || target.role === "ADMIN")
    throw new ApiError(400, "Chỉ đặt lại tài khoản đơn vị tại đây.");
  const password = `Bc!${randomBytes(12).toString("base64url")}`;
  const passwordHash = await hash(password, 12);
  await db().$transaction([
    db().user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: true },
    }),
    db().session.deleteMany({ where: { userId } }),
    db().audit.create({
      data: {
        actorId: actor.id,
        action: "RESET_PASSWORD",
        target: userId,
        detail: {},
      },
    }),
  ]);
  return NextResponse.json({ username: target.username, password });
});
