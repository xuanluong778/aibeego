# [FLOW-040] Chiến Dịch Email Marketing & Chuỗi Tự Động (Email Marketing & Drip Automation)

> **Tầng nghiệp vụ**: TẦNG 9: MARKETING ĐA KÊNH & CHIẾN DỊCH TỰ ĐỘNG (OMNICHANNEL MARKETING & AUTOPILOT)  
> **Thứ tự thực thi**: 40 / 58  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Hoàn thành điều kiện tiên quyết trước khi kích hoạt luồng này.

---

## NỘI DUNG CHI TIẾT LUỒNG NGHIỆP VỤ

* **Điều kiện tiên quyết**: Đã có Tên miền gửi email (FLOW-014) và Tệp khách hàng CRM (FLOW-026).
* **Tác nhân**: Email Marketer / Quản lý CSKH.
* **Chi tiết luồng**:
  1. Thiết kế Mẫu Email (`EmailTemplate`) bằng công cụ kéo thả Visual Block Builder (Banner, Tiêu đề, Nội dung, Nút bấm CTA, Chân trang hủy đăng ký).
  2. Phân khúc tệp gửi thư (`EmailSegment`):
     - Tệp 1: Khách hàng mới đăng ký trong 7 ngày qua.
     - Tệp 2: Khách hàng từng mua hàng có giá trị đơn > 2 triệu.
     - Tệp 3: Khách hàng đã 30 ngày chưa quay lại.
  3. Tạo Chiến dịch gửi email (`EmailCampaign`):
     - Thiết lập tiêu đề email, chọn phân khúc nhận thư, hẹn giờ gửi.
     - Worker đẩy email qua máy chủ SES/Brevo/SMTP theo luồng kiểm soát tốc độ (Rate Limit).
  4. **Chuỗi kịch bản tự động (Email Automation Drip Flow)**:
     - Khách đăng ký lead -> Ngay lập tức gửi Email chào mừng + Coupon giảm 10%.
     - Sau 2 ngày -> Tự động gửi Email giới thiệu top dịch vụ được yêu thích.
     - Sau 5 ngày -> Tự động gửi Email chia sẻ cảm nhận của khách hàng cũ.
  5. Theo dõi đo lường: Thống kê tỷ lệ Thư gửi thành công, Tỷ lệ Mở (Open Rate), Tỷ lệ Click liên kết (Click Rate), Tỷ lệ Báo spam và Hủy nhận tin (Unsubscribe).
* **Đầu ra**: Chăm sóc nuôi dưỡng khách hàng tự động với chi phí gần như bằng 0.

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG (NAVIGATION)

[⬅️ **Luồng trước**: FLOW-039 - Quản Trị & Vận Hành Chiến Dịch Quảng Cáo AI (AI Ads Manager & Autopilot)](./FLOW-039-quan-tri-van-hanh-chien-dich-quang-cao-ai.md) | [📋 **Mục lục 58 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-041 - Chiến Dịch Tin Nhắn Zalo ZNS & Messaging Broadcast](./FLOW-041-chien-dich-tin-nhan-zalo-zns-messaging-broadcast.md)
