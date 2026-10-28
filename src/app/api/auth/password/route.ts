import { compare, hash as hashPassword } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { body, endpoint, ApiError } from "@/lib/http";
import { requireUser, createSession, rateLimit } from "@/lib/auth";
export const POST = endpoint(async (req) => {
  const user = await requireUser(false, true);
  await rateLimit(`password:${user.id}`, 5, 300);
  const input = z
    .object({
      oldPassword: z.string().max(200),
      newPassword: z
        .string()
        .min(12, "Mật khẩu mới cần ít nhất 12 ký tự.")
        .max(72),
    })
    .parse(await body(req, 4096));
  if (Buffer.byteLength(input.newPassword, "utf8") > 72)
    throw new ApiError(400, "Mật khẩu không quá 72 byte UTF-8.");
  if (input.oldPassword === input.newPassword)
    throw new ApiError(400, "Hãy chọn mật khẩu khác mật khẩu cũ.");
  if (!(await compare(input.oldPassword, user.passwordHash)))
    throw new ApiError(400, "Mật khẩu hiện tại không đúng.");
  const passwordHash = await hashPassword(input.newPassword, 12);
  await db().$transaction([
    db().user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: false },
    }),
    db().session.deleteMany({ where: { userId: user.id } }),
  ]);
  await createSession(user.id);
  return NextResponse.json({ ok: true });
});
