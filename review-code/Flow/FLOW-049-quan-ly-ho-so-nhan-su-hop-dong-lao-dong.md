# [FLOW-049] Quản Lý Hồ Sơ Nhân Sự & Hợp Đồng Lao Động (Employee Lifecycle)

> **Tầng nghiệp vụ**: TẦNG 12: QUẢN TRỊ NHÂN SỰ, CA KÍP & CHẤM CÔNG (HRM & ATTENDANCE MANAGEMENT)  
> **Thứ tự thực thi**: 49 / 58  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Hoàn thành điều kiện tiên quyết trước khi kích hoạt luồng này.

---

## NỘI DUNG CHI TIẾT LUỒNG NGHIỆP VỤ

* **Điều kiện tiên quyết**: Đã có Chi nhánh (FLOW-008) và Vai trò (FLOW-009).
* **Tác nhân**: Trưởng phòng Nhân sự (HR Manager) / Chủ doanh nghiệp.
* **Chi tiết luồng**:
  1. Vào `/hrm/employees`, bấm "Thêm nhân viên mới" (`Employee`):
     - Họ tên, Ngày sinh, CCCD/CMND, Số điện thoại, Email cá nhân.
     - Chọn Phòng ban (`Department`): Phòng Kinh doanh, Phòng Kỹ thuật, Lễ tân...
     - Chọn Chi nhánh làm việc chính.
     - Chọn Chức danh và Vị trí công việc.
  2. Thiết lập Hợp đồng lao động (`EmploymentContract`): Loại hợp đồng (Thử việc, Chính thức, Thời vụ), Mức lương cơ bản, Ngày bắt đầu và Ngày hết hạn.
  3. Gửi Lời mời kích hoạt tài khoản (`EmployeeAccountInvite`): Nhân viên nhận link kích hoạt qua email để tạo mật khẩu đăng nhập vào hệ thống nội bộ.
* **Đầu ra**: Nhân viên chính thức có hồ sơ trên hệ thống và có tài khoản làm việc.
* **Mở khóa**: FLOW-050, FLOW-053.

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG (NAVIGATION)

[⬅️ **Luồng trước**: FLOW-048 - Yêu Cầu Rút Tiền & Quyết Toán Hoa Hồng (Payout Request & Settlement)](./FLOW-048-yeu-cau-rut-tien-quyet-toan-hoa-hong.md) | [📋 **Mục lục 58 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-050 - Phân Ca Làm Việc & Lập Lịch Trực (Work Shift Policies & Shift Assignment)](./FLOW-050-phan-ca-lam-viec-lap-lich-truc.md)
