# [FLOW-004] Xác thực & Đăng nhập Hệ thống (Authentication & Login)

> **Tầng nghiệp vụ**: TẦNG 1: QUẢN TRỊ DANH TÍNH & XÁC THỰC (IAM - IDENTITY & AUTHENTICATION)  
> **Thứ tự thực thi**: 4 / 58  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Hoàn thành điều kiện tiên quyết trước khi kích hoạt luồng này.

---

## NỘI DUNG CHI TIẾT LUỒNG NGHIỆP VỤ

* **Điều kiện tiên quyết**: FLOW-003 thành công (Người dùng đã có tài khoản trong hệ thống).
* **Tác nhân**: Người dùng đã đăng ký / Quản trị viên.
* **Chi tiết luồng**:
  1. Người dùng truy cập `/login`, nhập Email và Mật khẩu (hoặc bấm Đăng nhập qua Google OAuth).
  2. Request `POST /api/v1/auth/login` được gửi tới `AuthController`.
  3. Hệ thống kiểm tra Rate Limit và chống Brute Force (`LoginAttempt` log lại IP, user-agent).
  4. Hệ thống so khớp mật khẩu `bcrypt.compare`.
  5. Nếu chính xác:
     - Tạo bản ghi `AuthSession`.
     - Sinh cặp token: `accessToken` (JWT ngắn hạn 15-60 phút) và `refreshToken` (JWT dài hạn 7-30 ngày).
     - Thiết lập cookie `refreshToken` với cờ `HttpOnly`, `SameSite=Lax`, `Secure`.
     - Trả về payload chứa thông tin User, danh sách Organization được truy cập và quyền hạn (Permissions).
* **Đầu vào**: `email`, `password`.
* **Đầu ra**: `accessToken`, HttpOnly cookie `refreshToken`, thông tin User & Organization ngữ cảnh hiện tại.
* **Mở khóa**: Toàn bộ các flow quản trị từ Tầng 2 trở lên.

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG (NAVIGATION)

[⬅️ **Luồng trước**: FLOW-003 - Đăng ký Tài khoản Người dùng mới (User Registration)](./FLOW-003-dang-ky-tai-khoan-nguoi-dung-moi.md) | [📋 **Mục lục 58 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-005 - Quên mật khẩu & Khôi phục Tài khoản (Password Reset)](./FLOW-005-quen-mat-khau-khoi-phuc-tai-khoan.md)
