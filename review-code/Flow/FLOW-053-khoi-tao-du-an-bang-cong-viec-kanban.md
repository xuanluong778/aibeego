# [FLOW-053] Khởi Tạo Dự Án & Bảng Công Việc Kanban (Work Projects & Boards)

> **Tầng nghiệp vụ**: TẦNG 13: QUẢN TRỊ DỰ ÁN & TIẾN ĐỘ CÔNG VIỆC (WORK MANAGEMENT - KANBAN & TASKS)  
> **Thứ tự thực thi**: 53 / 58  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Hoàn thành điều kiện tiên quyết trước khi kích hoạt luồng này.

---

## NỘI DUNG CHI TIẾT LUỒNG NGHIỆP VỤ

* **Điều kiện tiên quyết**: Đã có Nhân sự và Tổ chức (FLOW-049, FLOW-007).
* **Tác nhân**: Trưởng dự án / Quản lý nhóm.
* **Chi tiết luồng**:
  1. Vào `/work-management/projects`, tạo Dự án mới (`WorkProject`): ví dụ "Chiến dịch Khai trương Chi nhánh 3".
  2. Thiết lập Bảng làm việc Kanban (`WorkBoardColumn`):
     - Cột mặc định: `CẦN LÀM (To-Do)` -> `ĐANG LÀM (In Progress)` -> `CHỜ DUYỆT (Review)` -> `HOÀN THÀNH (Done)`.
  3. Thêm các thành viên tham gia vào dự án.
* **Đầu ra**: Không gian làm việc nhóm tập trung, rõ ràng mục tiêu.
* **Mở khóa**: FLOW-054.

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG (NAVIGATION)

[⬅️ **Luồng trước**: FLOW-052 - Quản Lý Nghỉ Phép, Tăng Ca & Chốt Bảng Công Tháng (Leave, Overtime & Timesheet)](./FLOW-052-quan-ly-nghi-phep-tang-ca-chot-bang-cong-thang.md) | [📋 **Mục lục 58 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-054 - Giao Việc, Checklist, Tiến Độ & Log Thời Gian (Task Execution & Time Tracking)](./FLOW-054-giao-viec-checklist-tien-do-log-thoi-gian.md)
