# [FLOW-009] Phân quyền & Quản lý Vai trò Đội ngũ (RBAC - Roles & Permissions)

> **Tầng nghiệp vụ**: TẦNG 2: THIẾT LẬP TỔ CHỨC, GÓI CƯỚC & PHÂN QUYỀN (ORGANIZATION, SUBSCRIPTION & RBAC)  
> **Thứ tự thực thi**: 9 / 58  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Hoàn thành điều kiện tiên quyết trước khi kích hoạt luồng này.

---

## NỘI DUNG CHI TIẾT LUỒNG NGHIỆP VỤ

* **Điều kiện tiên quyết**: Đã có Tổ chức (FLOW-007).
* **Tác nhân**: Chủ doanh nghiệp / Quản trị viên cấp cao.
* **Chi tiết luồng**:
  1. Người dùng vào `/settings/roles`, hệ thống liệt kê các vai trò mẫu và cho phép tạo vai trò tùy biến (`Role`).
  2. Thiết lập ma trận quyền (`RolePermission`):
     - Ví dụ: Vai trò "Nhân viên Bán hàng" chỉ được xem/tạo Đơn hàng, không được xem Báo cáo doanh thu tổng và không được xóa sản phẩm.
     - Vai trò "Nhân viên CSKH" chỉ được thao tác trên Chatbot, Quản lý Lead, Đặt lịch hẹn.
  3. Gán Role cho các tài khoản thành viên trong tổ chức.
* **Đầu ra**: Ma trận quyền hạn RBAC chặt chẽ cho từng người dùng trong doanh nghiệp.
* **Mở khóa**: FLOW-027 (Phân bổ lead), FLOW-049 (Mời nhân viên).

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG (NAVIGATION)

[⬅️ **Luồng trước**: FLOW-008 - Cấu hình Chi nhánh & Cơ sở Vận hành (Branches Management)](./FLOW-008-cau-hinh-chi-nhanh-co-so-van-hanh.md) | [📋 **Mục lục 58 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-010 - Đăng ký Gói cước (Subscription & Trial Claim)](./FLOW-010-dang-ky-goi-cuoc.md)
