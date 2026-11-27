# [FLOW-054] Quản lý Nhân sự, Phòng ban, Hợp đồng, Hồ sơ & Cấp tài khoản Hệ thống

> **Tầng nghiệp vụ**: TẦNG 14: QUẢN TRỊ NHÂN SỰ (HRM), CA KÍP, CHẤM CÔNG & CÔNG VIỆC  
> **Thứ tự thực thi**: 54 / 62  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Chỉ kích hoạt khi các điều kiện tiên quyết đã sẵn sàng.

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT ("CÓ A")
* FLOW-008 (Chi nhánh `Branch`) & FLOW-009 (Vai trò RBAC `Role`).

## 2. TÁC NHÂN THAM GIA (ACTORS)
* Quản trị Nhân sự (HR) / Quản lý tổ chức

## 3. THÀNH PHẦN HỆ THỐNG LIÊN QUAN (CODEBASE ARCHITECTURE)
* **UI Routes**: `/hrm/employees`, `/hrm/employees/[id]`, `/employees`.
* **API Endpoints**: `GET/POST /hrm/departments`, `GET/POST/PATCH /hrm/employees`, `POST /hrm/employees/:id/deactivate|account|account/reset-password`, `GET/POST /hrm/employees/:id/contracts`, `PATCH /hrm/contracts/:id`, `GET/POST /hrm/employees/:id/documents|documents/upload`, `DELETE /hrm/documents/:id`, `GET /employees/:id/performance`.
* **Models**: `Department`, `Employee`, `EmploymentContract`, `EmployeeDocument`, `EmployeeAccountInvite`.

## 4. QUY TRÌNH THỰC HIỆN CHI TIẾT (STEP-BY-STEP)
1. Khởi tạo cơ cấu phòng ban (`POST /hrm/departments`).
2. Tạo hồ sơ nhân viên (`POST /hrm/employees`): thông tin cá nhân, mã nhân viên, chi nhánh, phòng ban, chức danh.
3. Khai báo Hợp đồng lao động (`contracts`) và tải lên hồ sơ tài liệu đính kèm (`documents/upload` bảo vệ qua `AuthenticatedUploadsMiddleware`).
4. Cấp tài khoản đăng nhập hệ thống cho nhân viên (`POST /hrm/employees/:id/account`), đặt lại mật khẩu (`account/reset-password`) hoặc ngừng kích hoạt khi nghỉ việc (`deactivate`).

## 5. DỮ LIỆU ĐẦU VÀO & ĐẦU RA (INPUT / OUTPUT)
* **Đầu vào (Input)**: Hồ sơ nhân sự, hợp đồng, phòng ban, vai trò tài khoản.
* **Đầu ra (Output)**: Hồ sơ `Employee` hoàn chỉnh và tài khoản truy cập hệ thống.

## 6. KIỂM SOÁT NGOẠI LỆ, BẢO MẬT & TÍNH TOÀN VẸN
* Kiểm tra quyền qua `hrm-role.rbac.ts`; tài liệu nhân sự chỉ người có quyền hoặc chính chủ xem được.

## 7. MỞ KHÓA LUỒNG TIẾP THEO ("MỚI CÓ B")
* **Kích hoạt / Mở khóa**: FLOW-029 (Nhân viên nhận Lead), FLOW-031 (KTV nhận lịch hẹn), FLOW-055, FLOW-057

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG

[⬅️ **Luồng trước**: FLOW-053](./FLOW-053-cau-hinh-tai-khoan-nhan-tien-yeu-cau-rut-chi-tra-hoa-hong.md) | [📋 **Mục lục 62 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-055](./FLOW-055-chinh-sach-ca-lam-viec-lich-phan-ca.md)
