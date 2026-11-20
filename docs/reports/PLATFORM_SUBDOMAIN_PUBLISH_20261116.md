# Chọn subdomain AIbeego khi xuất bản Landing Page

Đã triển khai source trong worktree `/var/www/aibeego_com_usr/platform-subdomain-worktree`, nhánh `codex/platform-subdomains-20261116`. **Chưa deploy production, đổi DNS, cấp wildcard certificate hay chạy migration production.**

## Hành vi đã hoàn thiện

- Bấm Publish/Xem live mở hộp thoại chọn `ten-trang.aibeego.com` hoặc giữ liên kết `/p/<slug>`.
- Gợi ý tên từ trang, kiểm tra tên còn trống sau khi nhập, chặn tên hệ thống/tên trùng và đầu vào không hợp lệ. Chỉ nhập một label ASCII 3–63 ký tự.
- Khi xác nhận: Builder đợi autosave hoàn tất, backend kiểm tra revision rồi lưu snapshot và claim hostname trong cùng transaction. Tranh chấp trả lỗi rõ ràng và giữ bản đã xuất bản trước đó.
- Địa chỉ đã chọn được giữ khi tải lại Builder; nút mở trang/toast/URL công khai dùng subdomain đã xuất bản.
- Đổi tên xoay binding ID, làm hostname/key cũ ngừng hoạt động. Chọn path-only tháo subdomain. Gỡ xuất bản chặn truy cập ngay, vẫn giữ tên để chủ trang xuất bản lại.
- Routing dùng binding riêng và published snapshot, không tìm trang theo slug không có tenant. Hai tổ chức có slug giống nhau vẫn phục vụ đúng trang. Public API bỏ qua organizationId giả và chặn key của hostname khác.
- Namespace hệ thống và các custom-domain legacy đã xác minh được bảo vệ; khóa trang → khóa hostname thống nhất tránh deadlock, không cho một hostname đồng thời được claim bởi cả hai cơ chế.
- Template Nginx dùng một regex vhost và wildcard certificate chung, không thêm cấu hình/chứng chỉ cho mỗi lần Publish. Vhost exact hiện hữu được ưu tiên.

## Kiểm thử đã chạy

| Nhóm | Kết quả |
| --- | --- |
| Publish service và PostgreSQL thật: validation, ownership, revision, rollback, race, rename, unpublish, tương thích cũ | 23/23 |
| Nginx thật + Nest controller/service thật trên loopback: HTTPS wildcard QA, tenant routing, header spoofing, exact-host precedence, private routes, rename/unpublish | 9/9 |
| Chromium với component và CSS thật: debounce, phản hồi chậm, tên trùng/hệ thống, lỗi server, payload, fallback, responsive và runtime | 12/12 |
| **Tổng** | **44/44 đạt** |

Đã chạy lại từ đầu bằng `scripts/platform-subdomain-qa/run.sh`, strict typecheck module platform-domain và Publish dialog, build shared/database, transpile 494 file API, `git diff --check` và kiểm tra cú pháp Bash. Test nội dung không hợp lệ dùng validator hiện có; không thay đổi quy tắc nội dung landing page.

Runner tạo PostgreSQL QA riêng trong tmpfs, Nginx master riêng với PID/cổng loopback riêng và certificate QA tự ký được trust rõ ràng bởi curl. Không dùng credentials/data/API production. Browser dùng HTTP fixtures; public renderer trong Nginx test là fixture, không phải toàn bộ Next production app.

## Không ảnh hưởng hệ thống hiện tại

So sánh trước/sau: **71 file hash cấu hình Nginx, PID master Nginx và 32 container production không thay đổi**. Site chính `aibeego.com` và `test.aibeego.com` vẫn trả HTTPS 200 với TLS verify=0. Các container/listener QA đã được dọn.

Không chạy full API/Next production build trên VPS hiện đang gần đầy; cần CI/build host đủ tài nguyên trước phát hành. Không báo test local là chứng nhận DNS công khai hay Let's Encrypt production.

## Điều kiện bật thật

Hiện wildcard DNS chưa được cấu hình và hệ thống chưa có wildcard certificate cho tính năng này. Mẫu feature flag giữ `false`; khi chưa sẵn sàng, luồng path-only vẫn xuất bản bình thường và không cấp link subdomain chết.

Để kích hoạt cần một lần thiết lập DNS `*.aibeego.com` về VPS và wildcard TLS `*.aibeego.com` có tự động gia hạn bằng DNS-01, áp dụng migration, deploy API/Web đã duyệt và file vhost wildcard riêng, rồi bật `LANDING_PAGE_PLATFORM_SUBDOMAINS_ENABLED=true`. **Không cần IP public phụ cho subdomain do AIbeego sở hữu.** Không sửa vhost/chứng chỉ riêng của `test.aibeego.com` hoặc các website khác.

Chi tiết kích hoạt/hoàn tác: [README](../../deploy/aibeego-vps/platform-subdomains/README.md). Cơ sở cấu hình: [Nginx server-name precedence](https://nginx.org/en/docs/http/server_names.html), [Let's Encrypt DNS-01 và wildcard certificate](https://letsencrypt.org/docs/challenge-types/#dns-01-challenge).

## File chính

- [Publish dialog](../../apps/web/src/components/landing-pages/landing-page-publish-dialog.tsx)
- [Backend platform domain](../../apps/api/src/landing-pages/landing-page-platform-domain.ts)
- [Publish service](../../apps/api/src/landing-pages/landing-pages.service.ts)
- [Migration](../../packages/database/prisma/migrations/20261116110000_landing_platform_domains/migration.sql)
- [Nginx template](../../deploy/aibeego-vps/platform-subdomains/nginx.platform-subdomains.conf.template)
- [Runner QA](../../scripts/platform-subdomain-qa/run.sh)

Screenshots và log nằm trong `.platform-subdomain-qa/` (ignored) và được đưa vào gói review, không kèm test private key hay dữ liệu bí mật.
