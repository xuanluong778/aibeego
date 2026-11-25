# [FLOW-041] Chiến Dịch Tin Nhắn Zalo ZNS & Messaging Broadcast

> **Tầng nghiệp vụ**: TẦNG 9: MARKETING ĐA KÊNH & CHIẾN DỊCH TỰ ĐỘNG (OMNICHANNEL MARKETING & AUTOPILOT)  
> **Thứ tự thực thi**: 41 / 58  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Hoàn thành điều kiện tiên quyết trước khi kích hoạt luồng này.

---

## NỘI DUNG CHI TIẾT LUỒNG NGHIỆP VỤ

* **Điều kiện tiên quyết**: Đã có Zalo OA kết nối (FLOW-013) và Tệp khách hàng có SĐT (FLOW-026).
* **Tác nhân**: Marketer.
* **Chi tiết luồng**:
  1. Lựa chọn Mẫu tin nhắn Zalo Notification Service (ZNS) đã được Zalo xét duyệt nội dung.
  2. Lọc tệp khách hàng theo điều kiện (Chi nhánh, Dịch vụ từng làm, Ngày sinh nhật).
  3. Kiểm tra khung giờ gửi tin an toàn (`MessagingQuietHours`): Không gửi tin vào ban đêm (từ 22:00 đến 06:00 sáng hôm sau) để tránh làm phiền khách.
  4. Kích hoạt chiến dịch gửi tin (`MessagingCampaign`):
     - Đưa vào hàng đợi BullMQ, gửi từng lô (Batch).
     - Ghi nhận trạng thái phản hồi từ Zalo API: Gửi thành công, Số không dùng Zalo, Lỗi số dư.
* **Đầu ra**: Thông điệp tiếp cận trực tiếp 100% điện thoại của khách hàng với tỷ lệ mở đọc trên 90%.

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG (NAVIGATION)

[⬅️ **Luồng trước**: FLOW-040 - Chiến Dịch Email Marketing & Chuỗi Tự Động (Email Marketing & Drip Automation)](./FLOW-040-chien-dich-email-marketing-chuoi-tu-dong.md) | [📋 **Mục lục 58 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-042 - Đo Lường Nguồn Gốc & Phân Bổ Chuyển Đổi (Attribution & Meta CAPI)](./FLOW-042-do-luong-nguon-goc-phan-bo-chuyen-doi.md)
