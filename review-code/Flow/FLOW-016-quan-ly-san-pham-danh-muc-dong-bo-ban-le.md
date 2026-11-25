# [FLOW-016] Quản lý Sản phẩm, Danh mục & Đồng bộ Bán lẻ (Sales Products & Catalog)

> **Tầng nghiệp vụ**: TẦNG 4: DANH MỤC SẢN PHẨM, DỊCH VỤ & QUẢN TRỊ KHO (CATALOG, SERVICES & INVENTORY)  
> **Thứ tự thực thi**: 16 / 58  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Hoàn thành điều kiện tiên quyết trước khi kích hoạt luồng này.

---

## NỘI DUNG CHI TIẾT LUỒNG NGHIỆP VỤ

* **Điều kiện tiên quyết**: Đã có Tổ chức (FLOW-007).
* **Tác nhân**: Quản lý kho / Nhân viên sản phẩm.
* **Chi tiết luồng**:
  1. Vào `/sales/products`, tạo Danh mục sản phẩm (`SalesProductCategory`): Mỹ phẩm, Thực phẩm chức năng, Thiết bị...
  2. Tạo Sản phẩm mới (`SalesProduct`):
     - Tên sản phẩm, Mã SKU, Mã Barcode/Mã vạch.
     - Giá niêm yết (Giá bìa), Giá bán lẻ, Giá bán sỉ, Giá vốn định mức.
     - Thuế suất VAT (0%, 8%, 10%).
     - Hình ảnh sản phẩm, Mô tả chi tiết, Đơn vị tính (Chai, Lọ, Hộp, Bộ).
     - Định nghĩa phân loại biến thể (nếu có: Dung tích, Mùi hương, Màu sắc).
  3. *Tùy chọn*: Kết nối cửa hàng WooCommerce (`WooCommerceConnection`) hoặc nhập từ File Excel (`SalesProductImport`) để tự động đưa hàng nghìn sản phẩm vào hệ thống.
* **Đầu ra**: Danh mục sản phẩm sẵn sàng để bán và đưa lên Landing Page.
* **Mở khóa**: FLOW-018 (Đơn mua hàng), FLOW-021 (Landing Page sản phẩm), FLOW-033 (Coupon), FLOW-034 (Tạo đơn hàng).

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG (NAVIGATION)

[⬅️ **Luồng trước**: FLOW-015 - Cổng Thanh toán & Tự động Đối soát Ngân hàng (Payment Gateway & SePAY)](./FLOW-015-cong-thanh-toan-tu-dong-doi-soat-ngan-hang.md) | [📋 **Mục lục 58 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-017 - Quản lý Dịch vụ Spa, Phòng & Giường (Services, Spa Rooms & Beds)](./FLOW-017-quan-ly-dich-vu-spa-phong-giuong.md)
