# Deploy production — chọn subdomain khi Publish

Ngày 16/11/2026, theo xác nhận deploy của người dùng. DNS `*.aibeego.com` đã trỏ về `116.118.45.72`. Chủ tên miền đã thêm TXT DNS-01 được Let’s Encrypt yêu cầu; chứng chỉ `*.aibeego.com` đã cấp, hạn 14/02/2027. Không sửa các DNS record khác.

## Đã triển khai

- Web production full build thành công, đóng gói standalone và thay container Web. Bổ sung component `template-live-card-preview.tsx` đã có trong source gốc nhưng nằm ngoài snapshot Git, cần cho full build; không sửa chức năng preview của component này.
- API image dựa trên snapshot runtime thực, thay đúng 6 module Landing Page. Các phần khác giữ nguyên. Migration bảng `landing_page_platform_domains` được áp dụng trong transaction, ghi checksum vào history; không chạy các migration cũ ngoài phạm vi.
- Feature flag `LANDING_PAGE_PLATFORM_SUBDOMAINS_ENABLED=true`; hộp thoại Publish cho nhập tên, kiểm tra tên trùng/tên hệ thống, lưu snapshot/binding nguyên tử và mở đúng URL.
- Thêm riêng `/etc/nginx/conf.d/aibeego-platform-subdomains.conf`, dùng wildcard TLS và auth domain resolve trên mọi request. Không sửa các vhost cũ, giữ nguyên exact host `test.aibeego.com`.
- API/Web production dùng image tag `platform-subdomains-20261116`; Compose production cập nhật để duy trì qua restart. Source build context trỏ worktree của nhánh tính năng.

## Xác minh thực tế

1. Staging dùng chính release images, DB/Redis riêng trên Docker network internal. Builder thật tải được, hộp thoại xuất hiện, Publish thực trả URL subdomain và SSR 200, không lỗi JS.
2. Production dùng org/user/subscription/page tạm riêng để test; không sửa khách hàng. Qua Chromium thật: Builder → chọn tên → Publish API → mở hostname HTTPS 200, TLS 1.3 và certificate subject `*.aibeego.com`; page ID khớp tenant. Không lỗi JavaScript.
3. Fixture production và toàn bộ staging đã được dọn, xóa cache JWT của fixture. Không giữ các hostname test tạm như một trang khách hàng thật.
4. Site chính và `test.aibeego.com` trả HTTPS 200, TLS verify=0; Nginx validate đạt. Toàn bộ file cấu hình Nginx đã tồn tại trước deploy có hash giữ nguyên. Chỉ thêm vhost wildcard và graceful reload.

## SSL tự gia hạn — chưa hoàn tất

Chứng chỉ wildcard hiện được cấp qua DNS-01 thủ công. Người dùng xác nhận chưa có API quản lý DNS Vietnix. Vì thế **wildcard chưa được tự động gia hạn**; TXT vừa thêm không tự xử lý các challenge lần gia hạn sau. `certbot.timer` của các chứng chỉ khác vẫn giữ nguyên.

Cần bật API DNS hoặc ủy quyền riêng `_acme-challenge.aibeego.com` sang cơ chế DNS có thể tự cập nhật rồi cấu hình auth hook và test renewal. Không yêu cầu gửi mật khẩu/API key vào chat. Việc Publish subdomain hiện hoạt động và không đòi khách hàng thêm DNS/TXT riêng.

## Hoàn tác

Backup DB/config/inspect và runtime images đã lưu trước deploy. Image trước: `marketingaz-api:platform-before-20261116`, `marketingaz-web:platform-before-20261116`. Trong thư mục backup có `rollback-images.yml`; restore Compose cũ rồi áp overlay rollback, chỉ recreate API/Web và reload Nginx proxy. Giữ bảng/binding bổ sung, không restore toàn DB hoặc xóa dữ liệu người dùng để rollback code. Nếu cần tháo vhost wildcard, chỉ xóa file mới sau validate; không sửa các vhost khác.

Ảnh giao diện thực: `downloads/AIbeego_Publish_Subdomain_Production_20261116.png`. Người dùng có thể cần Ctrl+F5 để thay bundle cũ đang giữ trong tab.
