# [FLOW-052] Quản Lý Nghỉ Phép, Tăng Ca & Chốt Bảng Công Tháng (Leave, Overtime & Timesheet)

> **Tầng nghiệp vụ**: TẦNG 12: QUẢN TRỊ NHÂN SỰ, CA KÍP & CHẤM CÔNG (HRM & ATTENDANCE MANAGEMENT)  
> **Thứ tự thực thi**: 52 / 58  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Hoàn thành điều kiện tiên quyết trước khi kích hoạt luồng này.

---

## NỘI DUNG CHI TIẾT LUỒNG NGHIỆP VỤ

* **Điều kiện tiên quyết**: Đã có dữ liệu chấm công hàng ngày (FLOW-051).
* **Tác nhân**: Nhân viên + Quản lý duyệt + Kế toán tiền lương.
* **Chi tiết luồng**:
  1. Đơn từ phát sinh:
     - Nhân viên tạo Đơn xin nghỉ phép (`LeaveRequest`) hoặc Đơn làm thêm giờ (`OvertimeRequest`).
     - Quản lý nhận thông báo, bấm Phê duyệt hoặc Từ chối kèm lý do.
  2. Chốt kỳ bảng công (`TimesheetPeriod`):
     - Cuối tháng, hệ thống tự động tổng hợp toàn bộ lượt chấm công, đơn phép, đơn tăng ca thành Bảng chấm công chi tiết (`AttendanceDay`):
       - Tổng số ngày công thực tế.
       - Tổng số phút đi muộn / về sớm.
       - Tổng số giờ làm thêm (OT).
       - Số ngày nghỉ có phép và không phép.
  3. Kế toán rà soát, thực hiện điều chỉnh nếu có sai sót (`AttendanceAdjustment`) và bấm "Chốt bảng công" để tính lương.
* **Đầu ra**: Bảng công chuẩn xác làm căn cứ chi trả lương nhân viên (FLOW-056).

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG (NAVIGATION)

[⬅️ **Luồng trước**: FLOW-051 - Chấm Công Bằng Mã QR Động / Vị Trí GPS (QR Attendance Punch)](./FLOW-051-cham-cong-bang-ma-qr-dong-vi-tri-gps.md) | [📋 **Mục lục 58 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-053 - Khởi Tạo Dự Án & Bảng Công Việc Kanban (Work Projects & Boards)](./FLOW-053-khoi-tao-du-an-bang-cong-viec-kanban.md)
