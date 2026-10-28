import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { COOKIE, hash } from "@/lib/auth";
import { checkOrigin, endpoint } from "@/lib/http";
export const POST = endpoint(async (req) => {
  checkOrigin(req);
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token)
    await db().session.deleteMany({ where: { tokenHash: hash(token) } });
  jar.delete(COOKIE);
  return NextResponse.json({ ok: true });
});
