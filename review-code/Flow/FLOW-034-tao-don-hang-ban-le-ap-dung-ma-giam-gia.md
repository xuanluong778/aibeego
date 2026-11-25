# [FLOW-034] Tạo Đơn Hàng Bán Lẻ & Áp Dụng Mã Giảm Giá (Order Creation with Coupon)

> **Tầng nghiệp vụ**: TẦNG 8: BÁN HÀNG, KHUYẾN MÃI, ĐƠN HÀNG & THANH TOÁN (SALES, COUPONS, ORDERS & PAYMENTS)  
> **Thứ tự thực thi**: 34 / 58  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Hoàn thành điều kiện tiên quyết trước khi kích hoạt luồng này.

---

## NỘI DUNG CHI TIẾT LUỒNG NGHIỆP VỤ

* **Điều kiện tiên quyết**: Đã có Sản phẩm còn tồn kho (FLOW-019), Dịch vụ hoàn tất (FLOW-032), Khách hàng (FLOW-026) và Mã Coupon (FLOW-033).
* **Tác nhân**: Thu ngân / Nhân viên bán hàng / Khách mua hàng online.
* **Chi tiết luồng**:
  1. Mở màn hình Tạo Đơn Hàng `/sales/orders/new` (POS):
     - Chọn Khách hàng (Họ tên, SĐT, Địa chỉ nhận hàng).
     - Chọn Kênh bán hàng (Tại quầy, Online, Landing Page, Fanpage).
     - Thêm Sản phẩm / Dịch vụ vào giỏ: Chọn số lượng.
     - Hệ thống kiểm tra tức thì: Số lượng mua có vượt quá tồn kho khả dụng không? Nếu thiếu, cảnh báo ngay.
  2. **Áp dụng Mã Giảm Giá (Coupon Validation Engine)**:
     - Người dùng nhập mã: ví dụ `AIBEEGO50`.
     - Hệ thống kiểm tra đồng thời 6 điều kiện nghiêm ngặt:
       1. Mã có tồn tại và đang ở trạng thái `ACTIVE` không?
       2. Thời gian hiện tại có nằm trong khoảng hiệu lực không?
       3. Tổng số lượt dùng đã vượt quá giới hạn tối đa chưa?
       4. Khách hàng này đã từng dùng mã này trong quá khứ chưa?
       5. Tổng tiền hàng có đạt mức giá trị tối thiểu không?
       6. Giỏ hàng có chứa đúng sản phẩm/dịch vụ nằm trong danh sách khuyến mãi không?
     - Nếu thỏa mãn: Tính toán số tiền được giảm (`discountAmount`).
     - Nếu không thỏa mãn: Báo lỗi chính xác lý do (ví dụ: *"Đơn hàng chưa đạt tối thiểu 500.000đ để dùng mã này"*).
  3. Tính toán tổng thể đơn hàng:
     - `Tiền hàng` = Tổng tiền các sản phẩm.
     - `Tiền giảm giá` = Khấu trừ từ coupon.
     - `Thuế VAT` = Tiền hàng sau giảm x Thuế suất %.
     - `Phí vận chuyển` = Phí giao hàng (nếu có).
     - `Tổng thanh toán` = `Tiền hàng - Giảm giá + Thuế + Phí ship`.
  4. Bấm "Tạo Đơn Hàng": Sinh bản ghi `SalesOrder` với mã đơn duy nhất (ví dụ: `ORD-202611-0001`) và trạng thái `PENDING_PAYMENT`.
* **Đầu vào**: Khách hàng, Giỏ hàng, Mã coupon, Chi nhánh bán.
* **Đầu ra**: Đơn hàng chính thức kèm số tiền phải thu chính xác.
* **Mở khóa**: FLOW-035.

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG (NAVIGATION)

[⬅️ **Luồng trước**: FLOW-033 - Thiết Lập Mã Giảm Giá & Chính Sách Khuyến Mãi (Coupons & Promotions)](./FLOW-033-thiet-lap-ma-giam-gia-chinh-sach-khuyen-mai.md) | [📋 **Mục lục 58 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-035 - Xử Lý Thanh Toán Đơn Hàng & Tự Động Đối Soát (Payment Processing)](./FLOW-035-xu-ly-thanh-toan-don-hang-tu-dong-doi-soat.md)
