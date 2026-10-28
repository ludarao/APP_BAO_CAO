# Cổng báo cáo đơn vị PX03

Ứng dụng Next.js + Prisma Postgres cho nhập số liệu tuần, tháng, quý, 6 tháng và năm. Danh mục 47 ô được lấy từ DOCX trong thư mục gốc; không tự thêm 5 mã chưa có nội dung.

Production: https://app-bao-cao-ten.vercel.app. Cấu hình hạ tầng và quy trình vận hành được ghi tại [docs/VERCEL.md](docs/VERCEL.md).

## Đã triển khai

- Đăng nhập bằng tài khoản đơn vị, cookie phiên HttpOnly, đổi mật khẩu bắt buộc lần đầu, thu hồi phiên khi đổi/đặt lại mật khẩu hoặc khóa đơn vị.
- Turnstile xác minh server, giới hạn đăng nhập theo IP/tài khoản; production không cho dùng bypass local.
- Quản trị đơn vị: tạo thủ công/cập nhật, import `.xlsx` có mẫu và xem trước, kiểm tra trùng/quan hệ cấp trên, cấp mật khẩu ngẫu nhiên riêng, tải danh sách tài khoản một lần, đặt lại mật khẩu.
- Tạo kỳ và giao đơn vị, tạo trước tối đa 12 kỳ tuần, thời điểm mở/hạn/khóa; sửa thời gian chung hoặc hạn riêng theo đơn vị, có nhật ký.
- Biểu theo nhóm và loại kỳ, xác nhận phát sinh tháng, phân biệt ô trống/0, kiểm tra số liệu và tổng không trùng mã 25.
- Nháp IndexedDB, tải/khôi phục JSON, bộ khung offline bằng service worker trong production. Không gửi request theo thao tác gõ số. Có Gửi tạm và Nộp đủ, thông tin người nhập được lưu để chọn nhanh.
- Biên nhận, phiên bản và lịch sử; giao dịch Postgres, khóa hàng khi gửi, idempotency và kiểm tra version tránh gửi trùng/ghi đè.
- Dashboard, tìm/lọc, tiến độ, nộp muộn, danh sách cần nhắc, export Excel 5 sheet. Cấu hình số liệu đơn vị cấp trên đã bao gồm cấp dưới để tránh cộng trùng.
- Cron mỗi ngày dọn session và bộ đếm rate limit đã hết hạn, không xóa báo cáo/lịch sử.

## Chạy thử local

Yêu cầu Node.js 24 LTS, npm. Không cần Docker hay PostgreSQL cài sẵn trên macOS/Linux được embedded-postgres hỗ trợ.

```sh
npm install
npm run db:local
```

Giữ terminal database chạy. Lần đầu, lệnh tự tạo `.env` và database chỉ lắng nghe `127.0.0.1:54329`. Mật khẩu local được sinh ngẫu nhiên; không in ra log. Không chạy `db:local` với cấu hình cloud.

Trong terminal khác:

```sh
npm run db:migrate
npm run db:seed
npm run dev
```

Mở http://localhost:3000. Tài khoản admin và đơn vị mẫu nằm trong `.local/demo-credentials.json`; phải đổi mật khẩu khi đăng nhập lần đầu. Seed chạy lại giữ mật khẩu hiện có. Bản local có 8 đơn vị và 3 kỳ mang nhãn MẪU; dữ liệu không phải báo cáo thực.

Nếu đã có `.env`, `db:local` không ghi đè; cấu hình cần dùng host localhost/127.0.0.1 và port 54329. Mã nguồn và dữ liệu local tách riêng; `.env`, `.local`, file credentials đã được Git ignore.

## Đưa lên Vercel và Prisma Postgres

1. Tạo Prisma Postgres và lấy pooled PostgreSQL URL cho ứng dụng cùng direct URL dành cho migration. Dùng dạng `postgresql://` hoặc `postgres://`, không dùng URL Accelerate cũ. Giữ SSL theo hướng dẫn Prisma.
2. Đưa repository lên Git của bạn, import project vào Vercel, chọn Node.js 24.x. Cấu hình các biến bên dưới ở đúng môi trường Production/Preview. Không upload thư mục `.local` hoặc file credentials.
3. Tạo Turnstile widget trên Cloudflare, khai báo hostname thực tế. Dùng site key và secret key thật, không dùng test key trong production.
4. Đặt các biến môi trường, thay `APP_URL` bằng origin chính xác, không có đường dẫn. Preview có hostname riêng phải có cấu hình phù hợp; không tắt kiểm tra Origin hoặc Turnstile để mở preview.
5. Trên máy quản trị, tạo `.env.cloud` theo `.env.example`, giữ riêng `.env` local. Chạy `DOTENV_CONFIG_PATH=.env.cloud npm run db:migrate` và `DOTENV_CONFIG_PATH=.env.cloud npm run db:seed` một lần. `SEED_DEMO` phải bỏ hoặc đặt `false`; chỉ seed admin, không có tài khoản mẫu. `.env.cloud` đã được Git ignore.
6. Deploy Vercel. Build mặc định `npm run build`; migration chạy riêng có chủ đích, không chạy trong mọi preview build.
7. Đăng nhập admin, đổi mật khẩu, import Excel, kiểm tra đơn vị cấp trên và phạm vi số liệu, tạo kỳ chạy thử với vài đơn vị. Kiểm thử tải trên đúng cloud trước khi mở rộng.

| Biến                             | Mục đích                                                                                          |
| -------------------------------- | ------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                   | Kết nối pooled PostgreSQL của Prisma Postgres                                                     |
| `DIRECT_URL`                     | Kết nối migration/direct; dùng trong môi trường quản trị chạy migration                           |
| `APP_URL`                        | Origin chính xác, ví dụ `https://bao-cao.example.vn`                                              |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Site key được nhúng lúc build                                                                     |
| `TURNSTILE_SECRET_KEY`           | Secret chỉ ở server                                                                               |
| `CRON_SECRET`                    | Chuỗi ngẫu nhiên ít nhất 32 ký tự; Vercel cron gửi Bearer token                                   |
| `DB_POOL_MAX`                    | Mặc định 2 kết nối mỗi instance; điều chỉnh theo giới hạn pool của gói                            |
| `ADMIN_USERNAME`                 | Dùng lúc seed, mặc định `admin`                                                                   |
| `ADMIN_PASSWORD`                 | Dùng lúc seed, ít nhất 12 ký tự và tối đa 72 byte UTF-8; xóa khỏi môi trường runtime sau khi seed |
| `LOCAL_AUTH_BYPASS`              | Chỉ có tác dụng ngoài production; không đặt trên cloud                                            |

Production từ chối đăng nhập khi thiếu Turnstile hoặc `APP_URL`. Vercel cung cấp lớp DDoS nền; cần cấu hình Firewall/WAF phù hợp gói cho endpoint login trước khi vận hành, tránh giới hạn IP quá thấp vì nhiều đơn vị có thể dùng chung NAT. Turnstile và giới hạn ứng dụng không phải cam kết chống mọi DDoS.

Khi dùng Prisma qua Vercel Marketplace, integration có thể đưa URL direct vào `DATABASE_URL`; adapter runtime tự chuyển hostname `db.prisma.io` sang `pooled.db.prisma.io`, giữ nguyên credential/SSL. Prisma CLI vẫn dùng URL direct cho migration. Nếu Vercel đánh dấu URL là Sensitive và không cho kéo về máy, chạy migration và seed trong một deployment khởi tạo có chủ đích trên Vercel; không dùng placeholder do `env pull` tạo ra. Build khởi tạo: `npm run db:generate && npm run db:migrate && npm run db:seed && npm run build`. Sau khi khởi tạo, giữ build mặc định `npm run build` và bỏ `ADMIN_PASSWORD` khỏi cấu hình cloud. Functions được đặt tại Singapore (`sin1`).

Không có thông tin project/credentials cloud được đưa sẵn vào mã nguồn. Chưa cấu hình các biến trên thì chưa phải bản đã triển khai cloud.

## Nghiệp vụ quan trọng

- Thời gian hiển thị theo Việt Nam, lưu UTC. Hạn riêng có ưu tiên hơn hạn chung. Sửa hạn chung giữ nguyên hạn riêng.
- Nộp đủ lần đầu là mốc xác định đúng/muộn; gửi tạm trước hạn không được tính là đủ đúng hạn. Sửa sau khi nộp đủ không làm mất lịch sử mốc đủ đầu tiên.
- Sau khóa, từ chối lần gửi mới nhưng trả lại biên nhận của request idempotent đã nhận trước đó.
- Bản tạm không vào tổng hợp mặc định. Có thể chọn xuất gồm bản tạm và file ghi rõ phạm vi. Ô thiếu để trống.
- Tổng hợp giữa các đơn vị trong cùng kỳ; chưa tự cộng tuần lên tháng/quý để tránh sai chỉ tiêu quân số, hiện trạng, số người duy nhất và khoảng thời gian chồng lấn.
- `DIRECT`: đơn vị chỉ nhập số của chính mình. `INCLUDES_CHILDREN`: số đã gồm cấp dưới; khi có bản đủ được chọn, file tổng hợp loại các cấp dưới để tránh cộng trùng, ghi rõ nguồn ở sheet Thông tin. Khai báo đầy đủ chuỗi đơn vị cấp trên.
- Các mã 27, 40, 41, 43, 44 không có ô nhập. Mã 25, 37, 38 được tách khóa kỹ thuật nhưng giữ mã gốc trong danh mục.
- Admin chỉ nhìn thấy dữ liệu đã gửi, không nhìn được nháp cục bộ. Nháp có thể mất khi xóa dữ liệu trình duyệt; dùng Tải nháp để dự phòng. Đăng xuất mặc định xóa nháp và dữ liệu offline trên thiết bị.
- Danh sách người nhập giới hạn theo đơn vị. Biên nhận giữ tên/số điện thoại của đúng lần gửi kể cả sau khi sửa danh bạ.

## Kiểm tra

```sh
npm run typecheck
npm test
npm run build
npm audit
```

Với database local và `npm run dev` đang chạy:

```sh
npm run test:integration
LOAD_USERS=100 npm run test:load
LOAD_USERS=300 npm run test:load
LOAD_USERS=500 npm run test:load
```

Test integration tạo dữ liệu riêng và dọn sau khi chạy. Test tải chỉ cho phép app/database localhost, dùng phiên xác thực trước và gửi một báo cáo đồng thời cho mỗi đơn vị. Nó đo luồng gửi; không đo hashing đăng nhập, cold start hoặc mạng cloud. Kết quả lưu `.local/load-*.json`. Không suy ra năng lực gói Prisma/Vercel từ kết quả local.

Kết quả và giới hạn kiểm tra bản đầu được ghi trong `docs/KIEM_THU.md`. Client giữ idempotency key khi thử lại tối đa 3 lần với lỗi mạng/502/503/504, giãn cách tăng dần có jitter; lỗi quyền, nhập liệu hoặc xung đột phải xử lý trực tiếp.

## Sao lưu và phần phát triển tiếp

Prisma Free cần xác nhận quyền lợi backup trong console. Trước vận hành chính thức, thiết lập sao lưu database ra nơi riêng, kiểm tra khôi phục và theo dõi quota operations/dung lượng. File Excel tổng hợp không thay thế bản backup. Không có job backup cloud nào được kích hoạt sẵn.

Xuất Word/PDF theo bố cục hành chính, tự gợi ý số liệu giữa các kỳ, gửi nhắc qua email/SMS/Zalo, khôi phục phiên bản cũ và trình chỉnh sửa danh mục biểu là các hạng mục tiếp theo. Bản hiện tại đã có xuất Excel và lịch sử đọc lại từng lần gửi. Chưa có việc gửi tin tự động ra ngoài.
