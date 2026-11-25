# [FLOW-031] Xác Nhận & Tự Động Nhắc Lịch (Confirmation & Automated Reminders)

> **Tầng nghiệp vụ**: TẦNG 7: ĐẶT LỊCH HẸN & VẬN HÀNH DỊCH VỤ (APPOINTMENTS & SPA OPERATIONS)  
> **Thứ tự thực thi**: 31 / 58  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Hoàn thành điều kiện tiên quyết trước khi kích hoạt luồng này.

---

## NỘI DUNG CHI TIẾT LUỒNG NGHIỆP VỤ

* **Điều kiện tiên quyết**: Đã có Lịch hẹn (FLOW-030) và Kết nối Zalo/Email (FLOW-013, FLOW-014).
* **Tác nhân**: Lễ tân xác nhận + Hệ thống Automation Worker.
* **Chi tiết luồng**:
  1. Lễ tân gọi điện xác nhận hoặc bấm "Xác nhận lịch" trên hệ thống -> Trạng thái đổi thành `CONFIRMED`.
  2. Hệ thống tự động kích hoạt Worker gửi tin nhắn:
     - Tin nhắn 1 (Gửi tức thì): Thông báo "Lịch hẹn làm đẹp của quý khách tại AiBeego Spa đã được xác nhận vào lúc 15:00 ngày mai tại Chi nhánh 1". Gửi qua Zalo ZNS hoặc SMS Brandname.
     - Tin nhắn 2 (Hẹn giờ trước 24 giờ): Nhắc nhở chuẩn bị và chỉ đường tới cơ sở.
     - Tin nhắn 3 (Hẹn giờ trước 2 giờ): Nhắc khách khởi hành kèm hotline hỗ trợ.
  3. Nếu khách bấm phản hồi "Xin dời lịch" hoặc "Hủy lịch": Trạng thái lịch được cập nhật và lễ tân nhận thông báo để sắp xếp lại.
* **Đầu ra**: Tỷ lệ khách bùng lịch (No-show rate) giảm thiểu tối đa.
* **Mở khóa**: FLOW-032.

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG (NAVIGATION)

[⬅️ **Luồng trước**: FLOW-030 - Đặt Lịch Hẹn Dịch Vụ (Appointment Booking)](./FLOW-030-dat-lich-hen-dich-vu.md) | [📋 **Mục lục 58 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-032 - Check-in, Thực Hiện Dịch Vụ & Hoàn Tất Liệu Trình (In-Service & Completion)](./FLOW-032-check-in-thuc-hien-dich-vu-hoan-tat-lieu-trinh.md)
