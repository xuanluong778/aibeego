# [FLOW-015] Cổng Thanh toán & Tự động Đối soát Ngân hàng (Payment Gateway & SePAY)

> **Tầng nghiệp vụ**: TẦNG 3: KẾT NỐI KÊNH BÊN NGOÀI & TÍCH HỢP (INTEGRATIONS & EXTERNAL CHANNELS)  
> **Thứ tự thực thi**: 15 / 58  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Hoàn thành điều kiện tiên quyết trước khi kích hoạt luồng này.

---

## NỘI DUNG CHI TIẾT LUỒNG NGHIỆP VỤ

* **Điều kiện tiên quyết**: Đã có Tổ chức (FLOW-007).
* **Tác nhân**: Kế toán / Quản trị viên.
* **Chi tiết luồng**:
  1. Vào `/settings/integrations/payment`, chọn tích hợp VietQR / SePAY / Cổng thanh toán.
  2. Điền Số tài khoản ngân hàng, Tên chủ tài khoản, Ngân hàng thụ hưởng.
  3. Nhập API Key hoặc Webhook Token do cổng cung cấp.
  4. Thiết lập Endpoint Webhook tiếp nhận biến động số dư: `https://aibeego.com/api/v1/webhooks/payment`.
  5. Cơ chế đối soát tự động: Khi khách chuyển khoản kèm nội dung cú pháp (ví dụ: `ABG 12345`), Webhook ngân hàng bắn dữ liệu sang -> Hệ thống kiểm tra số tiền và mã đơn -> Khớp lệnh -> Cập nhật trạng thái Đơn hàng/Gói cước tức thì (trong vòng 3-5 giây).
* **Đầu ra**: Kênh thanh toán tự động không cần đối soát thủ công.
* **Mở khóa**: FLOW-010 (Thanh toán gói cước), FLOW-011 (Nạp ví credit), FLOW-035 (Thanh toán đơn hàng).

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG (NAVIGATION)

[⬅️ **Luồng trước**: FLOW-014 - Cấu hình Tên miền gửi Email & Dịch vụ Gửi thư (Email Sender Setup)](./FLOW-014-cau-hinh-ten-mien-gui-email-dich-vu-gui-thu.md) | [📋 **Mục lục 58 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-016 - Quản lý Sản phẩm, Danh mục & Đồng bộ Bán lẻ (Sales Products & Catalog)](./FLOW-016-quan-ly-san-pham-danh-muc-dong-bo-ban-le.md)
