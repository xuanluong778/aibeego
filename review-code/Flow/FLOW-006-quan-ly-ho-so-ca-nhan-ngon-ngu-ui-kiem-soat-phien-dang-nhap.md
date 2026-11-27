# [FLOW-006] Quản lý Hồ sơ Cá nhân, Ngôn ngữ UI & Kiểm soát Phiên Đăng nhập

> **Tầng nghiệp vụ**: TẦNG 1: ĐỊNH DANH, XÁC THỰC & BẢO MẬT PHIÊN (IAM)  
> **Thứ tự thực thi**: 6 / 62  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Chỉ kích hoạt khi các điều kiện tiên quyết đã sẵn sàng.

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT ("CÓ A")
* FLOW-004 (Người dùng đã đăng nhập có `accessToken` hợp lệ).

## 2. TÁC NHÂN THAM GIA (ACTORS)
* Người dùng đã đăng nhập

## 3. THÀNH PHẦN HỆ THỐNG LIÊN QUAN (CODEBASE ARCHITECTURE)
* **API Endpoints**: `GET /api/v1/auth/me`, `PATCH /api/v1/auth/locale`, `POST /api/v1/auth/change-password`, `POST /api/v1/auth/logout`, `POST /api/v1/auth/logout-all`.
* **Models**: `User`, `AuthSession`.

## 4. QUY TRÌNH THỰC HIỆN CHI TIẾT (STEP-BY-STEP)
1. Khi tải app, Frontend gọi `GET /auth/me` lấy thông tin hồ sơ, vai trò, danh sách quyền và `uiLocale` (`vi` / `en`).
2. Người dùng đổi ngôn ngữ giao diện (`PATCH /auth/locale`) -> cập nhật `user.uiLocale` và xóa auth cache.
3. Đổi mật khẩu chủ động (`POST /auth/change-password`): xác thực mật khẩu cũ trước khi cập nhật mật khẩu mới.
4. Đăng xuất phiên hiện tại (`POST /auth/logout`) hoặc thu hồi mọi phiên trên mọi thiết bị (`POST /auth/logout-all`).

## 5. DỮ LIỆU ĐẦU VÀO & ĐẦU RA (INPUT / OUTPUT)
* **Đầu vào (Input)**: Cài đặt `locale`, mật khẩu hiện tại/mới, yêu cầu thu hồi session.
* **Đầu ra (Output)**: Hồ sơ và trạng thái bảo mật phiên được đồng bộ tức thì.

## 6. KIỂM SOÁT NGOẠI LỆ, BẢO MẬT & TÍNH TOÀN VẸN
* Invalidating Redis auth cache ngay khi đổi mật khẩu, đổi locale hoặc logout-all.

## 7. MỞ KHÓA LUỒNG TIẾP THEO ("MỚI CÓ B")
* **Kích hoạt / Mở khóa**: Trải nghiệm cá nhân hóa đa ngôn ngữ trên toàn hệ thống

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG

[⬅️ **Luồng trước**: FLOW-005](./FLOW-005-quen-mat-khau-xac-minh-email-dat-lai-mat-khau.md) | [📋 **Mục lục 62 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-007](./FLOW-007-thiet-lap-to-chuc-ho-so-thuong-hieu-doanh-nghiep.md)
