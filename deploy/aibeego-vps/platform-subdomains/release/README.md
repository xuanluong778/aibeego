# Release packaging 16/11/2026

Web được build standalone bằng Next.js 15.5.21, một worker, heap 1536 MB, distDir `.next-platform-release`; image dùng Node 22.22.3 bookworm-slim để khớp thư viện glibc của máy build. API dùng runtime snapshot đã backup và chỉ chép 6 module Landing Page thay đổi, không thay các module khác. So sánh AST xác nhận method mới `publicationOptions`, `subdomainAvailability`, các method đổi `overview`, `get`, `publish`, `getPublicBySlug`.

Dockerfile ở đây dùng context đã chuẩn bị, không phải root repo: API context gồm `dist/landing-pages`; Web context gồm `standalone`, `static`, `public`. Không đưa env, token, DB dump hay private key vào context. Khi chạy QA bằng image snapshot, đặt label `com.docker.compose.project` sang project QA riêng vì image snapshot có thể thừa hưởng labels từ Compose production.

Image đang chạy: `marketingaz-api:platform-public-links-20261116`, `marketingaz-web:platform-public-links-20261116`. Bản sửa liên kết danh sách giữ `publicPath`, bổ sung `publicUrl` và ưu tiên subdomain đã chọn ở menu Xem trang công khai. API kế thừa `platform-subdomains-20261116` và thay duy nhất service Landing Page; Web full build lại. Xem `docs/reports/PLATFORM_SUBDOMAIN_PUBLIC_LINK_FIX_20261116.md`.

Compose production `/opt/marketingaz/docker-compose.vps.yml` đã cập nhật image, source checkout và entrypoint Web; API bật feature flag. Bản trước giữ ở tag `platform-subdomains-20261116`, runtime trước lần deploy ban đầu giữ ở `platform-before-20261116` để rollback, không prune các tag này khi chưa duyệt.
