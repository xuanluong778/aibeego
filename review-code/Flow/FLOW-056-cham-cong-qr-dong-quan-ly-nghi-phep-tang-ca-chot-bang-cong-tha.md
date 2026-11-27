# [FLOW-056] Chấm công QR Động, Quản lý Nghỉ phép/Tăng ca & Chốt Bảng công Tháng

> **Tầng nghiệp vụ**: TẦNG 14: QUẢN TRỊ NHÂN SỰ (HRM), CA KÍP, CHẤM CÔNG & CÔNG VIỆC  
> **Thứ tự thực thi**: 56 / 62  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Chỉ kích hoạt khi các điều kiện tiên quyết đã sẵn sàng.

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT ("CÓ A")
* FLOW-055 (Đã có lịch phân ca `ShiftAssignment`).

## 2. TÁC NHÂN THAM GIA (ACTORS)
* Nhân viên + Quản lý duyệt đơn + Kế toán/HR

## 3. THÀNH PHẦN HỆ THỐNG LIÊN QUAN (CODEBASE ARCHITECTURE)
* **UI Routes**: `/hrm/attendance`, `/hrm/leave`, `/hrm`.
* **API Endpoints**: `GET/POST /hrm/attendance/qr-tokens`, `POST /hrm/attendance/punch`, `GET /hrm/attendance/today|days|days/export`, `POST /hrm/attendance/days/:id/correct|adjustments`, `GET/POST /hrm/leave-requests*`, `POST /hrm/leave-requests/:id/approve|reject|cancel`, `GET/POST /hrm/timesheet-periods`, `POST /hrm/timesheet-periods/:id/lock|unlock`.
* **Models**: `AttendanceQrToken`, `AttendancePunch`, `AttendanceDay`, `AttendanceAdjustment`, `LeaveRequest`, `OvertimeRequest`, `TimesheetPeriod`.

## 4. QUY TRÌNH THỰC HIỆN CHI TIẾT (STEP-BY-STEP)
1. **Chấm công QR**: Quầy lễ tân hiển thị mã QR động (`POST /hrm/attendance/qr-tokens`, tự làm mới định kỳ). Nhân viên quét mã QR qua `/hrm/attendance` -> `POST /hrm/attendance/punch` (kiểm tra token hợp lệ, GPS chi nhánh và đối chiếu ca làm việc `ShiftAssignment` tạo `AttendanceDay`).
2. **Nghỉ phép & Tăng ca**: Nhân viên gửi đơn xin nghỉ (`LeaveRequest`, kiểm tra số phép tồn `leave-requests/balance`) hoặc đơn tăng ca (`OvertimeRequest`) -> Quản lý duyệt (`approve`/`reject`).
3. **Chốt công**: HR rà soát điều chỉnh ngày công (`days/:id/correct`, `adjustments`), xuất Excel (`days/export`) và khóa kỳ bảng công tháng (`POST /hrm/timesheet-periods/:id/lock`).

## 5. DỮ LIỆU ĐẦU VÀO & ĐẦU RA (INPUT / OUTPUT)
* **Đầu vào (Input)**: Lượt quét mã QR (IN/OUT), đơn nghỉ phép/tăng ca, điều chỉnh công.
* **Đầu ra (Output)**: Bảng chấm công kỳ `TimesheetPeriod` đã khóa phục vụ tính lương.

## 6. KIỂM SOÁT NGOẠI LỆ, BẢO MẬT & TÍNH TOÀN VẸN
* QR token ngắn hạn chống chụp ảnh chấm công hộ; khi `TimesheetPeriod` đã `lock` thì không cho sửa công trái phép.

## 7. MỞ KHÓA LUỒNG TIẾP THEO ("MỚI CÓ B")
* **Kích hoạt / Mở khóa**: FLOW-059 (Chi lương nhân viên vào sổ Tài chính)

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG

[⬅️ **Luồng trước**: FLOW-055](./FLOW-055-chinh-sach-ca-lam-viec-lich-phan-ca.md) | [📋 **Mục lục 62 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-057](./FLOW-057-khoi-tao-du-an-bang-kanban-giao-viec-hien-thi-thanh-vien.md)
