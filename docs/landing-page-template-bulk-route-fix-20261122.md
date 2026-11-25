# Sửa upload hàng loạt template trên localhost:8080

Log Nginx ghi nhận POST `/api/v1/landing-pages/templates/packs/bulk` trả 404 lúc 13:51:32 ngày 22/11/2026 (Asia/Saigon). Controller nguồn và controller trong image đang chạy đều thiếu route này, trong khi giao diện và `LandingPageTemplatePackService.importBulk` vẫn tồn tại. Proxy đang tắt request buffering; khi API trả 404 trước lúc truyền xong file lớn, trình duyệt có thể chỉ hiện lỗi kết nối `Failed to fetch`.

Đã thêm lại `importTemplatePacksBulk`, nhận multipart field `files`, tối đa 300 file và 256 MiB/file. Route giữ JwtAuthGuard, TenantGuard, PermissionsGuard của controller, thêm PlatformAdminGuard và quyền `lead.write`, rồi gọi bộ xử lý importBulk hiện có. Không thay parser, dữ liệu template hoặc trang khách hàng.

Kiểm tra đạt:

- TypeScript toàn API: `tsc --project apps/api/tsconfig.json --noEmit --incremental false`.
- `scripts/test-landing-page-template-bulk-route-http.cjs`: controller/Nest/multipart/service thật với persistence giả; chặn người không phải quản trị, thiếu file, upload HTML và ZIP lỗi trong cùng request, ZIP tổng lớn hơn 20 MiB, tạo mới/cập nhật, file vượt 256 MiB trả 413. Không kết nối database.
- `scripts/verify-local-template-bulk-route.cjs`: trình duyệt Edge headless qua localhost:8080 upload hai ZIP lỗi có chủ đích; HTTP 201, báo cáo hiện đủ hai file, không còn `Failed to fetch`, không tạo/cập nhật template. Health 200; upload chưa đăng nhập trả 401. Token kiểm tra chỉ nằm trong bộ nhớ, không ghi vào báo cáo.

Đã triển khai image API `aibeego-api:template-bulk-route-fix-20261122`, kế thừa `aibeego-api:subscription-tiers-20261122` và chỉ thay controller, kèm script regression. Giữ nguyên web/worker/database. Cấu hình override: `deploy/local-template-bulk-route-fix.yml`; dùng sau các file compose hiện hành khi recreate API. Đã reload Nginx.

Lệnh triển khai lại:

```powershell
docker compose -p aibeego -f docker-compose.yml -f docker-compose.local.yml -f deploy/local-subscription-tiers.yml -f deploy/local-template-bulk-route-fix.yml up -d --no-deps --no-build api
```

Bản API trước sửa được giữ ở `aibeego-api:before-template-bulk-route-fix-20261122`; bỏ override sửa upload và recreate API bằng cấu hình subscription hiện tại để quay lại. Báo cáo và ảnh kiểm tra giao diện nằm trong `tmp/template-bulk-route-fix-20261122/`.
