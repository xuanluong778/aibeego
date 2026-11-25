# [FLOW-035] Xử Lý Thanh Toán Đơn Hàng & Tự Động Đối Soát (Payment Processing)

> **Tầng nghiệp vụ**: TẦNG 8: BÁN HÀNG, KHUYẾN MÃI, ĐƠN HÀNG & THANH TOÁN (SALES, COUPONS, ORDERS & PAYMENTS)  
> **Thứ tự thực thi**: 35 / 58  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Hoàn thành điều kiện tiên quyết trước khi kích hoạt luồng này.

---

## NỘI DUNG CHI TIẾT LUỒNG NGHIỆP VỤ

* **Điều kiện tiên quyết**: Đã có Đơn hàng cần thanh toán (FLOW-034).
* **Tác nhân**: Khách hàng + Thu ngân + Cổng thanh toán / Ngân hàng.
* **Chi tiết luồng**:
  1. Chọn phương thức thanh toán:
     - **Cách 1: Tiền mặt**: Thu ngân nhận tiền, bấm "Xác nhận đã nhận tiền mặt".
     - **Cách 2: Chuyển khoản VietQR động**:
       - Màn hình POS hoặc màn hình điện thoại của khách hiển thị mã VietQR chứa đúng số tài khoản ngân hàng của doanh nghiệp, số tiền chính xác từng đồng và nội dung chuyển khoản là mã đơn hàng (ví dụ: `AIBEEGO ORD12345`).
       - Khách dùng App ngân hàng quét mã và bấm chuyển khoản.
  2. Xử lý Đối soát Tự động qua Webhook (SePAY / VietQR API):
     - Ngân hàng nhận tiền -> Gửi Webhook sang hệ thống AiBeego.
     - API đọc nội dung chuyển khoản, bóc tách mã đơn `ORD12345`, đối soát số tiền nhận được so với tổng tiền đơn hàng.
     - Nếu khớp lệnh: Hệ thống tự động chuyển trạng thái Đơn hàng thành `PAID` (Đã thanh toán) ngay trong tích tắc (không cần thu ngân bấm tay).
     - Tạo bản ghi `SalesPayment` liên kết với đơn hàng.
     - In hóa đơn bán hàng cho khách.
* **Đầu ra**: Bản ghi `SalesPayment` thành công, Đơn hàng chuyển sang trạng thái sẵn sàng xuất kho giao hàng.
* **Mở khóa**: FLOW-036, FLOW-042 (Gửi conversion về Ads), FLOW-047 (Tính hoa hồng affiliate), FLOW-056 (Ghi nhận doanh thu tài chính).

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG (NAVIGATION)

[⬅️ **Luồng trước**: FLOW-034 - Tạo Đơn Hàng Bán Lẻ & Áp Dụng Mã Giảm Giá (Order Creation with Coupon)](./FLOW-034-tao-don-hang-ban-le-ap-dung-ma-giam-gia.md) | [📋 **Mục lục 58 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-036 - Xuất Kho Giao Hàng & Trừ Tồn Kho Tự Động (Fulfillment & Stock Movement)](./FLOW-036-xuat-kho-giao-hang-tru-ton-kho-tu-dong.md)
