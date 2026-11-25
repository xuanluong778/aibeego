# [FLOW-017] Quản lý Dịch vụ Spa, Phòng & Giường (Services, Spa Rooms & Beds)

> **Tầng nghiệp vụ**: TẦNG 4: DANH MỤC SẢN PHẨM, DỊCH VỤ & QUẢN TRỊ KHO (CATALOG, SERVICES & INVENTORY)  
> **Thứ tự thực thi**: 17 / 58  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Hoàn thành điều kiện tiên quyết trước khi kích hoạt luồng này.

---

## NỘI DUNG CHI TIẾT LUỒNG NGHIỆP VỤ

* **Điều kiện tiên quyết**: Đã có Chi nhánh (FLOW-008).
* **Tác nhân**: Quản lý chi nhánh Spa.
* **Chi tiết luồng**:
  1. Vào `/appointments/services`, tạo Dịch vụ spa (`Service`):
     - Tên liệu trình (ví dụ: "Chăm sóc da chuyên sâu 90 phút").
     - Thời lượng liệu trình (Duration: 30p, 60p, 90p, 120p).
     - Đơn giá dịch vụ.
  2. Vào `/appointments/rooms`, cấu hình cơ sở vật chất theo chi nhánh:
     - Tạo Phòng spa (`SpaRoom`): Phòng VIP, Phòng Laser, Phòng Body.
     - Trong mỗi phòng, tạo các Giường phục vụ (`SpaBed`): Giường 01, Giường 02...
     - Khai báo Trang thiết bị máy móc đi kèm (`SpaEquipment`): Máy triệt lông, Máy nâng cơ...
* **Đầu ra**: Sơ đồ dịch vụ và buồng phòng chi tiết theo từng chi nhánh.
* **Mở khóa**: FLOW-021 (Landing Page dịch vụ), FLOW-030 (Đặt lịch hẹn dịch vụ).

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG (NAVIGATION)

[⬅️ **Luồng trước**: FLOW-016 - Quản lý Sản phẩm, Danh mục & Đồng bộ Bán lẻ (Sales Products & Catalog)](./FLOW-016-quan-ly-san-pham-danh-muc-dong-bo-ban-le.md) | [📋 **Mục lục 58 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-018 - Quản lý Nhà cung cấp & Tạo Đơn mua hàng (Suppliers & Purchase Orders)](./FLOW-018-quan-ly-nha-cung-cap-tao-don-mua-hang.md)
