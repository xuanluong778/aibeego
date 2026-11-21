# Hoàn thiện nhập từng sản phẩm — 21/11/2026

Đã hoàn thiện luồng hiện có tại **Bán hàng → Sản phẩm**, sử dụng `createProduct` / `updateProduct`. Chưa deploy và chưa cập nhật container ứng dụng đang chạy. Các thay đổi ngoài phạm vi được giữ nguyên.

Không tìm thấy `AGENTS.md` trong repo, các thư mục cha đã kiểm tra hoặc các thư mục con liên quan.

## Thay đổi

- Form có tên, SKU, barcode, danh mục, đơn vị, giá bán, giá vốn, tồn đầu kỳ, tồn tối thiểu và ghi chú. Có **Lưu và thêm tiếp**, thông báo thành công, lỗi tại trường và giữ nguyên dữ liệu khi lưu lỗi.
- Tên được trim và không được rỗng. Giá phải là số hữu hạn không âm; tồn phải là số nguyên không âm. Dữ liệu rỗng, boolean, mảng hoặc sai định dạng không bị chuyển thành 0. Kiểm tra thực hiện ở frontend, DTO và service.
- SKU/barcode là chuỗi, giữ số 0 đầu. Bắt lỗi Prisma `P2002` từ unique constraint theo `organizationId`, trả HTTP 409 và lỗi đúng trường, kể cả khi hai request tranh chấp đồng thời.
- Khi sửa có thể xóa SKU, barcode, danh mục và ghi chú. Không gửi hoặc cho phép cập nhật `stockQty` trực tiếp.
- Tồn đầu kỳ dương tiếp tục tạo sản phẩm, lô `OPENING`, movement `INBOUND`, movement line và cập nhật tồn trong cùng transaction. Tồn bằng 0 không tạo lô/movement. Không đổi giá vốn của lô cũ khi sửa giá vốn trên sản phẩm.
- Controller thực thi `order.write` cho tạo/sửa sản phẩm và tạo danh mục, kể cả khi guard quyền chung đang ở shadow mode. Giữ bypass OWNER/SUPER_ADMIN theo hệ thống hiện có. Frontend ẩn nút thêm/sửa và khóa thao tác khi thiếu quyền.
- Có chuyển trang trước/sau, tổng số sản phẩm và đặt lại trang khi tìm kiếm/lưu. Danh sách được sắp xếp ổn định bằng `updatedAt`, sau đó `id`.
- Sau lưu, làm mới nhóm cache React Query `sales` và tăng generation cache theo tổ chức phía server. Khi thêm danh mục, chờ danh sách cập nhật rồi chọn danh mục mới; bỏ qua giá trị reset rỗng phát sinh từ Select bên trong form.

## Tệp chính

- `apps/web/src/app/(app)/sales/products/page.tsx`
- `apps/web/src/hooks/use-sales.ts`
- `apps/api/src/sales/sales.service.ts`
- `apps/api/src/sales/sales.controller.ts`
- `apps/api/src/sales/sales.rbac.ts`
- `apps/api/src/sales/dto/sales.dto.ts`
- `scripts/test-sales-products.cjs`

## Database và migration

Không thêm model hoặc migration. `SalesProduct` đã có đầy đủ các cột và unique constraint cần thiết:

- SKU: migration `20260825180000_sales_orders`.
- Barcode: migration `20260825190000_sales_inventory_batches`.

Không sửa schema/migration trong nhiệm vụ này. Không đổi nghiệp vụ giá vốn/báo cáo; không thêm website, ảnh hoặc biến thể.

## Kết quả kiểm chứng

`pnpm.cmd --filter @marketingspa/api build`: **đạt**.

`node scripts/test-sales-products.cjs`: **đạt** với PostgreSQL, Redis riêng và dữ liệu giả:

1. Validation qua HTTP `ValidationPipe` với cấu hình implicit conversion như ứng dụng.
2. Giữ số 0 đầu, lưu ghi chú, đơn vị, giá, danh mục và tồn đầu kỳ.
3. Trùng SKU/barcode trong cùng tổ chức; cho phép dùng cùng mã ở tổ chức khác.
4. Tranh chấp tạo SKU, tạo barcode và sửa barcode đồng thời: một request thành công, request còn lại nhận lỗi đúng trường.
5. Cấm sửa tồn trực tiếp; xóa trường tùy chọn; giữ giá vốn của lô đã tạo.
6. Phân quyền đọc/ghi, OWNER, shadow mode và cách ly tổ chức/category.
7. Gây lỗi thật bằng trigger PostgreSQL khi ghi movement: rollback sản phẩm, lô và movement. Trigger được gỡ sau kiểm thử.
8. Cache Redis được làm mới sau tạo/sửa; phân trang 51 sản phẩm không trùng/thiếu.
9. Edge headless chạy trang và hooks thật tới controller/database kiểm thử: validation tại trường, chọn/tạo danh mục, lưu và thêm tiếp, giữ dữ liệu khi trùng SKU/barcode, sửa ghi chú, chuyển trang/tìm kiếm, giao diện chỉ đọc và mobile.

Ảnh kiểm tra nằm tại `tmp/sales-products-qa/`.

## Giới hạn kiểm thử

- Xác thực JWT trong bộ kiểm thử dùng actor giả; controller, DTO, TenantGuard, PermissionsGuard, service, Prisma và Redis dùng implementation thật. Chưa chạy đăng nhập đầy đủ hoặc thử trên database đang sử dụng của ứng dụng.
- Typecheck toàn web còn 132 lỗi ngoài hai tệp frontend thay đổi, gồm admin layout, sales inventory/dashboard, dictionary i18n và module locale thiếu. Không sửa các lỗi ngoài phạm vi này. Không có lỗi được báo trong trang sản phẩm hoặc `use-sales.ts` ở lượt kiểm tra đó.
- Chưa deploy hoặc chạy migration trên môi trường ứng dụng.

## Chạy lại kiểm thử

Tạo PostgreSQL 16 và Redis 7 tạm riêng, bind loopback lần lượt `18543` và `18579`. Database phải là `sales_products_qa`, user `salesqa`, password `salesqa-local-only`; không sử dụng database ứng dụng. Script chỉ dùng URL kiểm thử cố định, xác nhận tên database rồi xóa dữ liệu fixture bằng `TRUNCATE organizations CASCADE` trước mỗi lượt.

```powershell
$env:DATABASE_URL = 'postgresql://salesqa:salesqa-local-only@127.0.0.1:18543/sales_products_qa?schema=public'
pnpm.cmd exec prisma db push --schema packages/database/prisma/schema.prisma --skip-generate
pnpm.cmd --filter @marketingspa/api build
node scripts/test-sales-products.cjs
```

Edge và dependency Playwright hiện có được dùng cho kiểm tra giao diện. Hai container kiểm thử có nhãn `task=sales-products-qa` được dọn sau khi kiểm chứng hoàn tất.
