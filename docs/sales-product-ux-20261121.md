# Sản phẩm có ảnh, popup chi tiết và tìm kiếm nhập/xuất kho

Đã cập nhật API/Web Docker local tại `http://localhost:8080` ngày 21/11/2026. Chưa deploy production.

## Thay đổi

- Danh sách sản phẩm có ảnh thu nhỏ, tên, model/SKU, giá, tồn nội bộ và tồn website; không bung mô tả trong ô bảng. Sản phẩm website thiếu giá được hiển thị “Chưa có giá”; tồn nội bộ bằng 0 không bị diễn giải thành website hết hàng.
- Bấm ảnh/tên/**Xem chi tiết** mở popup nền sáng theo bố cục WordPress: ảnh lớn và album bên trái, thông tin bên phải; tab mô tả đầy đủ, thông số, nguồn dữ liệu. Mô tả không còn bị giới hạn 1.000 ký tự như bản xem trong bảng; script/iframe bị loại và Markdown không render HTML thô.
- Chi tiết chỉ tải khi mở popup. Ảnh lấy từ URL nguồn, lazy load, có fallback khi thiếu/lỗi ảnh; chưa sao chép toàn bộ ảnh về app.
- Thêm trường model vào sản phẩm, form sửa/tạo, API và mẫu nhập Excel/CSV (cột cuối, dạng Text). WooCommerce lấy model từ thuộc tính hoặc nhãn Model rõ ràng, không đoán từ tiêu đề và không gán model thành SKU.
- Nhập/Xuất kho tìm kiếm bằng tên, model, SKU, barcode; gợi ý có ảnh, thông tin tồn, phân trang và bàn phím. Không giới hạn tìm kiếm trong 50 sản phẩm đầu. Tra cứu nhanh mã ưu tiên SKU/barcode chính xác; kết quả tên/model không duy nhất báo chọn thủ công.
- Quyền đọc danh sách/chi tiết/lookup và ghi nhập/xuất/điều chỉnh/đối soát được kiểm tra thực trong controller. Form kho khóa thao tác với tài khoản chỉ đọc.

## Dữ liệu và triển khai

Migration: `20261121170000_sales_product_model`, checksum trong manifest. Bổ sung cột/index và backfill nhãn rõ trong thuộc tính/mô tả. Mô tả ngắn của nguồn cũ được xử lý bằng `scripts/backfill-sales-product-models.cjs --apply`: dùng parser chung, chỉ ghi model đang null khi các nguồn cùng đồng thuận, ghi audit cùng transaction và vô hiệu cache theo tổ chức. Script mặc định dry-run, yêu cầu DATABASE_URL tường minh, không đọc .env; chạy lại không ghi trùng hoặc ghi đè model đã khai báo.

Đã bổ sung model cho **48 sản phẩm nguồn cũ**. Không đổi tên, SKU, barcode, giá bán, giá vốn hoặc số liệu kho. Trước/sau: **62 sản phẩm, tổng tồn 617, 15 lô, 31 movement, 1 phiên nhập**; hash dữ liệu sản phẩm (loại trừ model) và lô khớp hoàn toàn.

Backup đã kiểm tra: `tmp/local-product-ux-release-20261121/database-before.dump`. Image quay lui: `aibeego-api:before-product-ux-20261121` và `aibeego-web:before-product-ux-20261121`. Chỉ cập nhật API/Web, reload Nginx và marker phiên bản public; giữ nguyên worker/PostgreSQL/Redis.

## Kiểm chứng

- Schema trước tính năng → chạy migration → xác minh backfill mẫu HTML: đạt.
- `scripts/test-sales-product-ux.cjs`: model, tìm ngoài trang đầu, lookup mơ hồ, ảnh/gallery, mô tả đầy đủ/XSS, tenancy, quyền đọc/ghi, mobile, chọn bằng bàn phím và thực xuất kho trên QA: đạt.
- Hồi quy nhập từng sản phẩm, Excel/CSV và WooCommerce: đạt. Một selector test đổi từ ô tên sản phẩm sang nút tên tương ứng với thiết kế mới.
- Build shared/database/API và Docker API/Web: đạt. Toàn web còn các lỗi TypeScript đã có ngoài phạm vi; không có lỗi ở các tệp giao diện/model/picker mới.
- Kiểm tra bản localhost bằng Edge với dữ liệu thật: ảnh website tải được, popup hiện đúng, tìm/chọn theo model hoạt động. Chỉ đọc API/giao diện, không bấm ghi phiếu kho hay sửa giá trong kiểm tra này.
- Bằng chứng: `tmp/local-product-ux-release-20261121/local-product-catalog.png`, `local-product-detail.png`, `local-product-specifications.png`, `local-outbound-search.png`, `verification.json`.

## Phạm vi còn lại

Ảnh sản phẩm nhập tay chưa có luồng upload riêng trong lượt này. Chưa thay đổi công thức lợi nhuận hoặc quy trình ghi sổ. Đánh giá và ưu tiên trước SaaS ở `docs/sales-saas-readiness-20261121.md`; báo cáo hiện dùng giá vốn danh mục nên chưa đủ để khẳng định lợi nhuận lịch sử chính xác.
