# Sửa lỗi không lưu nháp / không xuất bản subdomain — 16/11/2026

## Nguyên nhân đã xác minh

Thông báo Builder “Chưa lưu xong bản nháp” xuất hiện trước bước tạo binding. Access log Nginx host có nhiều POST autosave trả 500; các request này không tới application proxy/API nên log API không ghi nhận. Error log host ghi rõ `open() /var/cache/nginx/client_temp/... failed (13: Permission denied)`.

Host Nginx cấu hình `user www-data` (UID 33), nhưng `/var/cache/nginx/client_temp` thuộc `nginx:root` (UID 996), mode 0700. Bản nháp vượt buffer trong RAM phải ghi tạm ra đĩa nên thất bại. Các request nhỏ như kiểm tra tên khả dụng vẫn 200, khiến tên có thể kiểm tra được nhưng không xuất bản được.

## Sửa trực tiếp

Đổi owner của **duy nhất thư mục** `/var/cache/nginx/client_temp` thành `www-data:root`, giữ mode 0700. Không chown đệ quy, không mở quyền cho mọi user. Kiểm tra ghi tệp tạm dưới user worker đạt. Đây là thay đổi filesystem tồn tại qua restart; Nginx vẫn sử dụng user được cấu hình sẵn. Không sửa Nginx/FastPanel config, DNS, SSL, ứng dụng hoặc dữ liệu trang khách hàng; không restart/reload dịch vụ hay container.

## Kiểm thử

- Request POST không xác thực với body 32 KB hiện đi qua Nginx tới API và nhận 401 như dự kiến, thay vì lỗi quyền 500. Kiểm thử không ghi dữ liệu khách hàng.
- Chromium tải chính Web production, dùng organization/user/page tạm riêng và bản sao **publishedSpec công khai** của mẫu trang người dùng đang gặp lỗi. Toàn bộ dữ liệu kiểm thử tách khỏi trang gốc.
- Builder → chọn subdomain → xác nhận: autosave body **19.542 byte trả 201**, publish trả **201**, binding đúng URL, HTTPS **200**, chứng chỉ `*.aibeego.com`, không lỗi runtime JavaScript.
- Fixture org/user/page/binding và cache auth đã được dọn. Không gắn tự động một trong các tên `azbao`, `azbaobao`, `baobao` đang được người dùng thử; tên được kích hoạt khi người dùng xác nhận xuất bản thành công trong tab của họ.
- Site chính, `test.aibeego.com`, `vibecode.aibeego.com`: HTTPS 200, TLS verify=0.
- Snapshot trước/sau: 72 file Nginx, master PID và toàn bộ 32 container giữ nguyên.

Script kiểm thử tái sử dụng: `scripts/qa-landing-platform-save-publish-production.cjs`, yêu cầu bật `LANDING_PUBLISH_PRODUCTION_QA=1` và thư mục output riêng. Có thể truyền `LANDING_PUBLISH_QA_SOURCE_PAGE_ID` để dùng bản đã xuất bản, không đọc bản nháp nguồn. Mặc định dùng mẫu hệ thống.

Backup owner/mode trước sửa, snapshot cấu hình và kết quả kiểm thử lưu trong thư mục private `data/backups/nginx-draft-save-*`; đường dẫn thao tác tại `/tmp/aibeego-nginx-draft-save-backup`. Probe 32 KB và autosave thực tế 19 KB xác nhận lỗi quyền đã hết.

Người dùng giữ nguyên tab Builder và bấm Xuất bản lại để gửi bản nháp đang sửa; không cần refresh hoặc deploy Web mới.
