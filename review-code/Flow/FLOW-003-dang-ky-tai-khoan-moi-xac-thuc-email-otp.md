# [FLOW-003] Đăng ký Tài khoản Mới & Xác thực Email OTP

> **Tầng nghiệp vụ**: TẦNG 1: ĐỊNH DANH, XÁC THỰC & BẢO MẬT PHIÊN (IAM)  
> **Thứ tự thực thi**: 3 / 62  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Chỉ kích hoạt khi các điều kiện tiên quyết đã sẵn sàng.

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT ("CÓ A")
* FLOW-002 (Đã có bảng `User`, `RegistrationOtp`, `Role`, `Organization`).

## 2. TÁC NHÂN THAM GIA (ACTORS)
* Người dùng vãng lai / Chủ doanh nghiệp mới

## 3. THÀNH PHẦN HỆ THỐNG LIÊN QUAN (CODEBASE ARCHITECTURE)
* **UI Routes**: `/register` (`apps/web/src/app/(auth)/register`).
* **API Endpoints**: `POST /api/v1/auth/register/send-otp`, `POST /api/v1/auth/register/resend-otp`, `POST /api/v1/auth/register/verify-otp`, `POST /api/v1/auth/register` (`auth.controller.ts`).
* **Models**: `User`, `RegistrationOtp`, `Organization`, `AuthSession`, `CreditWallet`.

## 4. QUY TRÌNH THỰC HIỆN CHI TIẾT (STEP-BY-STEP)
1. Người dùng nhập email trên `/register`, gọi `POST /auth/register/send-otp` để nhận mã OTP 6 chữ số (lưu hash/hạn dùng trong `RegistrationOtp`).
2. Hệ thống kiểm tra chống spam gửi lại OTP (`resend-otp` cooldown) và gửi email qua `auth-mail.service.ts` (ẩn dữ liệu nhạy cảm qua `auth-mail.redact.ts`).
3. Người dùng nhập mã OTP -> gọi `POST /auth/register/verify-otp` xác nhận email hợp lệ.
4. Người dùng hoàn tất biểu mẫu (`POST /auth/register` với `email`, `password`, `name`, `phone`, tên tổ chức).
5. Backend hash mật khẩu bằng `bcryptjs`, khởi tạo `Organization` mặc định, `User` gắn role chủ tổ chức, ví `CreditWallet` ban đầu và cấp phiên đăng nhập đầu tiên.

## 5. DỮ LIỆU ĐẦU VÀO & ĐẦU RA (INPUT / OUTPUT)
* **Đầu vào (Input)**: Email, mã OTP, mật khẩu, họ tên, thông tin doanh nghiệp ban đầu.
* **Đầu ra (Output)**: Bản ghi `User` đã xác thực email, `Organization` mới, cặp token đăng nhập.

## 6. KIỂM SOÁT NGOẠI LỆ, BẢO MẬT & TÍNH TOÀN VẸN
* Kiểm tra trùng email, giới hạn số lần nhập sai OTP, OTP hết hạn tự vô hiệu, dùng thử KHÔNG tự tính từ lúc đăng ký (chờ bấm kích hoạt ở FLOW-010).

## 7. MỞ KHÓA LUỒNG TIẾP THEO ("MỚI CÓ B")
* **Kích hoạt / Mở khóa**: FLOW-004, FLOW-007

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG

[⬅️ **Luồng trước**: FLOW-002](./FLOW-002-migration-database-schema-seed-du-lieu-he-thong-goc.md) | [📋 **Mục lục 62 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-004](./FLOW-004-dang-nhap-he-thong-google-oauth-co-che-refresh-token-rotation.md)
