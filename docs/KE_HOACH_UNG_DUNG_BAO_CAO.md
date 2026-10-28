# Kế hoạch ứng dụng nhập và tổng hợp báo cáo

Ngày lập: 28/10/2026. Trạng thái: phương án đề xuất để triển khai; chưa xây dựng ứng dụng và chưa kiểm thử tải.

Mục tiêu là cấp tài khoản cho từng đơn vị, thu thập đúng biểu theo kỳ, theo dõi tiến độ và xuất số liệu tổng hợp. Ưu tiên nhập thuận tiện, lưu nháp trên thiết bị, ít request và vận hành ban đầu bằng Vercel cùng Prisma Postgres.

## 1. Kết quả đọc biểu gốc

Nguồn: `Bieu_nhap_lieu_theo_tuan_thang_quy_6_thang_nam.docx` trong thư mục dự án.

| Loại kỳ | Nội dung | Số ô số liệu |
| --- | --- | --- |
| Tuần | Nhóm 3 và 4; mã 23–26, 28–39 | 20 |
| Tháng | Nhóm 1, 3, 4, 6 | 36 ô thường kỳ |
| Tháng có phát sinh | Thêm mã 09–18 và 42 | Tối đa thêm 11 ô |
| Quý | Cả 6 nhóm | 47 |
| 6 tháng | Giống danh mục biểu quý | 47 |
| Năm | Giống danh mục biểu quý | 47 |

Số ô lớn hơn số mã vì mã 25 có ba dòng, mã 37 và 38 mỗi mã có hai dòng. Cần mã kỹ thuật riêng cho từng dòng, đồng thời giữ mã biểu gốc khi hiển thị và xuất báo cáo.

- Có nội dung cho 43/48 mã dự kiến. Mã 27, 40, 41, 43, 44 chưa có nội dung: để trạng thái chưa kích hoạt, không tự tạo nhãn và không tính là nhập thiếu.
- Mã 26, 42 thuộc lực lượng bán chuyên trách; không thêm số liệu lực lượng chuyên trách do PX03 quản lý.
- Không tự cộng chỉ tiêu quân số hoặc hiện trạng qua các kỳ.
- Không tự cộng số người của hai hành vi tại mã 25; người nhập phải cung cấp tổng không trùng. Mã 37, 38 tách tập thể và cá nhân, không cộng hai đơn vị tính.
- Biểu có phần nhận xét, hoạt động nổi bật, khó khăn/kiến nghị; quý có yêu cầu tiến độ, 6 tháng và năm có đối chiếu và đánh giá.

## 2. Giao diện cho đơn vị

Sau đăng nhập, hiển thị kỳ đang mở, khoảng số liệu, hạn nộp có hiệu lực, tình trạng đã gửi và nút tiếp tục bản nháp. Ưu tiên sử dụng được trên điện thoại và bàn phím máy tính.

Chia biểu theo 6 nhóm nghiệp vụ của tài liệu: (1) chỉ đạo, quán triệt; (2) tập huấn, hội thi, hội thao, câu lạc bộ; (3) trách nhiệm lãnh đạo; (4) kiểm tra và xử lý vi phạm; (5) lực lượng bán chuyên trách; (6) tuyên truyền, sáng kiến, biểu dương. Chỉ hiển thị nhóm áp dụng cho kỳ đang nhập.

Mỗi nhóm có tên dễ hiểu, tiến độ số ô đã hoàn thành, hướng dẫn ngắn và nhãn đơn vị tính ngay cạnh ô. Có nút mở nhóm tiếp theo, danh sách lỗi dẫn đến đúng ô, Enter/Tab chuyển ô; trên điện thoại dùng bàn phím số. Trước khi gửi hiển thị bản rà soát toàn bộ báo cáo.

Quy ước nhập:

- Ô trống là chưa có dữ liệu, khác với số 0.
- Cho phép đánh dấu cả nhóm “Không phát sinh” để điền 0 các chỉ tiêu phát sinh phù hợp. Không dùng nút này cho chỉ tiêu hiện trạng/quân số.
- “Không áp dụng” là trạng thái riêng, chỉ xuất hiện tại chỉ tiêu được cấu hình cho phép và có lý do nếu cần.
- Biểu tháng có hai mục xác nhận riêng: nhóm 2 có phát sinh hay không; mã 42 có thay đổi hay không. Khi có thì mở các ô tương ứng; không coi “không thay đổi” là quân số bằng 0.
- Nhận xét chia thành hoạt động nổi bật, khó khăn/kiến nghị, tiến độ nếu kỳ yêu cầu; giữ đúng ý nghĩa tài liệu nguồn.
- Mỗi lần gửi đều bắt buộc tên và số điện thoại người nhập. Cho chọn người đã lưu trong phạm vi đơn vị nhưng phải xác nhận lại; lưu bản chụp tên và số điện thoại vào từng lần gửi.
- Khi kỳ còn cho sửa, sửa từ bản đã gửi, bấm gửi cập nhật để tạo phiên bản mới; chỉ một phiên bản hiện hành được đưa vào tổng hợp.

## 3. Nhập offline và số request

Luồng chính: đăng nhập online → tải toàn bộ dữ liệu cần cho kỳ một lần → nhập và lưu IndexedDB → bấm gửi khi có mạng → máy chủ xác thực, kiểm tra và lưu một lần → trả mã biên nhận, phiên bản và thời gian nhận.

- Lưu nháp cục bộ sau khoảng 0,5–1 giây ngừng gõ; không phát sinh request từ việc nhập, chuyển nhóm hay tính tổng.
- Service worker lưu bộ khung ứng dụng và tài nguyên công khai để mở lại sau lần tải thành công. Dữ liệu riêng của đơn vị được quản lý riêng trong IndexedDB, không đưa vào cache công khai/CDN.
- Bản nháp gắn với tài khoản, đơn vị, kỳ và phiên bản biểu. Đổi tài khoản không được mở nhầm nháp. Đăng xuất có lựa chọn xóa dữ liệu thiết bị; không lưu mật khẩu/token trong bản nháp.
- Hiển thị rõ “Đã lưu trên thiết bị” và “Máy chủ đã nhận”. Chỉ trạng thái thứ hai có giá trị nộp báo cáo.
- Offline không thể đăng nhập mới, kiểm tra hạn mới hoặc hoàn tất gửi. Khi mạng trở lại, người dùng bấm gửi; nếu phiên hết hạn thì đăng nhập lại rồi tiếp tục nháp.
- Giữ nháp khi lỗi mạng, hết hạn, lỗi kiểm tra hay xung đột. Cho tải bản nháp ra JSON và nhập lại để phòng đổi thiết bị hoặc trình duyệt xóa dữ liệu.
- Mỗi lần gửi có idempotency key bền vững; gửi lại cùng nội dung do mất phản hồi trả cùng biên nhận, không tạo báo cáo trùng. Nội dung đã sửa phải có key mới.
- Gửi kèm phiên bản hiện hành. Nếu hai người/tab cùng sửa, máy chủ từ chối ghi đè âm thầm và trả xung đột để đối chiếu.
- Nếu biểu hoặc hạn thay đổi trong lúc offline, máy chủ kiểm tra cấu hình mới trước khi nhận, trả giải thích rõ và giữ bản nháp cũ để chuyển đổi.

Mục tiêu luồng thông thường: 1 request đăng nhập, 1 request khởi tạo kỳ, 1 request gửi; không tính tài nguyên tĩnh, request của Turnstile, đổi mật khẩu lần đầu, tải file và các lần thử lại. Không đánh đồng một HTTP request với một operation của database.

Nếu muốn admin nhìn thấy tình trạng nhập thiếu trên máy chủ, thêm nút “Gửi tạm” do người dùng chủ động bấm. Gửi tạm không được tính là nộp đủ. Admin không thể biết người dùng đang gõ hoặc nháp chưa đồng bộ trên thiết bị.

## 4. Kỳ báo cáo và hạn nộp

Tách khoảng số liệu khỏi thời gian mở cổng nhập. Một kỳ có loại kỳ, ngày bắt đầu/kết thúc số liệu, thời điểm mở, hạn đúng giờ, thời điểm khóa cuối cùng, phiên bản biểu và danh sách đơn vị phải nộp. Hiển thị theo Asia/Ho_Chi_Minh, lưu thời điểm bằng UTC.

Mặc định triển khai tuần, tháng, quý; thiết kế sẵn loại 6 tháng và năm theo tài liệu. Mỗi loại có quy tắc lịch riêng. Chỉ kỳ tuần mặc định lặp hàng tuần; không mặc định ép báo cáo tháng/quý nộp lại mỗi tuần.

Admin có thể đặt lịch mẫu, tạo trước nhiều kỳ, chỉnh toàn kỳ hoặc ghi đè hạn cho từng đơn vị/nhóm đơn vị. Mọi thay đổi phải lưu người thực hiện, lý do, giá trị cũ/mới, thời gian. Đơn vị hiển thị đúng hạn có hiệu lực của mình.

Ba mốc xử lý: trước mở cổng chỉ xem/soạn nháp theo quyền; sau hạn đúng giờ nhưng trước khóa vẫn nhận và gắn nộp muộn; sau khóa chỉ nhận khi được mở lại/gia hạn. Máy chủ dùng thời gian tiếp nhận, không dùng đồng hồ người nhập; soạn offline trước hạn nhưng gửi sau hạn vẫn là gửi muộn.

Tách các chiều trạng thái:

- Tiến độ: chưa nhận dữ liệu / đã gửi tạm, thiếu / đã nộp đủ.
- Thời hạn: còn hạn / quá hạn chưa đủ / đã đủ đúng hạn / đã đủ muộn.
- Cổng nhập: chưa mở / đang mở / đã khóa.

Lưu thời điểm gửi đầu tiên, đủ lần đầu và cập nhật cuối; nộp tạm trước hạn rồi đủ sau hạn vẫn là đủ muộn. Đơn vị đã nộp đủ đúng hạn rồi sửa muộn cần hiển thị riêng thời điểm sửa, không xóa lịch sử đúng hạn. Biên nhận lưu hạn áp dụng lúc nhận; khi admin đổi hạn, dashboard tính đánh giá theo hạn hiện hành nhưng giữ lịch sử đánh giá cũ để đối chiếu.

Tính trạng thái theo timestamp khi truy vấn; không cần cron chạy từng phút để chuyển trạng thái. Lưu danh sách đơn vị phải nộp theo kỳ để đơn vị mới/ngừng hoạt động không làm đổi số liệu tiến độ kỳ cũ.

## 5. Quản trị đơn vị và tài khoản

Nhập Excel theo mẫu: mã đơn vị, tên đơn vị, tên đăng nhập tùy chọn, loại/nhóm đơn vị, mã đơn vị cấp trên, trạng thái. Có bước xem trước, chuẩn hóa, báo lỗi theo dòng và xác nhận thêm mới/cập nhật trước khi ghi. Dùng mã đơn vị ổn định để khớp, không dựa vào tên có thể đổi.

Tự sinh tên đăng nhập từ tên đơn vị không dấu, ví dụ “Công an phường An Bình” → `ca_phuong_an_binh`; nếu trùng thêm mã đơn vị. Cho chỉnh thủ công trước khi tạo. Tên đơn vị hiển thị vẫn giữ nguyên tiếng Việt.

Tạo từng tài khoản hoặc theo lô. Mỗi tài khoản có mật khẩu khởi tạo ngẫu nhiên riêng, buộc đổi lần đầu; không lấy tên đơn vị làm mật khẩu chung. Chỉ lưu hash mật khẩu. Danh sách cấp phát được xuất một lần tại lúc tạo, không lưu mật khẩu rõ để tra cứu lại; quên thì admin đặt lại. Khóa tài khoản, đặt lại mật khẩu và đổi mật khẩu cần thu hồi phiên phù hợp.

Import phân tích và xem trước tại trình duyệt, chỉ gửi hàng đã hợp lệ. Ghi theo lô nhỏ có transaction và mã lô; báo kết quả từng lô để thử lại an toàn. Chặn tệp quá lớn, sai định dạng, trùng mã hoặc liên kết cấp trên không hợp lệ. Không tự đặt lại mật khẩu của tài khoản cũ trong thao tác cập nhật đơn vị.

Dashboard có bộ lọc kỳ, nhóm, cấp trên, trạng thái; đếm trên danh sách được giao báo cáo. Mỗi đơn vị có số ô đã nhận, ô thiếu, hạn riêng, lần đủ đầu tiên, lần sửa cuối và thông tin người gửi. Không tự động polling liên tục; có nút làm mới, hoặc làm mới khoảng 60–120 giây khi admin đang xem nếu bật tùy chọn. Mọi màn hình có nhãn thời điểm dữ liệu.

Nhắc nhở giai đoạn đầu bằng danh sách đơn vị cần nhắc, xem trước nội dung và sao chép/xuất danh sách. Gửi email/SMS/Zalo tự động là hạng mục riêng, cần kênh nhận và dịch vụ tương ứng; chưa giả định miễn phí hoặc tự gửi tin.

## 6. Tổng hợp và xuất báo cáo

Mỗi chỉ tiêu có mã kỹ thuật, mã gốc, nhóm, nhãn, đơn vị tính, loại giá trị, kỳ áp dụng, điều kiện bắt buộc và quy tắc tổng hợp. Danh mục có phiên bản để đổi biểu không làm biến nghĩa dữ liệu cũ.

Phân biệt hai hướng tổng hợp: giữa các đơn vị cùng kỳ và qua thời gian của cùng đơn vị. Chỉ tiêu phát sinh chỉ cộng qua các khoảng không chồng lấn khi định nghĩa tương thích. Chỉ tiêu hiện trạng lấy số tại mốc phù hợp; chỉ tiêu số người duy nhất không suy ra bằng cộng các kỳ nếu không có dữ liệu tránh trùng. Tỷ lệ tính lại từ tử/mẫu, không cộng hoặc trung bình tỷ lệ tùy tiện.

Quý/6 tháng/năm có thể gợi ý từ dữ liệu kỳ nhỏ hơn, nhưng chỉ các chỉ tiêu đủ điều kiện. Hiển thị nguồn, kỳ còn thiếu và yêu cầu đơn vị xác nhận. Không cộng đồng thời tuần và tháng của cùng khoảng. Không tự bù số ngày tuần giao tháng khi chỉ có tổng tuần. Không cộng số của đơn vị cấp trên với cấp dưới nếu báo cáo cấp trên đã bao gồm cấp dưới; cần cấu hình phạm vi tổng hợp.

Kiểm tra số nguyên không âm và giới hạn hợp lý trên cả client/server. Các quan hệ như mã 06 ≤ 05, mã 04 ≤ 03 có thể áp dụng khi thống nhất cùng phạm vi. Với 09–15, chỉ áp dụng tổng loại bằng số tham gia nếu quy định mỗi người được phân loại một lần và đã đủ kết quả. Kiến nghị giải quyết có thể gồm tồn kỳ trước, nên không tự buộc mã 22 ≤ 21. Phân biệt lỗi chặn gửi với cảnh báo cần xác nhận.

Xuất Excel trước: tổng hợp theo mã, chi tiết theo đơn vị, tiến độ/thiếu/muộn và nhận xét. Xuất Word theo biểu gốc sau khi thống nhất bố cục đầu ra. Mỗi bản xuất ghi bộ lọc, thời điểm chốt, phiên bản biểu và phạm vi đơn vị; ô thiếu để trống và có đánh dấu, không âm thầm chuyển thành 0. Mặc định tổng hợp bản nộp đủ hiện hành; nếu bao gồm bản tạm phải lựa chọn rõ và ghi chú.

Tệp nhỏ có thể tạo ở trình duyệt từ dữ liệu được cấp quyền; truy vấn chốt dữ liệu nhất quán trước khi xuất. Không mặc định lưu tất cả file Excel/Word đã xuất lên object storage. Bản xuất không thay thế bản sao lưu database.

## 7. Kiến trúc đề xuất

- Next.js và TypeScript trên Vercel; giao diện React, biểu mẫu và kiểm tra dữ liệu dùng schema dùng chung với server.
- Prisma ORM cùng Prisma Postgres; chọn vùng database và backend gần nhau theo vùng có sẵn. Dùng kết nối pooled phù hợp serverless, giới hạn pool mỗi instance để tránh nhân số kết nối theo số instance.
- IndexedDB cho nháp; service worker cho bộ khung offline. Không cache công khai dữ liệu báo cáo hoặc thông tin liên hệ.
- Cloudflare Turnstile tại đăng nhập; xác minh server trước khi kiểm tra mật khẩu.
- Không cần Redis, realtime hoặc object storage trong bản đầu. Cấu hình biểu phiên bản hóa có thể phát hành kèm ứng dụng và lưu bản chụp để đối chiếu.

Mô hình dữ liệu chính:

| Thành phần | Nội dung |
| --- | --- |
| Unit | Đơn vị, mã ổn định, nhóm, cấp trên, trạng thái |
| User / Session | Tài khoản, hash, vai trò, bắt buộc đổi mật khẩu, phiên và thu hồi |
| ReporterContact | Tên và số điện thoại gợi ý trong phạm vi đơn vị |
| FormVersion | Bản chụp danh mục chỉ tiêu và các quy tắc |
| ReportingPeriod | Loại kỳ, khoảng số liệu, mốc mở/hạn/khóa |
| PeriodAssignment | Đơn vị được giao, hạn riêng, trạng thái miễn nộp nếu có |
| Report | Một bản hiện hành cho đơn vị/kỳ, dữ liệu JSONB, phiên bản, mức hoàn thành và các thời điểm |
| ReportRevision | Lịch sử các lần gửi; người nhập, điện thoại, dữ liệu, biên nhận và hạn lúc nhận |
| AuditLog / ImportBatch | Thay đổi quản trị và theo dõi nhập hàng loạt |

Đề xuất lưu một bộ giá trị có schema rõ trong JSONB cho mỗi báo cáo, thay vì gọi ghi riêng cho từng ô. Giữ cột riêng và index cho unit, period, status, timestamps để dashboard không phải đọc mọi JSON. Khi tổng hợp dùng truy vấn SQL theo danh mục khóa đã cho phép; không để người dùng đưa biểu thức SQL tùy ý.

Unique constraint trên đơn vị/kỳ; unique idempotency key theo phạm vi tài khoản/đơn vị; cập nhật có điều kiện theo version. Ghi Report, Revision và metadata liên quan trong transaction ngắn, kiểm tra trạng thái kỳ/hạn nhất quán với thao tác gửi. Dữ liệu liên hệ và JSON đầu vào có giới hạn độ dài/kích thước.

## 8. Đăng nhập và bảo vệ hệ thống

Turnstile miễn phí có thể dùng độc lập với Cloudflare DNS. Phải gọi Siteverify ở server, kiểm tra hostname/action phù hợp; token có hạn 5 phút và chỉ dùng một lần. Turnstile giảm bot đăng nhập, không bảo đảm loại bỏ mọi DDoS.

Dùng bảo vệ DDoS sẵn có của Vercel, giới hạn tốc độ tại lớp firewall theo tính năng gói hiện có và giới hạn ứng dụng dùng trạng thái chia sẻ. Không dùng biến RAM làm giới hạn duy nhất vì nhiều instance không đồng bộ. Nếu bản đầu dùng Postgres cho bộ đếm đăng nhập thất bại, chỉ xử lý sau Turnstile, truy vấn gọn, hết hạn và dọn theo lô; không ghi log vô hạn mỗi request bị chặn.

Giới hạn kết hợp IP và tài khoản; ngưỡng IP phải tính trường hợp nhiều đơn vị dùng chung NAT. Trì hoãn/khóa tạm khi sai nhiều, thông báo lỗi đăng nhập chung. Giới hạn payload, lượt gửi và xuất file; từ chối request không hợp lệ trước truy vấn nặng.

Cookie phiên HttpOnly, Secure, SameSite; kiểm tra Origin/CSRF với thao tác ghi; hash mật khẩu theo thư viện chuẩn. Server kiểm tra quyền admin hoặc phạm vi đơn vị ở mọi API, không tin unitId từ trình duyệt. Hạn chế log thông tin cá nhân, không ghi mật khẩu hoặc toàn bộ nội dung báo cáo vào log hạ tầng.

## 9. Ngân sách miễn phí và tải đồng thời

Tại thời điểm kiểm tra 28/10/2026, trang pricing trực tiếp của Prisma công bố Free 200.000 operations/tháng, 2 GB, connection pool giới hạn 10; kết quả tìm kiếm còn có bản cũ ghi 500 MB/100.000 operations. Vì vậy lập ngân sách thận trọng dưới 100.000 operations và 500 MB cho giai đoạn đầu, xác nhận quyền lợi thực tế trong console trước triển khai. Trang pricing không liệt kê backup tự động cho Free; cần phương án sao lưu riêng có quyền truy cập và kiểm tra phục hồi.

Vercel Hobby có giới hạn tài nguyên, có thể ngừng phục vụ khi hết quota và dành cho sử dụng cá nhân phi thương mại. Ứng dụng báo cáo của tổ chức cần kiểm tra tính phù hợp điều khoản, không mặc định được dùng Hobby chỉ vì không thu phí người dùng.

Ví dụ dự trù, không phải benchmark: 500 đơn vị × 6 lượt báo cáo/tháng × 3 request ứng dụng/lượt ≈ 9.000 request; nếu trung bình 10–20 DB operations/lượt ≈ 30.000–60.000 operations. Cần cộng admin, đăng nhập lại, sửa báo cáo, import, nhật ký, rate limit và export. Request Turnstile/tài nguyên tĩnh tính riêng. Đo thực tế và cảnh báo ở các mốc 60%, 80%, 90% quota.

500 người đang nhập offline hầu như không tạo tải server. 500 lượt đăng nhập hoặc gửi đúng một thời điểm là bài toán khác, nhất là pool nhỏ và CPU hash mật khẩu. Giữ transaction ngắn, tránh truy vấn từng ô, không dựng báo cáo tổng hợp ngay trong lần gửi, dashboard phân trang/tổng hợp theo kỳ; không cập nhật chung một dòng bộ đếm toàn hệ thống cho mỗi lượt gửi. Khi tắc tạm thời trả mã thử lại, client backoff có jitter và giữ nguyên idempotency key.

Kiểm thử trước vận hành bằng dữ liệu giả, tăng dần 100/300/500 người dùng; kiểm tra cả đăng nhập hợp lệ, đăng nhập sai, gửi phân bố theo thời gian và 300–500 lần gửi dồn; đồng thời admin xem và xuất báo cáo. Đo p95/p99, lỗi, pool wait, timeout, operations, CPU và tính toàn vẹn. Ngưỡng ban đầu đề xuất p95 gửi ≤ 3 giây ở tải mục tiêu, không mất/trùng/ghi đè dữ liệu; tải dồn phải có retry kiểm soát và hoàn thành sau đó. Đây là tiêu chí cần đạt, chưa phải kết quả đã đạt.

Không cam kết “hàng trăm người đồng thời không có vấn đề” khi chưa đo. Nếu không đạt phải tối ưu hoặc nâng tầng hạn chế thực tế; quota theo tháng và khả năng xử lý tải dồn phải được đánh giá riêng.

## 10. Thứ tự thực hiện

1. Chuẩn hóa danh mục 47 ô và quy tắc từng loại kỳ; làm mẫu Excel đơn vị, thống nhất phạm vi cấp trên/cấp dưới và phép tổng hợp.
2. Dựng database, đăng nhập Turnstile, đổi/đặt lại mật khẩu, phân quyền và import đơn vị có xem trước.
3. Làm quản lý kỳ, hạn riêng, biểu tuần/tháng/quý, nháp offline, thông tin người nhập, biên nhận và lịch sử sửa.
4. Làm dashboard, danh sách cần nhắc, export Excel; bổ sung Word, 6 tháng/năm theo nhu cầu.
5. Kiểm thử nghiệp vụ, offline, xung đột, gửi trùng, mốc hạn và phân quyền; kiểm thử tải, quota, sao lưu/phục hồi; triển khai Vercel và chạy thử với một nhóm đơn vị trước khi mở rộng.

Các giả định cần chốt trước code nghiệp vụ: lịch và khoảng số liệu chính xác từng kỳ; đơn vị nào là nguồn tổng hợp cuối cùng; có cho gửi tạm/đủ rồi sửa không; ý nghĩa các chỉ tiêu quân số và tính duy nhất qua kỳ; năm/6 tháng triển khai ngay hay sau. Chưa có nội dung 5 mã thiếu thì giữ vô hiệu, vẫn triển khai được danh mục hiện có.

## 11. Nguồn kỹ thuật đã kiểm tra

- Prisma pricing: https://www.prisma.io/pricing
- Prisma Postgres FAQ về hành vi hết quota: https://www.prisma.io/docs/postgres/faq
- Vercel Hobby: https://vercel.com/docs/plans/hobby
- Vercel fair use: https://vercel.com/docs/limits/fair-use-guidelines
- Vercel DDoS: https://vercel.com/docs/vercel-firewall/ddos-mitigation
- Turnstile Free: https://developers.cloudflare.com/turnstile/plans/
- Turnstile server validation: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
