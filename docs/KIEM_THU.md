# Kết quả kiểm tra bản đầu

Ngày kiểm tra: 28/10/2026, giờ Việt Nam. Môi trường: Next.js 16.4.3, Prisma ORM 7.10.1, Node.js 24, PostgreSQL chạy trên máy local. Không dùng dữ liệu báo cáo thực.

## Kiểm tra đã qua

- Build production thành công, kiểm tra TypeScript thành công.
- 13 unit tests: danh mục đúng 20/36/47 ô; phần bổ sung tháng; ô trống khác 0; tổng người không trùng; kiểm tra số nguyên, số âm, phạm vi mã; ranh giới nộp muộn; khôi phục nháp chưa có người nhập; retry lỗi mạng, dừng khi hết lượt và không retry xung đột.
- 37 kiểm tra tích hợp qua HTTP API và Postgres thật: xác thực, CSRF, cấp tài khoản theo lô, idempotency lô, chặn vòng cấp trên, đổi mật khẩu bắt buộc, thu hồi phiên, phân quyền admin/đơn vị, giao kỳ, cô lập dữ liệu đơn vị, gửi thiếu/âm, gửi tạm/đủ, idempotency gửi, xung đột cập nhật đồng thời, số phiên bản, hạn riêng và lịch sử hạn, chặn sau khóa, khóa đơn vị, xuất Excel mặc định loại cả số liệu và nhận xét bản tạm, tránh cộng trùng cấp trên/cấp dưới kể cả khi cấp trung gian không được giao kỳ.
- `npm audit`: không có lỗ hổng được báo tại lúc kiểm tra.
- Kiểm tra trình duyệt: màn hình đăng nhập, dashboard quản trị, danh sách đơn vị, biểu tạo đơn vị, biểu tạo kỳ, giao diện nhập theo nhóm, nhập thông tin người gửi, tự lưu nháp. Dashboard được kiểm tra ở viewport rộng và điện thoại 390 × 844.
- Kiểm tra offline trên bản production local: tải biểu, nhập số 18 vào mã 23 và thông tin người nhập, dừng máy chủ, tải lại trang, mở lại biểu và thấy đúng số 18 cùng thông tin đã nhập. Khởi động máy chủ trở lại, Gửi tạm thành công và nhận biên nhận phiên bản 1.

## Kiểm thử gửi đồng thời trên production local

Mỗi người dùng có một phiên hợp lệ đã được tạo trước, gửi cùng lúc một báo cáo tuần 20 ô. Pool ứng dụng mặc định 2 kết nối mỗi process. Script có cơ chế thử lại tối đa 3 lần với lỗi tạm thời, giữ nguyên idempotency key; cả ba lượt production bên dưới đều không cần retry.

| Người gửi đồng thời | Thành công | Số report / revision | p95      | p99      | Retry |
| ------------------- | ---------- | -------------------- | -------- | -------- | ----- |
| 100                 | 100        | 100 / 100            | 362 ms   | 365 ms   | 0     |
| 300                 | 300        | 300 / 300            | 555 ms   | 565 ms   | 0     |
| 500                 | 500        | 500 / 500            | 1.021 ms | 1.038 ms | 0     |

Kết quả máy đọc được nằm trong `.local/load-100.json`, `.local/load-300.json`, `.local/load-500.json`; dữ liệu của các lượt tải đã được dọn sau kiểm tra.

Trước đó, dev server có một số kết nối TCP bị từ chối/ngắt khi dồn 300 kết nối; các lượt đó không đạt và không được dùng làm số liệu đạt ở bảng trên. Client đã có retry có giãn cách cho lỗi mạng/502/503/504; server giữ biên nhận để gửi lại không tạo trùng.

## Phạm vi chưa xác minh

- Chưa triển khai lên Vercel hay kết nối Prisma Postgres cloud: đang chờ cấu hình cloud, tên project và đăng nhập Vercel CLI.
- Chưa đo cold start, mạng người dùng, pool của gói Prisma Free hoặc hàng trăm lượt đăng nhập cùng lúc có hashing mật khẩu và Turnstile thật.
- Turnstile production đã có kiểm tra secret/hostname/action tại server nhưng chưa kiểm tra end-to-end với widget thật của project.
- Chưa kiểm tra khôi phục từ bản backup cloud; cần thiết lập trước vận hành chính thức.
- Kết quả local không phải cam kết tốc độ hay khả năng chịu tải của gói Vercel/Prisma miễn phí.
