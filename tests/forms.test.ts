import { describe, expect, it } from "vitest";
import {
  applicableFields,
  canonicalValues,
  inspectValues,
  fields,
  slug,
  timing,
  reportSchema,
  draftImportSchema,
} from "../src/lib/forms";
describe("Danh mục từ biểu gốc", () => {
  const optional = { training: false, staffing: false };
  it("đúng số ô, mã và phần bổ sung tháng", () => {
    expect(fields).toHaveLength(47);
    expect(new Set(fields.map((f) => f.code)).size).toBe(43);
    expect(applicableFields("WEEK", optional)).toHaveLength(20);
    expect(applicableFields("MONTH", optional)).toHaveLength(36);
    expect(
      applicableFields("MONTH", { training: true, staffing: true }),
    ).toHaveLength(47);
    expect(
      fields.some((f) => ["27", "40", "41", "43", "44"].includes(f.code)),
    ).toBe(false);
  });
  it("không coi ô trống là số 0", () => {
    const values = Object.fromEntries(
      applicableFields("WEEK", optional).map((f) => [f.key, 0]),
    );
    expect(inspectValues("WEEK", values, optional).complete).toBe(true);
    delete values["23"];
    expect(inspectValues("WEEK", values, optional).complete).toBe(false);
    expect(canonicalValues("WEEK", values, optional)["23"]).toBeNull();
  });
  it("tháng phải xác nhận phần phát sinh dù đã nhập đủ ô", () => {
    const values = Object.fromEntries(
      applicableFields("MONTH", optional).map((f) => [f.key, 0]),
    );
    expect(
      inspectValues("MONTH", values, { training: null, staffing: null })
        .complete,
    ).toBe(false);
  });
  it("ngăn tổng không trùng vô lý nhưng cho giao nhau", () => {
    expect(
      inspectValues("WEEK", { "25_1": 5, "25_2": 4, "25_3": 6 }, optional)
        .errors,
    ).toEqual({});
    expect(
      inspectValues("WEEK", { "25_1": 5, "25_2": 4, "25_3": 4 }, optional)
        .errors["25_3"],
    ).toBeTruthy();
    expect(
      inspectValues("WEEK", { "25_1": 5, "25_2": 4, "25_3": 10 }, optional)
        .errors["25_3"],
    ).toBeTruthy();
  });
  it("không ép số kiến nghị giải quyết nhỏ hơn tiếp nhận trong kỳ", () => {
    expect(
      inspectValues("MONTH", { "21": 2, "22": 8 }, optional).errors,
    ).toEqual({});
  });
  it("không nhận ô ngoài biểu và không nhận số âm/lẻ", () => {
    expect(
      inspectValues("WEEK", { "01": 3 }, optional).errors["01"],
    ).toBeTruthy();
    expect(
      inspectValues("WEEK", { "23": -1 }, optional).errors["23"],
    ).toBeTruthy();
    expect(
      inspectValues("WEEK", { "23": 1.5 }, optional).errors["23"],
    ).toBeTruthy();
  });
});
describe("Thời hạn và định danh", () => {
  it("đúng ranh giới hạn nộp, không lấy lần gửi tạm để đánh giá đủ đúng giờ", () => {
    const due = "2026-10-28T10:00:00Z";
    expect(timing(due, due)).toBe("ON_TIME");
    expect(timing(due, "2026-10-28T10:00:01Z")).toBe("LATE");
    expect(timing(due, null, new Date("2026-10-28T10:00:01Z"))).toBe("OVERDUE");
  });
  it("chuẩn hóa tiếng Việt", () => {
    expect(slug("Công an phường An Bình")).toBe("cong_an_phuong_an_binh");
    expect(slug("Đội 01")).toBe("doi_01");
  });
  it("schema giới hạn kiểu dữ liệu và thông tin người nhập", () => {
    expect(reportSchema.safeParse({}).success).toBe(false);
  });
  it("khôi phục được nháp chưa điền thông tin người nhập", () => {
    expect(
      draftImportSchema.safeParse({
        periodId: "test",
        formVersion: 1,
        version: 0,
        values: {},
        optional: { training: null, staffing: null },
        notes: { highlights: "", difficulties: "", progress: "" },
        reporterName: "",
        reporterPhone: "",
      }).success,
    ).toBe(true);
  });
});
