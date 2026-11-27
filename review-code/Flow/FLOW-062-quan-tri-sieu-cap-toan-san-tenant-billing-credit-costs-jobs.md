# [FLOW-062] Quản trị Siêu cấp Toàn sàn (`Platform Admin`): Tenant, Billing, Credit Costs & Jobs

> **Tầng nghiệp vụ**: TẦNG 15: TÀI CHÍNH, MỤC TIÊU KINH DOANH & QUẢN TRỊ TOÀN SÀN  
> **Thứ tự thực thi**: 62 / 62  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Chỉ kích hoạt khi các điều kiện tiên quyết đã sẵn sàng.

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT ("CÓ A")
* FLOW-002 & FLOW-004 (Tài khoản sở hữu quyền `SUPER_ADMIN` toàn hệ thống).

## 2. TÁC NHÂN THAM GIA (ACTORS)
* Platform Super Admin (Quản trị viên hệ thống AiBeego)

## 3. THÀNH PHẦN HỆ THỐNG LIÊN QUAN (CODEBASE ARCHITECTURE)
* **UI Routes**: `/admin`, `/admin/organizations`, `/admin/users`, `/admin/users/[id]`, `/admin/subscriptions`, `/admin/billing`, `/admin/credits`, `/admin/credit-costs`, `/admin/usage`, `/admin/integrations`, `/admin/jobs`, `/admin/audit`.
* **API Endpoints**: `GET /admin/overview`, `GET/PATCH /admin/organizations*`, `GET/PATCH/POST /admin/users*` (`force-logout`, `soft-delete`, `gift-time`), `GET/POST /admin/subscriptions*` (`extend`, `upgrade-12m`), `GET/PATCH /admin/credit-costs*`, `GET /admin/usage|integrations/health|jobs/failed|audit-logs`, `POST /admin/jobs/:type/:id/retry`.
* **Controllers**: `platform-admin.controller.ts`, `credit-costs-admin.controller.ts`, `billing.controller.ts` (`/admin/billing/*`).

## 4. QUY TRÌNH THỰC HIỆN CHI TIẾT (STEP-BY-STEP)
1. Super Admin truy cập `/admin` giám sát sức khỏe toàn bộ nền tảng SaaS (`overview`, `usage`, `integrations/health`).
2. Quản lý các Tổ chức (`organizations`) và Người dùng (`users`): kích hoạt/khóa, cưỡng bức đăng xuất (`force-logout`), tặng thời gian sử dụng (`gift-time`), xóa mềm (`soft-delete`).
3. Quản lý Gói cước & Thanh toán toàn sàn: gia hạn (`extend`), nâng cấp gói 12 tháng (`upgrade-12m`), duyệt/xử lý lại giao dịch SePAY lỗi (`admin/billing/*`) và điều chỉnh bảng giá Credit AI (`admin/credit-costs`).
4. Giám sát và chạy lại các tác vụ nền bị lỗi (`GET /admin/jobs/failed` -> `POST /admin/jobs/:type/:id/retry`) và tra cứu nhật ký hệ thống (`admin/audit-logs`).

## 5. DỮ LIỆU ĐẦU VÀO & ĐẦU RA (INPUT / OUTPUT)
* **Đầu vào (Input)**: Lệnh quản trị cấp nền tảng từ Super Admin.
* **Đầu ra (Output)**: Toàn bộ hệ thống SaaS vận hành ổn định, an toàn và hỗ trợ khách hàng kịp thời.

## 6. KIỂM SOÁT NGOẠI LỆ, BẢO MẬT & TÍNH TOÀN VẸN
* Yêu cầu quyền `SUPER_ADMIN` nghiêm ngặt; mọi hành động can thiệp tenant đều lưu dấu vết trong `AuditLog`.

## 7. MỞ KHÓA LUỒNG TIẾP THEO ("MỚI CÓ B")
* **Kích hoạt / Mở khóa**: Vận hành & mở rộng toàn nền tảng AiBeego SaaS

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG

[⬅️ **Luồng trước**: FLOW-061](./FLOW-061-bao-cao-tong-quan-dieu-hanh-ai-report-nhat-ky-kiem-toan.md) | [📋 **Mục lục 62 Flows**](./README.md) | *Đây là luồng cuối cùng trong chuỗi nghiệp vụ*
