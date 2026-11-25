# [FLOW-002] Khởi tạo Database Schema & Seed Dữ liệu Gốc

> **Tầng nghiệp vụ**: TẦNG 0: HẠ TẦNG & KHỞI TẠO NỀN TẢNG (INFRASTRUCTURE & SYSTEM SEED)  
> **Thứ tự thực thi**: 2 / 58  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Hoàn thành điều kiện tiên quyết trước khi kích hoạt luồng này.

---

## NỘI DUNG CHI TIẾT LUỒNG NGHIỆP VỤ

* **Điều kiện tiên quyết**: FLOW-001 thành công (Database PostgreSQL đang lắng nghe kết nối).
* **Tác nhân**: Migration Runner / System Script.
* **Chi tiết luồng**:
  1. Chạy `prisma migrate deploy` áp dụng 238 bảng vào cơ sở dữ liệu.
  2. Kích hoạt seed script:
     - Khởi tạo danh mục quyền hạn hệ thống (`Permission`): `leads:*`, `sales:*`, `hrm:*`, `ads:*`, `settings:*`.
     - Tạo các vai trò chuẩn (`Role`): `SUPER_ADMIN`, `ORG_OWNER`, `MANAGER`, `STAFF`, `COLLABORATOR`.
     - Tạo các gói cước mặc định (`SubscriptionPlan`): Gói Dùng thử (Trial), Gói Cơ bản (Standard), Gói Nâng cao (Pro).
     - Thiết lập bảng giá Credit AI (`CreditFeaturePricing`) cho tính năng viết content, bóc băng video, RAG chatbot.
* **Đầu vào**: Prisma schema (`packages/database/prisma/schema.prisma`).
* **Đầu ra**: Database có đầy đủ bảng, quan hệ ràng buộc khóa ngoại, chỉ mục index và dữ liệu nền móng.
* **Mở khóa**: FLOW-003, FLOW-004.

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG (NAVIGATION)

[⬅️ **Luồng trước**: FLOW-001 - Khởi động Hạ tầng Docker & Kết nối Microservices](./FLOW-001-khoi-dong-ha-tang-docker-ket-noi-microservices.md) | [📋 **Mục lục 58 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-003 - Đăng ký Tài khoản Người dùng mới (User Registration)](./FLOW-003-dang-ky-tai-khoan-nguoi-dung-moi.md)
