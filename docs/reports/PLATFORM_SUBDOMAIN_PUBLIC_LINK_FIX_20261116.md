# Sửa liên kết Xem trang công khai — production 16/11/2026

## Lỗi và thay đổi

`vibecode.aibeego.com` có binding đúng và HTTPS 200 nhưng danh sách Trang của tôi chỉ nhận `publicPath=/p/khoa-hoc-online-early-form`. Menu dùng trực tiếp trường này nên bỏ qua subdomain đã chọn.

API `listPages` bổ sung `publicUrl` và `platformSubdomain` từ bảng binding bằng một truy vấn tham số hóa, giới hạn theo organization và các page ID đã trả về. Khi feature flag tắt hoặc không có binding, `publicUrl=null`. Giữ `publicPath` để tương thích.

Giao diện danh sách ưu tiên `publicUrl` cho nút Xem trang công khai, fallback về `publicPath`. Dòng dưới tên trang hiển thị hostname đã chọn; không đổi slug, nội dung hoặc binding của khách hàng.

## Kiểm thử

- 24 kiểm thử service + PostgreSQL riêng đạt, gồm list với hai tenant trùng slug, binding đúng tenant, fallback, danh sách rỗng và feature flag tắt.
- 9 kiểm thử Nginx/Nest và 12 kiểm thử hộp thoại Publish đạt.
- 3 kiểm thử danh sách bằng Chromium với component thật đạt: hostname, href menu subdomain, path fallback, không lỗi runtime.
- Full Next production build thành công. Build hiện có cấu hình bỏ qua lint/typecheck toàn dự án; strict check helper/dialog đạt. Mở rộng typecheck sang route danh sách gặp lỗi khóa trùng có sẵn trong dictionaries en/vi; không sửa các file ngoài phạm vi này.
- Production trước sửa: kiểm tra read-only binding thật xác nhận `publicUrl` bị thiếu. Sau sửa cùng kiểm tra đạt: `https://vibecode.aibeego.com/`, legacy path `/p/khoa-hoc-online-early-form`.
- Smoke production qua HTTP API thật và Chromium thật dùng organization/user/page/binding tạm riêng: danh sách trả đúng URL, menu mở popup đúng hostname, HTTPS 200 với chứng chỉ `*.aibeego.com`, trang chỉ có path vẫn giữ fallback. Không lỗi JavaScript. Fixture và auth cache đã dọn.
- `aibeego.com`, `vibecode.aibeego.com`, `test.aibeego.com`: HTTPS 200, TLS verify=0. Hash 72 file Nginx và master PID giữ nguyên; 30 container ngoài API/Web giữ nguyên ID và thời điểm khởi động.

## Deploy và hoàn tác

Images mới `marketingaz-api:platform-public-links-20261116`, `marketingaz-web:platform-public-links-20261116`. API kế thừa image production trước và thay duy nhất module `landing-pages.service.js`. Web full build standalone; giữ static assets bản trước trong image mới để giảm lỗi tab đang mở. Compose production lưu các image mới; chỉ recreate API/Web và graceful reload application proxy để cập nhật IP upstream.

Không đổi DNS, chứng chỉ, cấu hình host Nginx/FastPanel, schema/migration hoặc dữ liệu trang khách hàng. Backup Compose, image IDs, kết quả kiểm thử, ảnh browser và snapshot nằm trong thư mục backup riêng `public-links-*`; đường dẫn thao tác lưu tại `/tmp/aibeego-public-links-backup`.

Rollback bằng Compose đã backup về `platform-subdomains-20261116`, recreate riêng API/Web rồi reload application proxy. Không cần rollback database.
