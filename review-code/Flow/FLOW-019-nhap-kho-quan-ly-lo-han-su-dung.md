# [FLOW-019] Nhập kho, Quản lý Lô & Hạn sử dụng (Inward Stock & Batch Management)

> **Tầng nghiệp vụ**: TẦNG 4: DANH MỤC SẢN PHẨM, DỊCH VỤ & QUẢN TRỊ KHO (CATALOG, SERVICES & INVENTORY)  
> **Thứ tự thực thi**: 19 / 58  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Hoàn thành điều kiện tiên quyết trước khi kích hoạt luồng này.

---

## NỘI DUNG CHI TIẾT LUỒNG NGHIỆP VỤ

* **Điều kiện tiên quyết**: Có Đơn mua hàng (FLOW-018) hoặc Phiếu điều chuyển.
* **Tác nhân**: Thủ kho / Quản lý chi nhánh.
* **Chi tiết luồng**:
  1. Khi hàng về đến kho, thủ kho vào Đơn mua hàng PO tương ứng, bấm "Tiến hành nhập kho".
  2. Kiểm đếm thực tế từng dòng sản phẩm:
     - Số lượng nhập thực tế (so với số lượng đặt mua).
     - Khai báo Mã số Lô sản xuất (`SalesStockBatch` - Batch Number/Lot No).
     - Ngày sản xuất (MFG) và Hạn sử dụng (EXP).
  3. Bấm "Xác nhận nhập kho":
     - Hệ thống sinh phiếu xuất/nhập kho (`SalesStockMovement` loại `IN`).
     - Tăng số lượng tồn kho khả dụng của sản phẩm tại chi nhánh đó.
     - Tính toán lại giá vốn bình quân gia quyền của sản phẩm.
     - Cập nhật trạng thái Đơn mua hàng thành `COMPLETED`.
* **Đầu ra**: Lô hàng được lưu trong kho, sẵn sàng xuất bán theo nguyên tắc FIFO (hàng hết hạn trước xuất trước).
* **Mở khóa**: FLOW-020 (Kiểm kê), FLOW-034 (Tạo đơn bán hàng), FLOW-036 (Xuất kho bán hàng).

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG (NAVIGATION)

[⬅️ **Luồng trước**: FLOW-018 - Quản lý Nhà cung cấp & Tạo Đơn mua hàng (Suppliers & Purchase Orders)](./FLOW-018-quan-ly-nha-cung-cap-tao-don-mua-hang.md) | [📋 **Mục lục 58 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-020 - Quản trị Tồn kho Đa chi nhánh, Kiểm kê & Cân đối (Stocktake & Reconciliation)](./FLOW-020-quan-tri-ton-kho-da-chi-nhanh-kiem-ke-can-doi.md)
