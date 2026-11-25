# [FLOW-006] Quản lý Hồ sơ & Phiên Đăng nhập (User Profile & Active Sessions)

> **Tầng nghiệp vụ**: TẦNG 1: QUẢN TRỊ DANH TÍNH & XÁC THỰC (IAM - IDENTITY & AUTHENTICATION)  
> **Thứ tự thực thi**: 6 / 58  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Hoàn thành điều kiện tiên quyết trước khi kích hoạt luồng này.

---

## NỘI DUNG CHI TIẾT LUỒNG NGHIỆP VỤ

* **Điều kiện tiên quyết**: Người dùng đã đăng nhập (FLOW-004).
* **Tác nhân**: Người dùng.
* **Chi tiết luồng**:
  1. Xem và sửa thông tin cá nhân: Ảnh đại diện (Avatar), Số điện thoại, Đổi mật khẩu.
  2. Xem danh sách các thiết bị / phiên làm việc đang hoạt động (`AuthSession`).
  3. Đăng xuất khỏi thiết bị cụ thể hoặc đăng xuất khỏi toàn bộ các thiết bị khác.
* **Đầu ra**: Trạng thái bảo mật tài khoản luôn được kiểm soát.

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG (NAVIGATION)

[⬅️ **Luồng trước**: FLOW-005 - Quên mật khẩu & Khôi phục Tài khoản (Password Reset)](./FLOW-005-quen-mat-khau-khoi-phuc-tai-khoan.md) | [📋 **Mục lục 58 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-007 - Khởi tạo & Cấu hình Tổ chức / Doanh nghiệp (Organization Setup)](./FLOW-007-khoi-tao-cau-hinh-to-chuc-doanh-nghiep.md)
