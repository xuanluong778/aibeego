# [FLOW-032] Xác nhận, Dời lịch, Nhắc lịch Tự động & Hoàn tất Dịch vụ

> **Tầng nghiệp vụ**: TẦNG 7: ĐẶT LỊCH HẸN & VẬN HÀNH DỊCH VỤ SPA  
> **Thứ tự thực thi**: 32 / 62  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Chỉ kích hoạt khi các điều kiện tiên quyết đã sẵn sàng.

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT ("CÓ A")
* FLOW-031 (Đã có lịch hẹn `Appointment`) & FLOW-015/016 (Kênh Zalo/Email nếu gửi nhắc tự động).

## 2. TÁC NHÂN THAM GIA (ACTORS)
* Lễ tân + Kỹ thuật viên + Hệ thống nhắc lịch

## 3. THÀNH PHẦN HỆ THỐNG LIÊN QUAN (CODEBASE ARCHITECTURE)
* **UI Routes**: `/appointments`.
* **API Endpoints**: `PATCH /appointments/:id/status`, `POST /appointments/:id/reschedule`, `POST /appointments/:id/remind`, `DELETE /appointments/:id`.
* **Models**: `Appointment`, `MessagingCampaign` / Reminder logs.

## 4. QUY TRÌNH THỰC HIỆN CHI TIẾT (STEP-BY-STEP)
1. Lễ tân xác nhận lịch (`PATCH /appointments/:id/status` -> `CONFIRMED`) hoặc gửi nhắc lịch thủ công/tự động (`POST /appointments/:id/remind`) qua Zalo ZNS / Email.
2. Nếu khách xin đổi giờ: dùng `POST /appointments/:id/reschedule` để cập nhật thời gian mới kèm kiểm tra lại xung đột phòng/KTV.
3. Khi khách đến cơ sở: chuyển trạng thái `CHECKED_IN` -> `IN_PROGRESS` (đang thực hiện dịch vụ) -> `COMPLETED` (hoàn thành) hoặc `NO_SHOW` / `CANCELLED`.
4. Lịch hẹn hoàn thành chuyển sang bước lập hóa đơn thanh toán dịch vụ.

## 5. DỮ LIỆU ĐẦU VÀO & ĐẦU RA (INPUT / OUTPUT)
* **Đầu vào (Input)**: Thay đổi trạng thái / thời gian lịch hẹn hoặc lệnh gửi nhắc lịch.
* **Đầu ra (Output)**: Vòng đời lịch hẹn hoàn chỉnh, tỷ lệ đến đúng hẹn cao.

## 6. KIỂM SOÁT NGOẠI LỆ, BẢO MẬT & TÍNH TOÀN VẸN
* Kiểm soát state transition hợp lệ (`status-transitions.util.ts`); gửi nhắc lịch không vi phạm quiet hours.

## 7. MỞ KHÓA LUỒNG TIẾP THEO ("MỚI CÓ B")
* **Kích hoạt / Mở khóa**: FLOW-033 (Lập đơn thanh toán dịch vụ)

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG

[⬅️ **Luồng trước**: FLOW-031](./FLOW-031-dat-lich-hen-dich-vu-spa-kiem-tra-xung-dot-phong-giuong-ky-thu.md) | [📋 **Mục lục 62 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-033](./FLOW-033-tao-don-hang-dich-vu-spa-thu-tien-tai-quay.md)
