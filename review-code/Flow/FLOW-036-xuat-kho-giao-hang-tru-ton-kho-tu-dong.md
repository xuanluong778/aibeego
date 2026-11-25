# [FLOW-036] Xuất Kho Giao Hàng & Trừ Tồn Kho Tự Động (Fulfillment & Stock Movement)

> **Tầng nghiệp vụ**: TẦNG 8: BÁN HÀNG, KHUYẾN MÃI, ĐƠN HÀNG & THANH TOÁN (SALES, COUPONS, ORDERS & PAYMENTS)  
> **Thứ tự thực thi**: 36 / 58  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Hoàn thành điều kiện tiên quyết trước khi kích hoạt luồng này.

---

## NỘI DUNG CHI TIẾT LUỒNG NGHIỆP VỤ

* **Điều kiện tiên quyết**: Đơn hàng đã được thanh toán thành công (FLOW-035).
* **Tác nhân**: Thủ kho / Đơn vị vận chuyển (GHTK, GHN, Viettel Post...).
* **Chi tiết luồng**:
  1. Đơn hàng chuyển trạng thái sang `PROCESSING` (Đang đóng gói).
  2. Thủ kho bấm "Xuất kho giao hàng":
     - Hệ thống sinh phiếu xuất kho (`SalesStockMovement` loại `OUT`).
     - Tự động trừ số lượng tồn kho của các sản phẩm tương ứng trong bảng `SalesProduct`.
     - Xuất kho theo lô FIFO (`SalesStockBatch` có hạn dùng gần nhất được ưu tiên xuất trước).
  3. Gửi mã vận đơn và thông tin người nhận sang hãng vận chuyển đối tác.
  4. Khách nhận hàng thành công: Đơn hàng chuyển sang trạng thái `COMPLETED` (Hoàn thành).
* **Đầu ra**: Tồn kho sổ sách giảm chính xác, khách hàng nhận đủ hàng.
* **Mở khóa**: FLOW-037 (nếu có đổi trả), FLOW-040 (Gửi email chăm sóc sau mua).

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG (NAVIGATION)

[⬅️ **Luồng trước**: FLOW-035 - Xử Lý Thanh Toán Đơn Hàng & Tự Động Đối Soát (Payment Processing)](./FLOW-035-xu-ly-thanh-toan-don-hang-tu-dong-doi-soat.md) | [📋 **Mục lục 58 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-037 - Đổi Trả Hàng, Hoàn Tiền & Nhập Lại Kho (Sales Returns & Refunds)](./FLOW-037-doi-tra-hang-hoan-tien-nhap-lai-kho.md)
