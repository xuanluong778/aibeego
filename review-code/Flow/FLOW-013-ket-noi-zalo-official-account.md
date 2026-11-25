# [FLOW-013] Kết nối Zalo Official Account (Zalo OA & ZNS Integration)

> **Tầng nghiệp vụ**: TẦNG 3: KẾT NỐI KÊNH BÊN NGOÀI & TÍCH HỢP (INTEGRATIONS & EXTERNAL CHANNELS)  
> **Thứ tự thực thi**: 13 / 58  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Hoàn thành điều kiện tiên quyết trước khi kích hoạt luồng này.

---

## NỘI DUNG CHI TIẾT LUỒNG NGHIỆP VỤ

* **Điều kiện tiên quyết**: Doanh nghiệp sở hữu Zalo OA đã được xác thực.
* **Tác nhân**: Quản trị viên.
* **Chi tiết luồng**:
  1. Vào `/settings/integrations/zalo`, bấm "Ủy quyền Zalo OA".
  2. Đăng nhập Zalo, chọn Official Account cần cấp quyền.
  3. Hệ thống lưu `oa_id`, `access_token` (hạn 25 giờ) và `refresh_token` (hạn 3 tháng).
  4. Cấu hình Cron Job tự động làm mới access token định kỳ trước khi hết hạn.
  5. Thiết lập Webhook Zalo để nhận sự kiện người dùng quan tâm OA, gửi tin nhắn tới OA.
  6. Cấu hình dịch vụ Zalo Notification Service (ZNS) để gửi tin thông báo chăm sóc khách hàng theo mẫu đã duyệt.
* **Đầu ra**: `MessagingChannelConnection` (kênh Zalo), sẵn sàng gửi và nhận tin.
* **Mở khóa**: FLOW-031 (Nhắc lịch Zalo), FLOW-041 (Zalo Marketing ZNS).

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG (NAVIGATION)

[⬅️ **Luồng trước**: FLOW-012 - Kết nối Meta Fanpage & Facebook Ads (Meta Integration)](./FLOW-012-ket-noi-meta-fanpage-facebook-ads.md) | [📋 **Mục lục 58 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-014 - Cấu hình Tên miền gửi Email & Dịch vụ Gửi thư (Email Sender Setup)](./FLOW-014-cau-hinh-ten-mien-gui-email-dich-vu-gui-thu.md)
