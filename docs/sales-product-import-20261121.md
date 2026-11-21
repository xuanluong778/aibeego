# Nhập Excel/CSV sản phẩm — bàn giao 21/11/2026

**Cập nhật tiếp ngày 21/11/2026:** bản Docker local đã bổ sung WooCommerce; nút nhập hiện tên **Nhập nhanh sản phẩm**, Excel/CSV nằm trong tab **Excel/CSV và lịch sử**. Xem `docs/sales-woocommerce-import-20261121.md` cho bản cập nhật và backup mới nhất.

Đã bổ sung **Nhập Excel/CSV** tại **Bán hàng → Sản phẩm** trong SalesModule hiện có. Dùng chung DTO validation, `SalesService.createProduct` và `updateProduct`; không thêm cách ghi kho riêng. Sau yêu cầu cập nhật local ngày 21/11/2026, đã build và cập nhật API/Web Docker local cùng migration mới. Không deploy production.

## Bản local đang chạy

- Địa chỉ: `http://localhost:8080/sales/products` → **Nhập Excel/CSV**. Có ô chọn file, nút tải mẫu XLSX/CSV và lịch sử. Nhấn Ctrl+F5 nếu trình duyệt còn giữ bundle cũ.
- Migration `20261121130000_sales_product_imports` đã áp dụng trong transaction và ghi checksum vào lịch sử Prisma. Không chạy các migration khác.
- Đã sao lưu database dạng custom dump trước cập nhật: `tmp/local-sales-release-20261121/database-before.dump`; kiểm tra danh mục backup bằng `pg_restore --list` thành công.
- Image quay lui: `aibeego-api:before-sales-import-20261121`, `aibeego-web:before-sales-import-20261121`. API/Web mới chạy tại project Docker `aibeego`, giữ nguyên worker và các dịch vụ khác.
- Đối chiếu trước/sau migration: 14 sản phẩm, tổng tồn 617, 15 lô kho, không thay đổi.
- Kiểm chứng trực tiếp bản đang chạy bằng Edge: mở nút nhập/ô chọn file và tải mẫu XLSX thành công; API lịch sử/mẫu XLSX/CSV trả 200, request không xác thực bị chặn 401. Chỉ kiểm tra đọc/tải mẫu, không ghi sản phẩm thật. Ảnh tại `tmp/local-sales-release-20261121/local-product-import.png`.
- Tính năng này nhập danh mục sản phẩm và tồn đầu kỳ khi tạo sản phẩm mới; nút nằm ở trang **Sản phẩm**, chưa thêm importer riêng cho phiếu nhập kho hàng đã có.

## Sử dụng

1. Mở **Nhập Excel/CSV**, tải mẫu `.xlsx` hoặc CSV UTF-8. Các cột: Tên sản phẩm, SKU, Barcode, Danh mục, Đơn vị, Giá bán, Giá vốn, Tồn đầu kỳ, Tồn tối thiểu, Ghi chú.
2. Chọn file, dấu phân cách CSV nếu cần, rồi đọc file để tạo mã phiên. XLSX nhiều sheet yêu cầu chọn sheet; không mặc định lấy sheet đầu.
3. Ánh xạ từng trường tới cột. Cột mẫu được gợi ý khi tên khớp duy nhất; có thể bỏ qua cột hoặc ánh xạ thủ công. Mỗi cột chỉ được dùng một lần.
4. Mặc định **Bỏ qua** mã đã tồn tại. Nếu chọn cập nhật, đánh dấu các trường muốn đổi. Ô trống giữ nguyên dữ liệu cũ. Tồn đầu kỳ không có trong danh sách trường cập nhật.
5. Danh mục mới chỉ được tạo khi bật **Cho phép tạo danh mục mới**. Xem trước không tạo danh mục hoặc sản phẩm.
6. Xem trước lỗi, mã trùng, hành động dự kiến và lưu ý từng dòng. Chỉ xác nhận được bản preview hiện hành; sửa ánh xạ/tùy chọn phải xem trước lại.
7. Xác nhận chỉ nhập các dòng hợp lệ. Có tiến trình, kết quả theo dòng và file CSV kết quả/lỗi tải về. Dòng lỗi dữ liệu bị loại; sửa file rồi tạo phiên mới nếu cần. Dòng lỗi lúc ghi có nút thử lại.
8. Lịch sử có phân trang. Mở lại phiên đã xác nhận để tiếp tục hoặc xem kết quả.

## Quy tắc dữ liệu

- CSV đọc UTF-8 nghiêm ngặt, có/không BOM; hỗ trợ dấu phẩy/chấm phẩy, dấu nháy và ô có xuống dòng. Trường hợp tự nhận dấu phân cách không rõ ràng sẽ yêu cầu chọn rõ, không tự đoán. Số dòng CSV là số thứ tự bản ghi logic, không phải số dòng vật lý khi có ô xuống dòng.
- XLSX giữ kiểu ô. SKU/barcode phải là Text, giữ số 0 đầu. Nếu mã đã được Excel lưu thành số, kể cả có định dạng hiển thị `000000`, dòng bị báo lỗi để người dùng sửa dữ liệu gốc; không suy đoán số 0 bị mất.
- Công thức không được tính hoặc dùng cached result. Công thức/kiểu ô không hỗ trợ được báo lỗi tại dòng khi ánh xạ vào trường nhập. Không lấy dữ liệu từ macro hoặc external workbook links. Hyperlink chỉ lấy phần chữ, không truy cập URL.
- Giá nhập dưới dạng `1234` hoặc `1234.50`: không dùng dấu phân nhóm, dấu phẩy thập phân, ký hiệu tiền hoặc số mũ. Tối đa hai chữ số thập phân. Tồn phải là số nguyên không âm. Dùng chung giới hạn DTO và database của sản phẩm.
- Trùng SKU/barcode trong file bị báo lỗi cho các dòng liên quan, không tự chọn dòng thắng. Trong chế độ cập nhật, nhiều dòng trỏ cùng một sản phẩm cũng bị báo trùng. SKU/barcode trỏ hai sản phẩm khác nhau luôn là xung đột.
- Chỉ đối chiếu sản phẩm và danh mục của đúng `organizationId`. Trước mỗi lần ghi, đối chiếu lại dữ liệu hiện hành. Mã mới xuất hiện sau preview được bỏ qua theo chế độ mặc định; nếu có thể dẫn tới cập nhật sản phẩm khác với preview thì dòng báo lỗi.
- Cập nhật không đưa `stockQty` vào DTO, không tạo tồn đầu kỳ và không thay unit cost của lô kho cũ. Ô trống không xóa SKU, barcode, danh mục hoặc ghi chú.
- Tạo mới có tồn đầu kỳ tiếp tục đi qua nghiệp vụ OPENING/INBOUND của `SalesService`. Danh mục mới, sản phẩm, tồn đầu kỳ, audit và kết quả dòng cùng transaction. Nếu ghi kết quả dòng thất bại, sản phẩm và kho cũng rollback.

## Retry và tiến trình

- `clientToken` chống lặp khi tải lại cùng request upload. Token không được dùng cho file/dấu phân cách khác.
- Mỗi phiên có UUID và mỗi dòng có UUID cùng unique `(importId, rowNumber)`. Sau xác nhận, dữ liệu/ánh xạ không được sửa.
- Xử lý giữ row lock của phiên trong từng transaction dòng. Trạng thái dòng thành công và sản phẩm được commit cùng nhau; replay không chạy lại dòng thành công, bao gồm dòng không có SKU/barcode.
- Một request xử lý tối đa **25 dòng**. Giao diện gọi các lô tiếp theo và cập nhật tiến trình sau từng lô. Có thể dừng sau lô hiện tại hoặc đóng trang rồi tiếp tục cùng phiên trong lịch sử. **Đây là xử lý theo lô do giao diện tiếp tục gọi, không phải job nền chạy hết file khi đã đóng trang.** Request đã nhận vẫn có thể hoàn thành lô đang chạy.
- Retry chỉ chọn các dòng `ERROR`; dòng `CREATED`, `UPDATED`, `SKIPPED`, `INVALID` không chạy lại. Không bảo đảm chống trùng dòng thiếu mã giữa hai phiên mới độc lập; retry phải dùng lại phiên gốc.
- Sau lô, tăng generation cache theo tổ chức và invalidation nhóm React Query `sales`, gồm sản phẩm, kho, danh mục, lịch sử và kết quả.

## Giới hạn

- File tối đa **5MB**, **2.000 dòng dữ liệu cho toàn workbook**, **40 cột**, **10 sheet**, **5.000 ký tự/ô**. Kiểm tra cả server và giới hạn file ở giao diện.
- ZIP tối đa 256 entries, 20MB giải nén thực tế, 100.000 ô và địa chỉ dòng tối đa 5.000; từ chối entry trùng, mã hóa, macro/external links, DTD/entity. Không giải nén ra filesystem. Nội dung XLSX chuẩn hóa lưu draft tối đa 8MB.
- Server cho tối đa hai tác vụ parse đồng thời mỗi process. Không hỗ trợ `.xls`, `.xlsm`, workbook mã hóa, CSV encoding khác UTF-8 hoặc công thức. File có cấu trúc CSV lỗi bị từ chối cả file; lỗi giá trị sản phẩm được hiển thị theo dòng ở preview.
- Workbook chuẩn hóa được xóa khỏi phiên khi xác nhận; dữ liệu dòng, kết quả và lịch sử vẫn được lưu. Chưa thêm chính sách tự xóa lịch sử.
- Báo cáo CSV có BOM UTF-8 và vô hiệu hóa tiền tố công thức để không kích hoạt khi mở bằng bảng tính. Nếu mở CSV bằng Excel, cần chọn cột mã là Text; dùng mẫu XLSX để cột SKU/barcode được định dạng Text sẵn.

## Migration và tệp thay đổi

Migration mới: **`20261121130000_sales_product_imports`**.

Thêm `sales_product_imports` và `sales_product_import_rows`, unique client token theo tổ chức, unique phiên/dòng, foreign key ghép `(import_id, organization_id)` và CHECK trạng thái. Không sửa dữ liệu sản phẩm/kho hiện có. Schema hợp lệ; Prisma Client đã generate trong workspace và image API mới. Migration đã được kiểm thử trên QA và áp dụng trên database Docker local sau khi được yêu cầu cập nhật. Production chưa áp dụng migration này.

Tệp chính:

- `apps/api/src/sales/product-spreadsheet.util.ts`: parser sản phẩm và file mẫu. Đã đọc `email-marketing/email-spreadsheet.util.ts`; không tái sử dụng parser liên hệ tách CSV theo dòng và tự chọn sheet đầu.
- `apps/api/src/sales/product-import.service.ts`, `product-import.controller.ts`, `dto/product-import.dto.ts`: phiên, preview, xác nhận, lô, retry, lịch sử và báo cáo. Toàn bộ endpoint thực thi `order.write`, kể cả guard chung ở shadow mode.
- `apps/api/src/sales/sales.service.ts`: cho phép truyền transaction để importer dùng chung create/update, validation, category và audit; luồng nhập từng sản phẩm vẫn chạy như trước.
- `apps/api/src/sales/sales.module.ts`: đăng ký controller/provider trong module có sẵn.
- `apps/web/src/components/sales/product-import-dialog.tsx`, `hooks/use-sales.ts`, `types/sales-product-import.ts` và trang sản phẩm: giao diện, quyền, tiến trình và cache.
- `apps/api/package.json`/lockfile: ExcelJS 4.4.0, csv-parse 6.1.0, yauzl 3.2.0 và type declarations.

Các thay đổi ngoài nhiệm vụ, gồm RAG/chatbot/landing page, được giữ nguyên. Không đổi báo cáo/giá vốn và không deploy production.

## Kết quả kiểm tra

- Prisma schema validate/generate và build database: **đạt**.
- Full API build: **đạt**.
- Migration mới áp dụng lên schema chưa có các bảng import trong PostgreSQL 16 riêng: **đạt**.
- `scripts/test-sales-product-import.cjs`: **đạt**, dùng CSV/XLSX thực, PostgreSQL/Redis thực và dữ liệu giả. Kiểm chứng parser/giới hạn, công thức/kiểu ô, preview lỗi từng phần, trùng file/database, hai mã trỏ hai sản phẩm, opt-in danh mục, cập nhật chọn trường/giữ ô trống/không đổi tồn, xử lý đồng thời, mã thay đổi sau preview, cache, 25 dòng/lô và cách ly tổ chức/quyền.
- Gây lỗi PostgreSQL ở movement và ở kết quả dòng: rollback sản phẩm/kho/danh mục; retry chỉ ghi đúng một lần, có fixture thiếu SKU/barcode. Foreign key ghép từ chối dòng dùng tổ chức khác phiên.
- Edge headless chạy trang/hooks thật tới controller/database QA: tải mẫu, upload, ánh xạ thủ công, chọn sheet, xem trước lỗi, xác nhận, tiến trình, báo cáo UTF-8, lịch sử, mobile và ẩn nút với user chỉ đọc: **đạt**. Ảnh tại `tmp/sales-import-qa/`.
- Hồi quy `scripts/test-sales-products.cjs`: **đạt** sau khi tái sử dụng transaction.
- Typecheck toàn web còn **132 lỗi có sẵn ngoài các tệp nhập sản phẩm**, chủ yếu admin/sales dashboard/inventory, dictionary trùng key và thiếu module locale. Không có lỗi trong component/type/hook/trang sản phẩm thay đổi ở lượt kiểm tra; không sửa lỗi ngoài phạm vi.

Xác thực JWT trong harness dùng actor giả; TenantGuard, PermissionsGuard, controller, DTO, service, Prisma và Redis dùng implementation thật. Sau kiểm thử đã build/cập nhật Docker local và xác minh đọc/tải mẫu trên database local bằng phiên nội bộ ngắn hạn. Chưa kiểm thử đăng nhập từ mật khẩu hoặc nhập file khách hàng thật lên database local/production.

## Chạy lại QA

Tạo mới PostgreSQL 16/Redis 7 **chỉ cho dữ liệu giả**, bind loopback `18543` và `18579`. PostgreSQL: database `sales_products_qa`, user `salesqa`, password `salesqa-local-only`.

```powershell
pnpm.cmd exec prisma generate --schema packages/database/prisma/schema.prisma
pnpm.cmd --filter @marketingspa/database build
pnpm.cmd --filter @marketingspa/api build
node scripts/prepare-sales-import-qa.cjs
node scripts/test-sales-products.cjs
node scripts/test-sales-product-import.cjs
```

Chạy hai bộ test nối tiếp, không song song, vì cùng dùng database QA cố định. Script prepare chỉ dùng trên database QA mới: dựng schema trước migration rồi áp dụng SQL mới. Test xác minh tên database và `TRUNCATE organizations CASCADE` để làm sạch fixture; không trỏ vào database ứng dụng. Edge đã cài được dùng bởi Playwright. Các container QA được dọn sau bàn giao.
