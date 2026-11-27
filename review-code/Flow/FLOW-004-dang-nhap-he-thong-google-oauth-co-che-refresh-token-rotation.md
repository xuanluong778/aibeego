# [FLOW-004] Đăng nhập Hệ thống, Google OAuth & Cơ chế Refresh Token Rotation

> **Tầng nghiệp vụ**: TẦNG 1: ĐỊNH DANH, XÁC THỰC & BẢO MẬT PHIÊN (IAM)  
> **Thứ tự thực thi**: 4 / 62  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Chỉ kích hoạt khi các điều kiện tiên quyết đã sẵn sàng.

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT ("CÓ A")
* FLOW-003 (Đã có tài khoản `User` hợp lệ).

## 2. TÁC NHÂN THAM GIA (ACTORS)
* Người dùng / Quản trị viên / Nhân viên

## 3. THÀNH PHẦN HỆ THỐNG LIÊN QUAN (CODEBASE ARCHITECTURE)
* **UI Routes**: `/login` (`apps/web/src/app/(auth)/login`).
* **API Endpoints**: `POST /api/v1/auth/login`, `POST /api/v1/auth/google`, `POST /api/v1/auth/refresh`.
* **Models**: `User`, `AuthSession` (kèm `rotation_root_id`), `LoginAttempt`.

## 4. QUY TRÌNH THỰC HIỆN CHI TIẾT (STEP-BY-STEP)
1. Người dùng đăng nhập qua Email/Mật khẩu (`POST /auth/login`) hoặc nút Google Sign-In (`POST /auth/google` xác thực ID Token qua `google-auth-library`).
2. Hệ thống ghi nhận IP (`client-ip.decorator.ts`), kiểm tra bảng `LoginAttempt` chống tấn công Brute-Force.
3. Xác thực mật khẩu `bcrypt.compare` và kiểm tra trạng thái `User`/`Organization` không bị khóa.
4. `AuthService.issueTokens()` tạo `accessToken` (JWT 15m) và `refreshToken` (JWT 7d), lưu `AuthSession` kèm `rotation_root_id` bằng `$executeRaw` để theo dõi chuỗi xoay vòng token.
5. Trả `accessToken` + thiết lập HttpOnly Cookie `refreshToken`. Khi `accessToken` hết hạn, Frontend gọi `POST /auth/refresh` để đổi cặp token mới cùng `rotationRootId`.

## 5. DỮ LIỆU ĐẦU VÀO & ĐẦU RA (INPUT / OUTPUT)
* **Đầu vào (Input)**: Email + Password hoặc Google OAuth Token.
* **Đầu ra (Output)**: `accessToken`, HttpOnly `refreshToken`, context `user` + `organizationId` + `permissions`.

## 6. KIỂM SOÁT NGOẠI LỆ, BẢO MẬT & TÍNH TOÀN VẸN
* Phát hiện tái sử dụng refresh token cũ (token reuse detection) -> thu hồi toàn bộ chuỗi phiên có cùng `rotation_root_id`.

## 7. MỞ KHÓA LUỒNG TIẾP THEO ("MỚI CÓ B")
* **Kích hoạt / Mở khóa**: Toàn bộ phân hệ nghiệp vụ từ Tầng 2 đến Tầng 15

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG

[⬅️ **Luồng trước**: FLOW-003](./FLOW-003-dang-ky-tai-khoan-moi-xac-thuc-email-otp.md) | [📋 **Mục lục 62 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-005](./FLOW-005-quen-mat-khau-xac-minh-email-dat-lai-mat-khau.md)
