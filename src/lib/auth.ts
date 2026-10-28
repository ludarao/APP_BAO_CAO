import { cookies } from "next/headers";
import { randomBytes, createHash } from "node:crypto";
import { db } from "./db";
import { ApiError } from "./http";
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const COOKIE = "report_session";
export async function requireUser(admin = false, allowPasswordChange = false) {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) throw new ApiError(401, "Phiên đã hết hạn. Hãy đăng nhập lại.");
  const session = await db().session.findUnique({
    where: { tokenHash: hash(token) },
    include: { user: { include: { unit: true } } },
  });
  if (
    !session ||
    session.expiresAt < new Date() ||
    !session.user.active ||
    (session.user.unit && !session.user.unit.active)
  )
    throw new ApiError(401, "Phiên đã hết hạn hoặc tài khoản đã bị khóa.");
  if (admin && session.user.role !== "ADMIN")
    throw new ApiError(403, "Chỉ quản trị viên được thực hiện.");
  if (!allowPasswordChange && session.user.mustChangePassword)
    throw new ApiError(428, "Bạn cần đổi mật khẩu trước khi tiếp tục.");
  return session.user;
}
export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 12 * 3600_000);
  await db().session.create({
    data: { tokenHash: hash(token), userId, expiresAt },
  });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}
export async function rateLimit(key: string, max: number, seconds: number) {
  const safe = hash(key);
  const rows = await db().$queryRaw<
    { count: number }[]
  >`INSERT INTO "RateLimit" ("key", "count", "resetsAt") VALUES (${safe}, 1, NOW() + ${seconds} * INTERVAL '1 second') ON CONFLICT ("key") DO UPDATE SET "count" = CASE WHEN "RateLimit"."resetsAt" < NOW() THEN 1 ELSE "RateLimit"."count" + 1 END, "resetsAt" = CASE WHEN "RateLimit"."resetsAt" < NOW() THEN NOW() + ${seconds} * INTERVAL '1 second' ELSE "RateLimit"."resetsAt" END RETURNING "count"`;
  if (rows[0].count > max)
    throw new ApiError(
      429,
      "Bạn thao tác quá nhiều lần. Hãy thử lại sau ít phút.",
    );
}
export async function verifyTurnstile(token: string, req: Request) {
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.LOCAL_AUTH_BYPASS === "true"
  )
    return;
  if (!process.env.TURNSTILE_SECRET_KEY || !process.env.APP_URL)
    throw new ApiError(503, "Chưa cấu hình xác minh đăng nhập.");
  const res = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      body: new URLSearchParams({
        secret: process.env.TURNSTILE_SECRET_KEY,
        response: token,
        ...(process.env.VERCEL
          ? {
              remoteip:
                req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "",
            }
          : {}),
      }),
      signal: AbortSignal.timeout(8000),
    },
  );
  const data = await res.json();
  if (
    !data.success ||
    data.hostname !== new URL(process.env.APP_URL).hostname ||
    data.action !== "login"
  )
    throw new ApiError(
      400,
      "Xác minh hết hạn hoặc không hợp lệ. Hãy xác minh lại.",
    );
}
