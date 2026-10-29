export const resetModes = {
  REPORTS: {
    title: "Xóa dữ liệu báo cáo",
    phrase: "XOA BAO CAO",
    description:
      "Xóa số liệu, nhận xét, thông tin người nhập đã lưu và toàn bộ lịch sử gửi của tất cả kỳ. Giữ đơn vị, tài khoản, kỳ báo cáo và hạn nộp.",
  },
  ALL: {
    title: "Xóa toàn bộ dữ liệu",
    phrase: "XOA TOAN BO",
    description:
      "Xóa mọi đơn vị, tài khoản đơn vị, kỳ báo cáo, phân công, số liệu, thông tin người nhập và nhật ký cũ. Giữ các tài khoản admin, nhật ký reset và lịch mặc định; hệ thống sẽ tự tạo lại kỳ theo lịch.",
  },
} as const;
export type ResetMode = keyof typeof resetModes;
