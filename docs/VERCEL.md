# Cấu hình Vercel và Prisma Postgres

Project: `tcllct/app-bao-cao`. Repository: `ludarao/APP_BAO_CAO`, nhánh `main`.

Địa chỉ production: https://app-bao-cao-ten.vercel.app

## Hạ tầng đã thiết lập ngày 28/10/2026

- Next.js trên Node.js 24.x, Functions tại Singapore (`sin1`). Build có thể chạy tại khu vực khác; đây không phải vị trí runtime.
- Prisma Postgres Free: `prisma-postgres-violet-anchor`, kết nối Production và Preview qua Marketplace. Development local tiếp tục dùng database riêng trên máy.
- Migration `202610280001_initial` đã áp dụng trên cloud, tài khoản admin đã seed. Không đưa dữ liệu mẫu local lên production.
- Runtime chuyển URL direct của Marketplace sang hostname pooled. Migration dùng URL direct.
- Đã đặt `APP_URL`, `DB_POOL_MAX=2`, `ADMIN_USERNAME`, `CRON_SECRET` cho Production.
- Mật khẩu khởi tạo admin được giữ riêng tại `.local/cloud-admin.json` trên máy thiết lập, không đưa lên Git. Người quản trị phải đổi mật khẩu lần đầu.
- `ADMIN_PASSWORD` chỉ được dùng cho deployment khởi tạo, sau đó xóa khỏi biến môi trường của project.

## Build và migration

Build mặc định của project giữ nguyên `npm run build`. Deployment khởi tạo sử dụng override riêng:

```sh
npm run db:generate && npm run db:migrate && npm run db:seed && npm run build
```

Các deployment thường dùng `npm run build`, không tự seed lại tài khoản hoặc tự sửa schema. Với thay đổi schema sau này, chạy migration trong một deployment quản trị có chủ đích hoặc từ môi trường quản trị có direct URL hợp lệ.

Vercel có thể không cho kéo giá trị Sensitive về local; `vercel env pull` khi đó để placeholder hoặc giữ giá trị cũ. Không dùng placeholder làm URL migration. Không tắt bảo vệ Sensitive để lấy mật khẩu database.

## Turnstile

Đặt `NEXT_PUBLIC_TURNSTILE_SITE_KEY` và `TURNSTILE_SECRET_KEY` ở Production. Widget cần cho phép hostname `app-bao-cao-ten.vercel.app`. Sau khi thêm/đổi key phải redeploy vì site key được nhúng lúc build. App kiểm tra token tại server, hostname và action `login`; khi thiếu key thì từ chối đăng nhập.

Hai khóa đã được cấu hình cho Production trong lần thiết lập này; secret được lưu dưới dạng Sensitive.

Đã kiểm tra đăng nhập admin thành công với widget Turnstile thật trên production và đến màn hình đổi mật khẩu lần đầu. Người quản trị tự chọn, nhập và xác nhận mật khẩu mới. Các domain alias khác không tự được cấp quyền đăng nhập vì `APP_URL` và hostname Turnstile được kiểm tra chính xác.

## Kiểm tra cloud đã thực hiện

- Trang chủ production: HTTP 200.
- `/api/bootstrap` không có phiên: HTTP 401.
- `/api/maintenance` với Bearer secret: HTTP 200, thực thi truy vấn trên database production thành công.
- Token Turnstile không hợp lệ bị từ chối bằng HTTP 400. Widget thật báo thành công và đăng nhập admin hợp lệ đã qua.
- Deployment chạy build thường `npm run build`; biến `ADMIN_PASSWORD` đã được xóa trước deployment này. Mật khẩu tài khoản được lưu dưới dạng hash trong database.
- Mật khẩu, URL database và secret không được ghi vào tài liệu này.

Kiểm thử 500 lượt gửi đồng thời trước đây là trên local, không phải benchmark của cloud. Cần kiểm thử tải và cấu hình sao lưu riêng trước khi sử dụng diện rộng. Preview hiện kết nối cùng database với Production; không dùng Preview để ghi số liệu thử vào database thật.
