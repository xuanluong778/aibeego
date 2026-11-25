# [FLOW-003] Đăng ký Tài khoản Người dùng mới (User Registration)

> **Tầng nghiệp vụ**: TẦNG 1: QUẢN TRỊ DANH TÍNH & XÁC THỰC (IAM - IDENTITY & AUTHENTICATION)  
> **Thứ tự thực thi**: 3 / 58  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Hoàn thành điều kiện tiên quyết trước khi kích hoạt luồng này.

---

## NỘI DUNG CHI TIẾT LUỒNG NGHIỆP VỤ

* **Điều kiện tiên quyết**: FLOW-002 thành công (Đã có bảng `User`, `Role`, `RegistrationOtp`).
* **Tác nhân**: Người dùng vãng lai / Chủ doanh nghiệp mới.
* **Chi tiết luồng**:
  1. Người dùng truy cập `/register` trên Web, điền Họ tên, Email, Mật khẩu, Số điện thoại.
  2. Web gửi request `POST /api/v1/auth/register`.
  3. API kiểm tra tính duy nhất của Email. Tạo mã xác thực `RegistrationOtp` (6 chữ số, hạn 10 phút).
  4. Worker gửi Email chứa mã OTP qua dịch vụ gửi mail.
  5. Người dùng nhập mã OTP tại màn hình xác minh `/verify-otp`.
  6. API kiểm tra mã OTP, hash mật khẩu bằng `bcryptjs` (salt 10 vòng), tạo bản ghi `User`.
  7. Tự động khởi tạo một `Organization` mặc định cho người dùng, gán người dùng làm `ORG_OWNER`.
* **Đầu vào**: `email`, `password`, `fullName`, `phone`, `otpCode`.
* **Đầu ra**: Bản ghi `User` mới (status = `ACTIVE`), bản ghi `Organization` mới.
* **Mở khóa**: FLOW-004.

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG (NAVIGATION)

[⬅️ **Luồng trước**: FLOW-002 - Khởi tạo Database Schema & Seed Dữ liệu Gốc](./FLOW-002-khoi-tao-database-schema-seed-du-lieu-goc.md) | [📋 **Mục lục 58 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-004 - Xác thực & Đăng nhập Hệ thống (Authentication & Login)](./FLOW-004-xac-thuc-dang-nhap-he-thong.md)
