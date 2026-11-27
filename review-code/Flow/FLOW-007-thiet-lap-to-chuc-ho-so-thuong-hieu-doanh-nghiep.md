# [FLOW-007] Thiết lập Tổ chức & Hồ sơ Thương hiệu Doanh nghiệp

> **Tầng nghiệp vụ**: TẦNG 2: TỔ CHỨC, CHI NHÁNH, RBAC & GÓI CƯỚC / CREDIT  
> **Thứ tự thực thi**: 7 / 62  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Chỉ kích hoạt khi các điều kiện tiên quyết đã sẵn sàng.

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT ("CÓ A")
* FLOW-004 (Đã đăng nhập với quyền Quản trị tổ chức).

## 2. TÁC NHÂN THAM GIA (ACTORS)
* Chủ doanh nghiệp (Org Owner / Admin)

## 3. THÀNH PHẦN HỆ THỐNG LIÊN QUAN (CODEBASE ARCHITECTURE)
* **UI Routes**: `/settings`.
* **API Endpoints**: `GET/PATCH /api/v1/organizations/current`, `GET/PATCH /api/v1/landing-pages/business-profile`.
* **Models**: `Organization`, `BusinessProfile`, `OrganizationActivationEvent`.

## 4. QUY TRÌNH THỰC HIỆN CHI TIẾT (STEP-BY-STEP)
1. Truy cập `/settings`, cập nhật thông tin tổ chức (`Organization`: tên, hotline, email, địa chỉ, logo, múi giờ, tiền tệ).
2. Thiết lập Hồ sơ Doanh nghiệp (`BusinessProfile`): mô tả thương hiệu, tệp khách hàng mục tiêu, lợi thế cạnh tranh (USP), tông giọng thương hiệu, thông tin liên hệ.
3. Dữ liệu `BusinessProfile` được tái sử dụng làm ngữ cảnh chung cho AI Landing Page, AI Content Marketing, Marketing Autopilot và RAG Chatbot.

## 5. DỮ LIỆU ĐẦU VÀO & ĐẦU RA (INPUT / OUTPUT)
* **Đầu vào (Input)**: Thông tin tổ chức & hồ sơ doanh nghiệp (`BusinessProfile`).
* **Đầu ra (Output)**: Bản ghi `Organization` và `BusinessProfile` hoàn chỉnh.

## 6. KIỂM SOÁT NGOẠI LỆ, BẢO MẬT & TÍNH TOÀN VẸN
* Cách ly dữ liệu nghiêm ngặt theo `organizationId` (Multi-tenant isolation).

## 7. MỞ KHÓA LUỒNG TIẾP THEO ("MỚI CÓ B")
* **Kích hoạt / Mở khóa**: FLOW-008, FLOW-009, FLOW-010, FLOW-012, FLOW-013, FLOW-014, FLOW-015, FLOW-016

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG

[⬅️ **Luồng trước**: FLOW-006](./FLOW-006-quan-ly-ho-so-ca-nhan-ngon-ngu-ui-kiem-soat-phien-dang-nhap.md) | [📋 **Mục lục 62 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-008](./FLOW-008-quan-ly-chi-nhanh-co-so-kinh-doanh.md)
