# [FLOW-025] Xây dựng Phễu Chuyển đổi Đa bước & Luật Chấm điểm (Funnel Builder)

> **Tầng nghiệp vụ**: TẦNG 5: LANDING PAGE BUILDER, PHỄU & XUẤT BẢN  
> **Thứ tự thực thi**: 25 / 62  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Chỉ kích hoạt khi các điều kiện tiên quyết đã sẵn sàng.

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT ("CÓ A")
* FLOW-007 & FLOW-010 (Tổ chức & gói cước) hoặc FLOW-023 (Landing Page).

## 2. TÁC NHÂN THAM GIA (ACTORS)
* Growth Marketer / Chiến lược gia phễu

## 3. THÀNH PHẦN HỆ THỐNG LIÊN QUAN (CODEBASE ARCHITECTURE)
* **UI Routes**: `/funnel`, `/funnel/preview/[id]`.
* **API Endpoints**: `POST /funnel-builder/generate-recommendations`, `POST /funnel-builder/recommendations/:id/select|generate-complete|validate|consultant/propose|prepare-publish|publish`, `GET/PATCH /funnel-builder/recommendations/:id/scoring`, `GET/POST /funnel-builder/templates*`, `GET /funnel-builder/blueprints*`.
* **Models**: `FunnelRecommendation`, `FunnelBlueprint`, `FunnelTemplate`, `FunnelVersion`, `FunnelScoringConfig`, `FunnelScoringRule`, `FunnelRuntimeLog`.

## 4. QUY TRÌNH THỰC HIỆN CHI TIẾT (STEP-BY-STEP)
1. AI đề xuất cấu trúc phễu phù hợp mục tiêu (`generate-recommendations`) -> Người dùng chọn phương án (`select`) và sinh bản thảo hoàn chỉnh (`generate-complete`).
2. Chạy kiểm tra tính hợp lệ phễu (`validate`), nhận tư vấn tối ưu từ AI Consultant (`consultant/propose` -> `apply`), và gắn chatbot vào phễu (`bind-chatbot`).
3. Thiết lập cấu hình chấm điểm tiềm năng (`FunnelScoringConfig`, `FunnelScoringRule`) cho hành vi khách trong phễu.
4. Chuẩn bị & xuất bản phễu (`prepare-publish` -> `publish`), lưu snapshot `FunnelVersion` để phục vụ `/f/...` công khai.

## 5. DỮ LIỆU ĐẦU VÀO & ĐẦU RA (INPUT / OUTPUT)
* **Đầu vào (Input)**: Mục tiêu kinh doanh, lựa chọn blueprint/template, quy tắc chấm điểm.
* **Đầu ra (Output)**: Phễu chuyển đổi hoàn chỉnh kèm công thức chấm điểm Lead.

## 6. KIỂM SOÁT NGOẠI LỆ, BẢO MẬT & TÍNH TOÀN VẸN
* Kiểm tra quota phễu (`GET /funnel-builder/quota`), bắt buộc pass `validate` trước khi publish.

## 7. MỞ KHÓA LUỒNG TIẾP THEO ("MỚI CÓ B")
* **Kích hoạt / Mở khóa**: FLOW-027 (Khách tương tác phễu công khai), FLOW-045 (Gắn Automation Workflow)

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG

[⬅️ **Luồng trước**: FLOW-024](./FLOW-024-chinh-sua-visual-builder-free-drag-frame-row-move-color-picker.md) | [📋 **Mục lục 62 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-026](./FLOW-026-xuat-ban-landing-page-subdomain-nen-tang-ten-mien-rieng-ssl-pu.md)
