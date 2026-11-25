# [FLOW-014] Cấu hình Tên miền gửi Email & Dịch vụ Gửi thư (Email Sender Setup)

> **Tầng nghiệp vụ**: TẦNG 3: KẾT NỐI KÊNH BÊN NGOÀI & TÍCH HỢP (INTEGRATIONS & EXTERNAL CHANNELS)  
> **Thứ tự thực thi**: 14 / 58  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Hoàn thành điều kiện tiên quyết trước khi kích hoạt luồng này.

---

## NỘI DUNG CHI TIẾT LUỒNG NGHIỆP VỤ

* **Điều kiện tiên quyết**: Doanh nghiệp sở hữu tên miền riêng (ví dụ: `mybrand.com`).
* **Tác nhân**: Kỹ thuật viên / Quản trị viên.
* **Chi tiết luồng**:
  1. Vào `/email-marketing/settings`, thêm Tên miền gửi thư (`EmailSenderDomain`): `marketing.mybrand.com`.
  2. Hệ thống tự động sinh 3 bản ghi DNS chuẩn quốc tế:
     - **SPF**: Xác thực máy chủ được phép gửi thư.
     - **DKIM**: Khóa chữ ký điện tử chống giả mạo email.
     - **DMARC**: Chính sách xử lý thư giả mạo và bảo vệ uy tín hòm thư.
  3. Người dùng cập nhật các bản ghi trên vào nhà quản lý DNS tên miền.
  4. Người dùng bấm "Xác minh DNS". API kiểm tra DNS qua dịch vụ giải mã bản ghi. Khi hợp lệ, trạng thái chuyển sang `VERIFIED`.
  5. Cấu hình thông tin người gửi: Tên hiển thị (Sender Name), Email gửi (Sender Email), Email nhận phản hồi (Reply-To).
* **Đầu ra**: Tên miền gửi email được chứng thực, đảm bảo tỷ lệ vào Inbox cao nhất (tránh Spam/Junk).
* **Mở khóa**: FLOW-040 (Chiến dịch Email Marketing).

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG (NAVIGATION)

[⬅️ **Luồng trước**: FLOW-013 - Kết nối Zalo Official Account (Zalo OA & ZNS Integration)](./FLOW-013-ket-noi-zalo-official-account.md) | [📋 **Mục lục 58 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-015 - Cổng Thanh toán & Tự động Đối soát Ngân hàng (Payment Gateway & SePAY)](./FLOW-015-cong-thanh-toan-tu-dong-doi-soat-ngan-hang.md)
