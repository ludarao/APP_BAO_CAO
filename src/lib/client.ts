"use client";
import { openDB } from "idb";
export async function api(path: string, data?: unknown, method = "POST") {
  let res: Response;
  try {
    res = await fetch(path, {
      ...(data === undefined
        ? {}
        : {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          }),
      cache: "no-store",
    });
  } catch {
    throw Object.assign(
      new Error(
        "Chưa kết nối được máy chủ. Bản nháp vẫn được giữ; hãy thử lại khi có mạng.",
      ),
      { status: 0 },
    );
  }
  const result = await res
    .json()
    .catch(() => ({
      error: "Máy chủ chưa phản hồi dữ liệu hợp lệ. Hãy thử lại.",
    }));
  if (!res.ok) {
    if (res.status === 401 && !path.includes("/auth/login"))
      window.dispatchEvent(new Event("auth-expired"));
    throw Object.assign(new Error(result.error || "Chưa xử lý được yêu cầu."), {
      status: res.status,
      detail: result.detail,
    });
  }
  window.dispatchEvent(new Event("server-connected"));
  return result;
}
async function storage() {
  return openDB("unit-reports-v1", 1, {
    upgrade(db) {
      db.createObjectStore("drafts");
      db.createObjectStore("bootstrap");
    },
  });
}
export async function saveDraft(key: string, value: unknown) {
  const db = await storage();
  await db.put("drafts", value, key);
}
export async function loadDraft<T>(key: string): Promise<T | undefined> {
  const db = await storage();
  return db.get("drafts", key);
}
export async function saveBootstrap(value: unknown) {
  const db = await storage();
  const id = (value as { me: { id: string } }).me.id;
  await db.put("bootstrap", value, id);
  localStorage.setItem("report-last-user", id);
}
export async function loadBootstrap() {
  const id = localStorage.getItem("report-last-user");
  if (!id) return;
  const db = await storage();
  return db.get("bootstrap", id);
}
export async function clearOffline() {
  const db = await storage();
  await db.clear("drafts");
  await db.clear("bootstrap");
  localStorage.removeItem("report-last-user");
}
export function downloadJson(name: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
