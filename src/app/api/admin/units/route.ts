import { NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes, randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import { db } from "@/lib/db";
import { requireUser, rateLimit } from "@/lib/auth";
import { body, endpoint, ApiError } from "@/lib/http";
import { unitRowSchema } from "@/lib/admin";
import { slug } from "@/lib/forms";
export const maxDuration = 60;
export const POST = endpoint(async (req) => {
  const actor = await requireUser(true);
  await rateLimit(`import:${actor.id}`, 20, 60);
  const input = z
    .object({ rows: z.array(unitRowSchema).min(1).max(50), batchId: z.uuid() })
    .parse(await body(req));
  const seen = new Set<string>();
  for (const row of input.rows) {
    if (seen.has(row.code)) throw new ApiError(400, `Trùng mã ${row.code}.`);
    seen.add(row.code);
  }
  const existing = await db().unit.findMany({
    where: { code: { in: input.rows.map((r) => r.code) } },
  });
  const existingCodes = new Set(existing.map((u) => u.code));
  const credentials = await Promise.all(
    input.rows.map(async (row) => {
      if (existingCodes.has(row.code)) return null;
      const username =
        row.username || `${slug(row.name).slice(0, 50)}_${slug(row.code)}`;
      const password = `Bc!${randomBytes(12).toString("base64url")}`;
      return {
        code: row.code,
        username,
        password,
        passwordHash: await hash(password, 12),
      };
    }),
  );
  const result = await db().$transaction(
    async (tx) => {
      // Serialize rare admin imports to validate the complete parent graph and batch identity.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(701028)`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(701029)`;
      const previous = await tx.audit.findFirst({
        where: { action: "IMPORT_UNITS", target: input.batchId },
      });
      if (previous)
        return {
          repeated: true,
          created: 0,
          updated: 0,
          createdCodes: [] as string[],
        };
      const graph = new Map(
        (
          await tx.unit.findMany({ select: { code: true, parentCode: true } })
        ).map((u) => [u.code, u.parentCode]),
      );
      for (const r of input.rows) graph.set(r.code, r.parentCode || null);
      for (const r of input.rows) {
        const chain = new Set<string>([r.code]);
        let parent = r.parentCode;
        while (parent) {
          if (!graph.has(parent))
            throw new ApiError(
              400,
              `Đơn vị cấp trên ${parent} chưa tồn tại. Nhập cấp trên trước.`,
            );
          if (chain.has(parent))
            throw new ApiError(400, `Quan hệ cấp trên bị vòng tại ${r.code}.`);
          chain.add(parent);
          parent = graph.get(parent) || "";
        }
      }
      let created = 0;
      let updated = 0;
      const createdCodes: string[] = [];
      const createdIds: string[] = [];
      for (const row of input.rows) {
        const account = credentials.find((c) => c?.code === row.code);
        const old = await tx.unit.findUnique({ where: { code: row.code } });
        if (old) {
          await tx.unit.update({
            where: { id: old.id },
            data: {
              name: row.name,
              group: row.group,
              parentCode: row.parentCode || null,
              scope: row.scope,
            },
          });
          updated++;
        } else {
          if (!account)
            throw new ApiError(
              409,
              "Danh sách đơn vị vừa thay đổi. Hãy xem trước lại.",
            );
          const added = await tx.unit.create({
            data: {
              code: row.code,
              name: row.name,
              group: row.group,
              parentCode: row.parentCode || null,
              scope: row.scope,
              users: {
                create: {
                  username: account.username,
                  passwordHash: account.passwordHash,
                },
              },
            },
          });
          created++;
          createdIds.push(added.id);
          createdCodes.push(row.code);
        }
      }
      if (createdIds.length) {
        const periods = await tx.period.findMany({
          where: { autoKey: { not: null }, dueAt: { gte: new Date() } },
          select: { id: true },
        });
        const assignments = periods.flatMap((period) =>
          createdIds.map((unitId) => ({ periodId: period.id, unitId })),
        );
        for (let i = 0; i < assignments.length; i += 5000)
          await tx.assignment.createMany({
            data: assignments.slice(i, i + 5000),
            skipDuplicates: true,
          });
      }
      await tx.audit.create({
        data: {
          actorId: actor.id,
          action: "IMPORT_UNITS",
          target: input.batchId,
          detail: { created, updated, codes: input.rows.map((r) => r.code) },
        },
      });
      return { repeated: false, created, updated, createdCodes };
    },
    { maxWait: 10000, timeout: 20000 },
  );
  return NextResponse.json({
    repeated: result.repeated,
    created: result.created,
    updated: result.updated,
    credentials: credentials
      .filter((c) => c && result.createdCodes.includes(c.code))
      .map((c) => ({
        code: c!.code,
        username: c!.username,
        password: c!.password,
      })),
    requestId: randomUUID(),
  });
});
export const PATCH = endpoint(async (req) => {
  const actor = await requireUser(true);
  const input = z
    .object({ unitId: z.string(), active: z.boolean() })
    .parse(await body(req));
  await db().$transaction(async (tx) => {
    await tx.unit.update({
      where: { id: input.unitId },
      data: { active: input.active },
    });
    if (!input.active)
      await tx.session.deleteMany({
        where: { user: { unitId: input.unitId } },
      });
    await tx.audit.create({
      data: {
        actorId: actor.id,
        action: "UNIT_ACTIVE",
        target: input.unitId,
        detail: { active: input.active },
      },
    });
  });
  return NextResponse.json({ ok: true });
});
