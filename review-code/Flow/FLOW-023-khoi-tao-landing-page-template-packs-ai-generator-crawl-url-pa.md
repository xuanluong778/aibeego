# [FLOW-023] Khởi tạo Landing Page: Template Packs, AI Generator, Crawl URL & Page Doctor

> **Tầng nghiệp vụ**: TẦNG 5: LANDING PAGE BUILDER, PHỄU & XUẤT BẢN  
> **Thứ tự thực thi**: 23 / 62  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Chỉ kích hoạt khi các điều kiện tiên quyết đã sẵn sàng.

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT ("CÓ A")
* FLOW-007 (`BusinessProfile`), FLOW-010 (Gói cước), FLOW-011 (Credit AI nếu dùng AI).

## 2. TÁC NHÂN THAM GIA (ACTORS)
* Marketer / Admin / AI Generator

## 3. THÀNH PHẦN HỆ THỐNG LIÊN QUAN (CODEBASE ARCHITECTURE)
* **UI Routes**: `/landing-pages/create`, `/landing-pages/templates`, `/landing-pages/manage-templates`, `/landing-pages/pages`.
* **API Endpoints**: `GET/POST /landing-pages/templates*`, `POST /landing-pages/generate`, `POST /landing-pages/ai-suggest-brief`, `POST /landing-pages/crawl-url`, `POST /landing-pages/:id/apply-business-profile`, `POST /landing-pages/:id/ai-template-content`, `POST /landing-pages/:id/page-doctor`, `POST /landing-pages/:id/page-doctor/apply`.
* **Models**: `LandingPageTemplate`, `LandingPageTemplateVersion`, `LandingPage`, `LandingPageVersion`.

## 4. QUY TRÌNH THỰC HIỆN CHI TIẾT (STEP-BY-STEP)
1. Người dùng chọn tạo trang từ: (1) Kho mẫu `LandingPageTemplate` (hỗ trợ xuất/nhập gói mẫu `packs` & `packs/bulk`), (2) AI tạo tự động từ brief (`POST /landing-pages/generate`), hoặc (3) Cào nội dung tham khảo từ URL (`crawl-url` an toàn SSRF).
2. Áp dụng nhanh thông tin thương hiệu từ `BusinessProfile` (`apply-business-profile`) hoặc nhờ AI sinh nội dung từng block (`ai-template-content`, `ai-suggest-field`) kèm kiểm duyệt ảnh (`validate-images`, `import-url-image`).
3. Chạy công cụ khám bệnh trang **Page Doctor** (`POST /landing-pages/:id/page-doctor`) để chấm điểm UX/chuyển đổi/nội dung và bấm áp dụng đề xuất (`page-doctor/apply`).
4. Quản lý lịch sử phiên bản (`versions`, `versions/:version/restore`), nhân bản (`duplicate`) và lưu trữ (`archive`).

## 5. DỮ LIỆU ĐẦU VÀO & ĐẦU RA (INPUT / OUTPUT)
* **Đầu vào (Input)**: Brief chiến dịch, Template ID/Pack, hoặc URL nguồn.
* **Đầu ra (Output)**: Bản nháp `LandingPage` với cấu trúc blocks & nội dung hoàn chỉnh.

## 6. KIỂM SOÁT NGOẠI LỆ, BẢO MẬT & TÍNH TOÀN VẸN
* Kiểm soát quota số trang theo `Subscription`, SSRF check khi crawl URL/import ảnh ngoài.

## 7. MỞ KHÓA LUỒNG TIẾP THEO ("MỚI CÓ B")
* **Kích hoạt / Mở khóa**: FLOW-024 (Chỉnh sửa trực quan Canvas)

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG

[⬅️ **Luồng trước**: FLOW-022](./FLOW-022-kiem-ke-kho-doi-soat-sai-lech-ton-kho.md) | [📋 **Mục lục 62 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-024](./FLOW-024-chinh-sua-visual-builder-free-drag-frame-row-move-color-picker.md)
