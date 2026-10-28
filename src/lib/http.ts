import { NextResponse } from "next/server";
import { ZodError } from "zod";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public detail?: unknown,
  ) {
    super(message);
  }
}
export function checkOrigin(req: Request) {
  const expected = process.env.APP_URL
    ? new URL(process.env.APP_URL).origin
    : new URL(req.url).origin;
  if (req.headers.get("origin") !== expected)
    throw new ApiError(
      403,
      "Nguồn yêu cầu không hợp lệ. Hãy tải lại ứng dụng.",
    );
}
export async function body(req: Request, limit = 256 * 1024) {
  checkOrigin(req);
  if (!req.headers.get("content-type")?.includes("application/json"))
    throw new ApiError(415, "Yêu cầu dữ liệu JSON.");
  if (Number(req.headers.get("content-length") || 0) > limit)
    throw new ApiError(413, "Dữ liệu gửi quá lớn.");
  const reader = req.body?.getReader();
  if (!reader) throw new ApiError(400, "Thiếu dữ liệu.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      throw new ApiError(413, "Dữ liệu gửi quá lớn.");
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ApiError(400, "JSON không hợp lệ.");
  }
}
export function endpoint(fn: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    try {
      return await fn(req);
    } catch (e) {
      if (e instanceof ApiError)
        return NextResponse.json(
          { error: e.message, detail: e.detail },
          { status: e.status },
        );
      if (e instanceof ZodError)
        return NextResponse.json(
          {
            error: e.issues[0]?.message || "Dữ liệu không hợp lệ.",
            issues: e.issues,
          },
          { status: 400 },
        );
      const code = (e as { code?: string }).code;
      if (code === "P2002")
        return NextResponse.json(
          {
            error:
              "Dữ liệu bị trùng. Hãy tải lại và kiểm tra mã đơn vị hoặc tên đăng nhập.",
          },
          { status: 409 },
        );
      if (["P2034", "P2024", "P2028"].includes(code || ""))
        return NextResponse.json(
          {
            error: "Hệ thống đang bận. Dữ liệu vẫn được giữ; hãy thử gửi lại.",
          },
          { status: 503, headers: { "Retry-After": "3" } },
        );
      console.error(
        "API error",
        e instanceof Error ? e.name : "Unknown",
        code || "",
      );
      return NextResponse.json(
        {
          error: process.env.DATABASE_URL
            ? "Chưa xử lý được yêu cầu. Hãy thử lại."
            : "Chưa kết nối database. Hãy cấu hình theo README.",
        },
        { status: 503 },
      );
    }
  };
}
