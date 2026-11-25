# [FLOW-030] Đặt Lịch Hẹn Dịch Vụ (Appointment Booking)

> **Tầng nghiệp vụ**: TẦNG 7: ĐẶT LỊCH HẸN & VẬN HÀNH DỊCH VỤ (APPOINTMENTS & SPA OPERATIONS)  
> **Thứ tự thực thi**: 30 / 58  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Hoàn thành điều kiện tiên quyết trước khi kích hoạt luồng này.

---

## NỘI DUNG CHI TIẾT LUỒNG NGHIỆP VỤ

* **Điều kiện tiên quyết**: Đã có Dịch vụ/Phòng/Giường (FLOW-017) và Khách hàng/Lead (FLOW-026).
* **Tác nhân**: Khách hàng (đặt qua Web) hoặc Nhân viên lễ tân/CSKH (đặt qua CRM).
* **Chi tiết luồng**:
  1. Truy cập màn hình Đặt lịch `/appointments/new`:
     - Chọn Khách hàng (hoặc nhập nhanh khách mới).
     - Chọn Chi nhánh (Branch).
     - Chọn Dịch vụ / Liệu trình (Service) -> Hệ thống tự động điền thời lượng (Duration: ví dụ 60 phút).
     - Chọn Ngày hẹn và Giờ bắt đầu (Start Time).
     - Chọn Kỹ thuật viên / Chuyên viên thực hiện (Employee).
     - Chọn Phòng spa (`SpaRoom`) và Giường (`SpaBed`).
  2. Thuật toán kiểm tra xung đột lịch (Conflict & Overlap Validation):
     - Kiểm tra Kỹ thuật viên đó có đang bận phục vụ khách khác cùng khung giờ không?
     - Kiểm tra Giường/Phòng đó có đang kín chỗ trong khoảng `[startTime, startTime + duration]` không?
     - Nếu trùng: Cảnh báo đỏ và gợi ý khung giờ hoặc giường trống gần nhất.
  3. Bấm "Tạo Lịch hẹn": Bản ghi `Appointment` được tạo với trạng thái `PENDING` (Chờ xác nhận).
* **Đầu vào**: Khách hàng, Dịch vụ, Chi nhánh, Nhân viên, Giường, Ngày giờ.
* **Đầu ra**: Bản ghi `Appointment` hợp lệ, không bị trùng lặp lịch.
* **Mở khóa**: FLOW-031.

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG (NAVIGATION)

[⬅️ **Luồng trước**: FLOW-029 - Chăm Sóc Lead, Ghi Chú & Lịch Nhắc Việc (Lead Notes & CRM Tasks)](./FLOW-029-cham-soc-lead-ghi-chu-lich-nhac-viec.md) | [📋 **Mục lục 58 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-031 - Xác Nhận & Tự Động Nhắc Lịch (Confirmation & Automated Reminders)](./FLOW-031-xac-nhan-tu-dong-nhac-lich.md)
