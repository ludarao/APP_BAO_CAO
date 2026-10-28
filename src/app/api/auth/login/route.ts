import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { endpoint, body, ApiError } from "@/lib/http";
import { createSession, rateLimit, verifyTurnstile } from "@/lib/auth";
export const POST = endpoint(async (req) => {
  const input = z
    .object({
      username: z.string().trim().min(1).max(100),
      password: z.string().min(1).max(200),
      turnstileToken: z.string().max(2048).default(""),
    })
    .parse(await body(req, 4096));
  await verifyTurnstile(input.turnstileToken, req);
  // Vercel overwrites X-Forwarded-For. Do not trust client-supplied proxy headers on local/self-hosted servers.
  const ip = process.env.VERCEL
    ? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
    : "local";
  await rateLimit(`login-ip:${ip}`, 1000, 300);
  await rateLimit(`login-user:${input.username.toLowerCase()}`, 10, 300);
  const user = await db().user.findUnique({
    where: { username: input.username.toLowerCase() },
    include: { unit: true },
  });
  const valid = await compare(
    input.password,
    user?.passwordHash ||
      "$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW",
  );
  if (!valid || !user || !user.active || (user.unit && !user.unit.active))
    throw new ApiError(401, "Tên đăng nhập hoặc mật khẩu không đúng.");
  await createSession(user.id);
  return NextResponse.json({ mustChangePassword: user.mustChangePassword });
});
