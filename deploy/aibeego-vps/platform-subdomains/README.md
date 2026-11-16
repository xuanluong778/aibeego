# Subdomain AIbeego trong hộp thoại Publish

Trạng thái 16/11/2026: **đã deploy production**, DNS wildcard đã đúng, wildcard SSL đã cấp và API/Web đã cập nhật. Không cần IP public thứ hai. Gia hạn wildcard còn thủ công vì chưa có API/ủy quyền cập nhật DNS tự động; không được coi certbot.timer là bằng chứng wildcard đã tự gia hạn.

## Người dùng

1. Bấm Publish hoặc Xem live trong Builder.
2. Chọn “Subdomain miễn phí”, nhập phần tên, ví dụ `cua-hang` → `https://cua-hang.aibeego.com/`.
3. Hệ thống kiểm tra tên trùng/tên hệ thống. Khi xuất bản, autosave phải hoàn tất rồi backend cùng giao dịch lưu snapshot và claim hostname.
4. Có thể giữ liên kết `/p/<slug>` như trước. Đổi/bỏ subdomain sẽ thông báo địa chỉ cũ ngừng hoạt động. Gỡ xuất bản chặn truy cập ngay nhưng vẫn giữ tên cho chủ trang; publish lại không đổi binding.

Mỗi trang dùng một subdomain miễn phí. Chữ a–z, số và gạch ngang, dài 3–63 ký tự, không có dấu chấm hay gạch ngang đầu/cuối. Tên đã là custom domain được xác minh phải tháo kết nối cũ trước khi chuyển sang subdomain platform. Tên hạ tầng như `www`, `api`, `app`, `admin`, `mail`, `test` được giữ riêng. Khách không phải thêm DNS hay TXT cho các hostname thuộc AIbeego.

## Mã nguồn

- `landing-page-platform-domain.ts`: validation, availability, claim, release, resolve.
- `landing-pages.service.ts`: claim và publish nguyên tử, public URL, scope organization.
- `landing-page-publish-dialog.tsx`: hộp thoại, debounce, chống phản hồi cũ, lỗi race và responsive.
- `landing-page-builder.tsx`: giữ autosave/kiểm tra revision, chọn địa chỉ cho Publish/Xem live, mở đúng public URL.
- `20261116110000_landing_platform_domains`: bảng binding riêng; hostname UNIQUE trong PostgreSQL. Không tự kích hoạt các `subdomain_slug` cũ của draft.
- `landing-page-domain-manager.ts` và public controller: hostname/binding scope đúng tenant, tương thích custom domain cũ; không cho custom-domain claim chiếm namespace platform.

Availability không giữ chỗ. Advisory transaction lock theo hostname, UNIQUE index và transaction publish quyết định bên thắng khi hai khách chọn cùng tên. Bên thua không mất snapshot hay hostname đang hoạt động. Binding ID đổi khi rename để URL/key cũ không trỏ nhầm sang trang khác. Hai tenant trùng slug vẫn có public key và hostname riêng.

## Kích hoạt production một lần — chỉ sau xác nhận

1. Rà soát, build và smoke test API/Web từ commit đã duyệt. Bản này dựa trên baseline source hiện có, không cần bản Caddy edge chưa deploy. Nếu ghép cùng nhánh Caddy về sau, phải giữ các thay đổi platform resolve/namespace guard trong domain manager.
2. Kiểm tra migration history, backup DB và áp dụng migration `20261116110000_landing_platform_domains`. Bảng custom-domain connections đã được dùng bởi ứng dụng hiện tại; nơi chưa có cần áp dụng migration `20261115170000_landing_domain_connections` trước. Không dùng db push/reset trên production.
3. Cấu hình wildcard DNS `*.aibeego.com A 116.118.45.72` sau phê duyệt; chỉ thêm AAAA nếu VPS thật sự phục vụ IPv6. Giữ toàn bộ bản ghi exact đang có. Wildcard không thay thế các record exact.
4. Chuẩn bị wildcard certificate `*.aibeego.com` bằng **DNS-01** với API credential có scope giới hạn, cùng tự động gia hạn. Nơi lưu mẫu là `/etc/letsencrypt/live/aibeego-wildcard/`. Không dùng certificate chỉ chứa `aibeego.com` để phục vụ hostname con, không dùng HTTP-01 để cấp wildcard và không dùng thao tác TXT thủ công cho renewal dài hạn.
5. Đối chiếu IP/upstream/certificate paths trong `nginx.platform-subdomains.conf.template`. Tạo một file conf riêng, validate trước rồi graceful reload. Không sửa các vhost FastPanel hoặc vhost test hiện hữu. Regex chỉ nhận đúng một label; các vhost exact được ưu tiên nên `aibeego.com`, `www`, `test` và các site khác giữ nguyên.
6. Khi DNS + wildcard TLS + route đều sẵn sàng, đặt `LANDING_PAGE_PLATFORM_SUBDOMAINS_ENABLED=true` cho API. Mặc định mẫu là `false` để không cấp URL chưa hoạt động. Thêm các label hạ tầng riêng vào `LANDING_PAGE_PLATFORM_RESERVED_SUBDOMAINS`.
7. Test trên staging/hostname thử: Publish tên mới, HTTP→HTTPS, đúng nội dung/page ID, trùng tên giữa hai tenant, đổi tên, gỡ xuất bản, phục hồi và submit lead đúng trang. Đồng thời kiểm tra site chính/test hiện có.

Nginx dùng một cấu hình chung và một wildcard certificate cho tất cả trang; không thêm config/chứng chỉ theo mỗi lần Publish. Việc cấp subdomain này không phụ thuộc Caddy hoặc IP phụ. [Thứ tự ưu tiên exact/wildcard/regex của Nginx](https://nginx.org/en/docs/http/server_names.html) và [DNS-01 cho wildcard SSL](https://letsencrypt.org/docs/challenge-types/#dns-01-challenge) là cơ sở của phương án.

## Hoàn tác

Đặt feature flag về false và trả API/Web về image cũ nếu cần. Giữ bảng/binding; không xóa dữ liệu. Chỉ tháo file vhost wildcard mới nếu cần, validate trước reload; không sửa chứng chỉ/vhost các website đang hoạt động. Hoàn tác DNS phải được duyệt riêng.

## Kiểm thử

```bash
pnpm install --frozen-lockfile --ignore-scripts
scripts/platform-subdomain-qa/run.sh
```

Runner tạo PostgreSQL riêng trên loopback 15449, Nginx QA riêng ở 19081/19444 cùng certificate tự ký được curl tin cậy rõ ràng, Nest ở 19401, proxy fixture ở 19402 và browser harness ở 19601. Không load `.env`, tài khoản hoặc data production. Test Nginx dùng template thật và controller/service thật; renderer/Next đầy đủ được thay bằng fixture để test routing. UI dùng component/CSS thật.

Full production Next/API build chưa chạy trên VPS gần đầy; cần chạy trong CI/build host đủ tài nguyên trước phát hành. QA không thay thế kiểm chứng DNS công khai và certificate Let's Encrypt thực sau khi wildcard được thiết lập. Các artifact nằm trong `.platform-subdomain-qa/` (ignored), không đưa test private key vào gói source/review.
