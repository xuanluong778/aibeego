# Tạo nội dung từ URL — 14/11/2026

Đã cập nhật API/web Docker local tại http://localhost:8080. Chưa triển khai production.

## Sửa lỗi nút tạo đề xuất sau khi nhập URL

Đã tái hiện hai nguyên nhân: input `type=url` chặn submit bằng HTML validation khi thiếu `https://`; với URL hợp lệ nhưng chưa đọc nguồn, guard chỉ đặt lỗi ở đầu panel ngoài vùng đang nhìn. Cả hai trường hợp không gửi yêu cầu tạo đề xuất, khiến nút trông như không phản hồi.

Đã dùng validation có thông báo trong ứng dụng thay cho popup HTML chặn submit, tự bổ sung `https://`, và cho nút **Tạo đề xuất trên mẫu** đọc URL trước khi tạo nếu chưa có nguồn. Thông tin người dùng đã nhập được giữ; nguồn chỉ điền vào ô trống. Lỗi hiện cạnh nút và được cuộn/focus vào vùng nhìn thấy. Receipt hết hạn được bỏ để lần thử lại đọc nguồn mới. Có trạng thái đọc/tạo và chặn thao tác khi đang xử lý.

Kiểm tra browser `scripts/qa-landing-page-template-url-submit.cjs`: 8 trường hợp đạt (chỉ URL không có scheme; giữ ô nhập tay; URL sai; trang chặn rồi thử lại; validation nhập thủ công; nguồn hết hạn; API AI lỗi rồi thử lại; đọc URL không có scheme bằng nút riêng). Không autosave/publish trong các ca này, draft giữ nguyên. TypeScript dialog và production build web đạt; đã cập nhật container web local.

## Cách sử dụng

Chọn mẫu và mở Builder → **Tạo nội dung cho mẫu bằng AI** → **Tạo nội dung từ URL** → nhập URL và chọn **Đọc và phân tích URL**. Kiểm tra nội dung nguồn đã lọc, bổ sung dữ kiện thiếu, nhập ảnh nguồn vào thư viện nếu cần rồi chọn ảnh trong thư viện. Tạo đề xuất, duyệt/chỉnh từng vị trí và xác nhận áp dụng. Autosave lưu bản nháp; không tự xuất bản.

URL gốc, URL sau chuyển hướng và thời điểm đọc được lưu trong `spec.meta.contentSource` khi áp dụng thành công. Sau tải lại, dialog hiển thị URL đã lưu để đối chiếu và đọc lại. Đọc URL, tạo đề xuất và xem trước không ghi lên trang.

## Thay đổi

- Tái sử dụng crawler SSRF, `LandingPageAiService`/`OpenAiService`, bộ thu thập slot và patch theo allowlist, renderer, media upload/list, xác nhận ghi đè, history và autosave hiện có.
- Bộ trích xuất HTML không thực thi mã: ưu tiên `main`/`article`, lấy tiêu đề/metadata/nội dung/ảnh; lọc script, style, menu, quảng cáo, sidebar, footer, vùng ẩn. Giới hạn văn bản gửi AI 32.000 ký tự, tối đa 20 ảnh nguồn. Ảnh ngoài chưa nhập không được tự tải trong giao diện.
- Chỉ chuyển giá/ưu đãi/đối tượng từ dòng có nhãn rõ ràng và không mơ hồ. Không lấy phí giao hàng hoặc nhiều mức giá làm một giá sản phẩm. Giá nhiều gói, đánh giá, chính sách, giáo trình, lịch và cam kết thiếu căn cứ tiếp tục cần người dùng bổ sung/xác nhận. Vị trí thiếu dữ kiện có ô đề xuất trống và nhãn **Cần bổ sung**; nội dung demo chỉ bị thay/ẩn khi được duyệt.
- AI nhận nội dung nguồn dưới dạng dữ liệu không đáng tin, không có công cụ thực thi. Kết quả chỉ được ghi qua slot ID có sẵn; kiểm tra schema, dữ kiện, giá trị số và trích dẫn. Kết quả sai hoặc thiếu căn cứ dùng fallback có nhãn và cảnh báo. Giữ bố cục, cấu hình form và đích CTA.
- Hai endpoint mới, đều có JWT/Tenant/`lead.write` và kiểm tra quyền trên trang trước khi truy cập mạng:
  - `POST /api/v1/landing-pages/:id/ai-template-content/read-url` — `{url}`.
  - `POST /api/v1/landing-pages/:id/ai-template-content/import-url-image` — `{sourceId,imageUrl}`; chỉ nhận ảnh có trong nguồn đã đọc của đúng user/org/page.
- Endpoint tạo đề xuất cũ nhận thêm `sourceId` tùy chọn. Văn bản nguồn được lấy lại từ receipt phía server; không tin `sourceText` do client tự gửi. Không có `sourceId` vẫn chạy luồng nhập thủ công như trước.

## Cấu hình và giới hạn

Không thêm dependency, biến môi trường, khóa AI hoặc migration. Tái sử dụng `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_BASE_URL` phía backend.

| Hạng mục | Giới hạn |
| --- | --- |
| HTML | 1.000.000 byte; 12 giây tổng gồm DNS/chuyển hướng; tối đa 3 chuyển hướng |
| Ảnh nhập | 5.000.000 byte; 12 giây; 3 chuyển hướng; chữ ký JPG/PNG/GIF/WebP, không nhận SVG/HTML |
| Đọc URL | 10 lần/user/phút, 40 lần/org/phút |
| Tạo đề xuất | 8 lần/user/phút, 24 lần/org/phút; AI timeout 35 giây/lô |
| Nhập ảnh | 10 lần/user/phút |
| Bộ nhớ đệm | Nội dung crawl 10 phút, tối đa 200 mục; receipt 15 phút, tối đa 100 mục |

SSRF kiểm tra HTTP(S), credentials, hostname, toàn bộ IP DNS và từng redirect; phân giải lại rồi ghim socket vào IP công khai. Chặn loopback/private/link-local/metadata, IPv4-mapped và các vùng IPv6 chuyển tiếp. Giới hạn dung lượng áp dụng trong lúc đọc stream; DNS có deadline. Tải nội dung dạng nén không tuân thủ `Accept-Encoding: identity` bị từ chối.

Cache, receipt và rate limit theo kiến trúc hiện tại nằm trong bộ nhớ một API instance. Restart API yêu cầu đọc lại URL; chạy nhiều replica cần sticky routing hoặc chuyển các cấu trúc này sang shared store. Trang đăng nhập, CAPTCHA, trang chỉ dựng bằng JavaScript, file PDF và ảnh nền CSS có thể cần nhập thủ công. Trích xuất và kiểm chứng mang tính quy tắc; người dùng vẫn cần duyệt tính đúng đắn và quyền sử dụng ảnh.

## Kiểm chứng

- 11 kiểm tra URL/shared: lọc nội dung, metadata/ảnh, giá rõ ràng và giá mơ hồ, dữ liệu thiếu, schema/evidence, metadata nguồn, SSRF/redirect/DNS rebinding, timeout DNS/socket, stream quá lớn, ảnh không hợp lệ.
- 38 + 24 kiểm tra hồi quy nội dung mẫu; 25 kiểm tra service đã biên dịch, gồm quyền user/org/page, receipt hết hạn/giả mạo, nguồn do server giữ, nhập media, AI sai schema và luồng tạo trang AI cũ.
- 22 kiểm tra Prisma/service thật, rollback transaction.
- 16 kiểm tra browser: URL nội bộ bị chặn qua HTTP thật; trang bị chặn/thử lại/nhập tay, nhập và chọn ảnh, đề xuất thiếu dữ liệu, preview Desktop/Tablet/Mobile, lưu bản nháp, giữ thiết kế và URL nguồn sau reload, dialog ở 390 px, không gọi publish. Nguồn/provider và nhập ảnh thành công trong browser dùng fixture; autosave/database là thật.
- Hai canary HTTP đọc URL công khai thật và gọi AI hiện có: `https://example.com` trả fallback; `https://aibeego.com` trả mixed. Các lô sai schema/evidence bị thay bằng fallback, bản nháp/`updatedAt` giữ nguyên và không xuất bản.
- Build shared/database/API và production build web đạt. TypeScript riêng shared/crawler/dialog đạt; full web lint/typecheck vẫn bị bỏ qua theo cấu hình build có sẵn.

Script chính: `scripts/test-landing-page-template-url.ts`, `scripts/test-landing-page-template-content-service.cjs`, `scripts/qa-landing-page-template-url.cjs`, `scripts/canary-landing-page-template-url.cjs`. Ảnh và kết quả QA nằm trong `.tmp/lp-url-content/`.

Đã dọn tổ chức QA cùng hai trang và ảnh tạm, xác nhận số tổ chức QA vừa tạo còn lại bằng 0. Không ghi lên trang gốc của người dùng.
