# [FLOW-009] Phân quyền RBAC & Bảo vệ Tài nguyên Hệ thống

> **Tầng nghiệp vụ**: TẦNG 2: TỔ CHỨC, CHI NHÁNH, RBAC & GÓI CƯỚC / CREDIT  
> **Thứ tự thực thi**: 9 / 62  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Chỉ kích hoạt khi các điều kiện tiên quyết đã sẵn sàng.

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT ("CÓ A")
* FLOW-007 (Đã có Tổ chức và bảng `Permission` từ FLOW-002).

## 2. TÁC NHÂN THAM GIA (ACTORS)
* Quản trị viên tổ chức / Hệ thống Guards

## 3. THÀNH PHẦN HỆ THỐNG LIÊN QUAN (CODEBASE ARCHITECTURE)
* **Backend Security**: `PermissionsGuard`, `@RequirePermissions()`, `hrm-role.rbac.ts`, `finance.rbac.ts`, `AuthenticatedUploadsMiddleware`, `plan-storage.ts`.
* **Models**: `Role`, `Permission`, `RolePermission`, `User`.

## 4. QUY TRÌNH THỰC HIỆN CHI TIẾT (STEP-BY-STEP)
1. Mỗi API endpoint được gắn decorator `@RequirePermissions(...)` và kiểm tra qua `PermissionsGuard`.
2. Các phân hệ nhạy cảm như Tài chính (`finance.rbac.ts`) và Nhân sự (`hrm-role.rbac.ts`) áp dụng kiểm tra quyền theo vai trò và phạm vi dữ liệu (ví dụ: nhân viên chỉ xem bảng công/task của mình, trưởng bộ phận xem theo phòng ban).
3. Tài nguyên file tải lên (`/uploads/...`) được bảo vệ bởi `AuthenticatedUploadsMiddleware` và tính dung lượng lưu trữ (`PlanStoredFile` / `plan-storage.ts`).

## 5. DỮ LIỆU ĐẦU VÀO & ĐẦU RA (INPUT / OUTPUT)
* **Đầu vào (Input)**: JWT user payload + vai trò + ma trận `RolePermission`.
* **Đầu ra (Output)**: Cho phép (`200`) hoặc từ chối truy cập (`403 Forbidden`) chuẩn xác ở cấp endpoint & bản ghi.

## 6. KIỂM SOÁT NGOẠI LỆ, BẢO MẬT & TÍNH TOÀN VẸN
* Chống leo thang đặc quyền (privilege escalation) và chống truy cập chéo tenant (`organizationId` mismatch).

## 7. MỞ KHÓA LUỒNG TIẾP THEO ("MỚI CÓ B")
* **Kích hoạt / Mở khóa**: FLOW-029 (Phân bổ Lead), FLOW-054 (Tạo tài khoản nhân viên)

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG

[⬅️ **Luồng trước**: FLOW-008](./FLOW-008-quan-ly-chi-nhanh-co-so-kinh-doanh.md) | [📋 **Mục lục 62 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-010](./FLOW-010-kich-hoat-dung-thu-dang-ky-goi-cuoc-kiem-soat-han-ngach.md)
