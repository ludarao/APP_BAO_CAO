import { expect, it } from "vitest";
import { withRetry } from "../src/lib/retry";
it("thử lại lỗi tạm thời, giữ callback và không lặp vô hạn", async () => {
  let count = 0;
  const value = await withRetry(
    async () => {
      count++;
      if (count < 3) throw new TypeError("network");
      return "receipt";
    },
    3,
    async () => {},
  );
  expect(value).toBe("receipt");
  expect(count).toBe(3);
});
it("không thử lại lỗi quyền hoặc xung đột dữ liệu", async () => {
  let count = 0;
  await expect(
    withRetry(
      async () => {
        count++;
        throw { status: 409 };
      },
      3,
      async () => {},
    ),
  ).rejects.toEqual({ status: 409 });
  expect(count).toBe(1);
});
it("dừng sau số lần đã giới hạn", async () => {
  let count = 0;
  await expect(
    withRetry(
      async () => {
        count++;
        throw { status: 503 };
      },
      2,
      async () => {},
    ),
  ).rejects.toEqual({ status: 503 });
  expect(count).toBe(3);
});
