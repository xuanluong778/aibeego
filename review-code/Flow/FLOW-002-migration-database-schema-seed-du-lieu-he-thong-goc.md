# [FLOW-002] Migration Database Schema & Seed Dữ liệu Hệ thống Gốc

> **Tầng nghiệp vụ**: TẦNG 0: HẠ TẦNG & KHỞI TẠO NỀN TẢNG (INFRASTRUCTURE & SYSTEM SEED)  
> **Thứ tự thực thi**: 2 / 62  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Chỉ kích hoạt khi các điều kiện tiên quyết đã sẵn sàng.

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT ("CÓ A")
* FLOW-001 (PostgreSQL đang hoạt động).

## 2. TÁC NHÂN THAM GIA (ACTORS)
* Prisma CLI / Database Seed Script

## 3. THÀNH PHẦN HỆ THỐNG LIÊN QUAN (CODEBASE ARCHITECTURE)
* **Schema**: `packages/database/prisma/schema.prisma` (~238 models).
* **Core Seed Tables**: `Permission`, `Role`, `RolePermission`, `SubscriptionPlan`, `CreditFeaturePricing`, `TrialSetting`, `LandingPagePlatformDomain`.

## 4. QUY TRÌNH THỰC HIỆN CHI TIẾT (STEP-BY-STEP)
1. Chạy `prisma migrate deploy` áp dụng toàn bộ migrations (bao gồm các migration mới như `work_checklist_item_assignee_dates`) vào PostgreSQL.
2. Seed danh mục quyền chuẩn (`Permission`) phân nhóm theo module (`leads`, `sales`, `hrm`, `finance`, `landing_pages`, `ads`, `admin`...).
3. Seed các vai trò gốc (`Role`: `SUPER_ADMIN`, `ADMIN`/`ORG_OWNER`, `MANAGER`, `STAFF`, `USER`) và ánh xạ `RolePermission`.
4. Seed gói cước (`SubscriptionPlan`), cấu hình dùng thử (`TrialSetting`), bảng giá tiêu hao AI (`CreditFeaturePricing`), và cấu hình domain/subdomain nền tảng.

## 5. DỮ LIỆU ĐẦU VÀO & ĐẦU RA (INPUT / OUTPUT)
* **Đầu vào (Input)**: Prisma schema & migration files trong `packages/database/prisma/`.
* **Đầu ra (Output)**: CSDL đầy đủ bảng, quan hệ khóa ngoại, chỉ mục và dữ liệu hạt giống sẵn sàng phục vụ.

## 6. KIỂM SOÁT NGOẠI LỆ, BẢO MẬT & TÍNH TOÀN VẸN
* Seed chạy idempotent (`upsert`), không ghi đè dữ liệu vận hành đang có.

## 7. MỞ KHÓA LUỒNG TIẾP THEO ("MỚI CÓ B")
* **Kích hoạt / Mở khóa**: FLOW-003, FLOW-004

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG

[⬅️ **Luồng trước**: FLOW-001](./FLOW-001-khoi-dong-ha-tang-docker-cau-hinh-moi-truong-microservices.md) | [📋 **Mục lục 62 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-003](./FLOW-003-dang-ky-tai-khoan-moi-xac-thuc-email-otp.md)
