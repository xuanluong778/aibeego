# [FLOW-050] Phân Ca Làm Việc & Lập Lịch Trực (Work Shift Policies & Shift Assignment)

> **Tầng nghiệp vụ**: TẦNG 12: QUẢN TRỊ NHÂN SỰ, CA KÍP & CHẤM CÔNG (HRM & ATTENDANCE MANAGEMENT)  
> **Thứ tự thực thi**: 50 / 58  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Hoàn thành điều kiện tiên quyết trước khi kích hoạt luồng này.

---

## NỘI DUNG CHI TIẾT LUỒNG NGHIỆP VỤ

* **Điều kiện tiên quyết**: Đã có danh sách Nhân viên (FLOW-049).
* **Tác nhân**: Quản lý chi nhánh / Trưởng ca.
* **Chi tiết luồng**:
  1. Vào `/hrm/shifts/policies`, định nghĩa Chính sách ca làm việc (`WorkShiftPolicy`):
     - Ca Sáng: 08:00 - 12:00.
     - Ca Chiều: 13:00 - 17:00.
     - Ca Tối: 17:00 - 21:00.
     - Cấu hình số phút cho phép đi muộn / về sớm (ví dụ: cho phép muộn 10 phút).
  2. Lập Lịch phân ca tuần/tháng (`ShiftAssignment`):
     - Phân ca linh hoạt trên giao diện ma trận lịch tuần cho từng nhân viên.
     - Đảm bảo mỗi ca trực tại chi nhánh luôn có đủ số lượng lễ tân và kỹ thuật viên spa.
  3. Nhân viên xem được lịch trực của mình trên ứng dụng điện thoại.
* **Đầu ra**: Lịch trực minh bạch, làm căn cứ đối soát chấm công tự động.
* **Mở khóa**: FLOW-051.

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG (NAVIGATION)

[⬅️ **Luồng trước**: FLOW-049 - Quản Lý Hồ Sơ Nhân Sự & Hợp Đồng Lao Động (Employee Lifecycle)](./FLOW-049-quan-ly-ho-so-nhan-su-hop-dong-lao-dong.md) | [📋 **Mục lục 58 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-051 - Chấm Công Bằng Mã QR Động / Vị Trí GPS (QR Attendance Punch)](./FLOW-051-cham-cong-bang-ma-qr-dong-vi-tri-gps.md)
