# [FLOW-005] Quên mật khẩu & Khôi phục Tài khoản (Password Reset)

> **Tầng nghiệp vụ**: TẦNG 1: QUẢN TRỊ DANH TÍNH & XÁC THỰC (IAM - IDENTITY & AUTHENTICATION)  
> **Thứ tự thực thi**: 5 / 58  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Hoàn thành điều kiện tiên quyết trước khi kích hoạt luồng này.

---

## NỘI DUNG CHI TIẾT LUỒNG NGHIỆP VỤ

* **Điều kiện tiên quyết**: Người dùng đã có tài khoản (FLOW-003) nhưng quên mật khẩu.
* **Tác nhân**: Người dùng.
* **Chi tiết luồng**:
  1. Người dùng truy cập `/forgot-password`, nhập Email.
  2. API kiểm tra Email, sinh `AuthToken` ngẫu nhiên có độ entropy cao (hạn 30 phút).
  3. Worker gửi email chứa liên kết khôi phục an toàn: `https://aibeego.com/reset-password?token=XYZ`.
  4. Người dùng bấm liên kết, nhập mật khẩu mới.
  5. API xác thực token, hash mật khẩu mới, cập nhật vào bảng `User`, đồng thời vô hiệu hóa toàn bộ `AuthSession` cũ để bảo vệ tài khoản khỏi truy cập trái phép.
* **Đầu ra**: Mật khẩu mới được cập nhật, yêu cầu đăng nhập lại (FLOW-004).

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG (NAVIGATION)

[⬅️ **Luồng trước**: FLOW-004 - Xác thực & Đăng nhập Hệ thống (Authentication & Login)](./FLOW-004-xac-thuc-dang-nhap-he-thong.md) | [📋 **Mục lục 58 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-006 - Quản lý Hồ sơ & Phiên Đăng nhập (User Profile & Active Sessions)](./FLOW-006-quan-ly-ho-so-phien-dang-nhap.md)
