# [FLOW-005] Quên Mật khẩu, Xác minh Email & Đặt lại Mật khẩu

> **Tầng nghiệp vụ**: TẦNG 1: ĐỊNH DANH, XÁC THỰC & BẢO MẬT PHIÊN (IAM)  
> **Thứ tự thực thi**: 5 / 62  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Chỉ kích hoạt khi các điều kiện tiên quyết đã sẵn sàng.

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT ("CÓ A")
* FLOW-003 (Tài khoản `User` tồn tại trong hệ thống).

## 2. TÁC NHÂN THAM GIA (ACTORS)
* Người dùng bị mất mật khẩu / Chưa xác minh email

## 3. THÀNH PHẦN HỆ THỐNG LIÊN QUAN (CODEBASE ARCHITECTURE)
* **API Endpoints**: `POST /api/v1/auth/forgot-password`, `POST /api/v1/auth/reset-password`, `POST /api/v1/auth/verify-email`, `POST /api/v1/auth/resend-verification`.
* **Models**: `User`, `AuthToken`, `AuthSession`.

## 4. QUY TRÌNH THỰC HIỆN CHI TIẾT (STEP-BY-STEP)
1. Người dùng nhập email tại màn hình Quên mật khẩu -> `POST /auth/forgot-password`.
2. Hệ thống sinh `AuthToken` một lần có thời hạn ngắn, lưu hash token vào DB và gửi email chứa link khôi phục.
3. Người dùng mở link, nhập mật khẩu mới -> `POST /auth/reset-password`.
4. API kiểm tra token hợp lệ/chưa dùng, cập nhật mật khẩu hash mới, đánh dấu token đã dùng và vô hiệu hóa toàn bộ `AuthSession` cũ + xóa auth cache.
5. Tương tự, luồng `resend-verification` & `verify-email` cho phép xác minh lại email nếu chưa kích hoạt.

## 5. DỮ LIỆU ĐẦU VÀO & ĐẦU RA (INPUT / OUTPUT)
* **Đầu vào (Input)**: Email yêu cầu khôi phục; Token đặt lại + Mật khẩu mới.
* **Đầu ra (Output)**: Mật khẩu mới được lưu, các phiên đăng nhập cũ bị đăng xuất cưỡng bức.

## 6. KIỂM SOÁT NGOẠI LỆ, BẢO MẬT & TÍNH TOÀN VẸN
* Trả thông báo chung chung khi email không tồn tại (tránh dò email người dùng); token dùng 1 lần duy nhất.

## 7. MỞ KHÓA LUỒNG TIẾP THEO ("MỚI CÓ B")
* **Kích hoạt / Mở khóa**: FLOW-004

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG

[⬅️ **Luồng trước**: FLOW-004](./FLOW-004-dang-nhap-he-thong-google-oauth-co-che-refresh-token-rotation.md) | [📋 **Mục lục 62 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-006](./FLOW-006-quan-ly-ho-so-ca-nhan-ngon-ngu-ui-kiem-soat-phien-dang-nhap.md)
