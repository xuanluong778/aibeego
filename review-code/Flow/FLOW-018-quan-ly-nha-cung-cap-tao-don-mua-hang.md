# [FLOW-018] Quản lý Nhà cung cấp & Tạo Đơn mua hàng (Suppliers & Purchase Orders)

> **Tầng nghiệp vụ**: TẦNG 4: DANH MỤC SẢN PHẨM, DỊCH VỤ & QUẢN TRỊ KHO (CATALOG, SERVICES & INVENTORY)  
> **Thứ tự thực thi**: 18 / 58  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Hoàn thành điều kiện tiên quyết trước khi kích hoạt luồng này.

---

## NỘI DUNG CHI TIẾT LUỒNG NGHIỆP VỤ

* **Điều kiện tiên quyết**: Đã có Sản phẩm (FLOW-016).
* **Tác nhân**: Nhân viên thu mua / Kế toán kho.
* **Chi tiết luồng**:
  1. Vào `/sales/purchases/suppliers`, thêm Nhà cung cấp (`SalesSupplier`): Tên công ty, SĐT, Email, Địa chỉ, Mã số thuế, Thông tin tài khoản ngân hàng.
  2. Tạo Đơn đặt mua hàng (`SalesPurchaseOrder` - PO):
     - Chọn Nhà cung cấp.
     - Chọn Chi nhánh nhập hàng.
     - Chọn danh sách sản phẩm cần mua, số lượng, đơn giá mua thỏa thuận.
  3. Trạng thái Đơn mua hàng: `DRAFT` (Nháp) -> `SENT` (Đã gửi NCC) -> `CONFIRMED` (NCC xác nhận).
* **Đầu ra**: Bản ghi `SalesPurchaseOrder` được phê duyệt.
* **Mở khóa**: FLOW-019 (Nhập kho thực tế).

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG (NAVIGATION)

[⬅️ **Luồng trước**: FLOW-017 - Quản lý Dịch vụ Spa, Phòng & Giường (Services, Spa Rooms & Beds)](./FLOW-017-quan-ly-dich-vu-spa-phong-giuong.md) | [📋 **Mục lục 58 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-019 - Nhập kho, Quản lý Lô & Hạn sử dụng (Inward Stock & Batch Management)](./FLOW-019-nhap-kho-quan-ly-lo-han-su-dung.md)
