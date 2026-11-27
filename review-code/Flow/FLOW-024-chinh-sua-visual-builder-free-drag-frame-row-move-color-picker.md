# [FLOW-024] Chỉnh sửa Visual Builder: Free-Drag Frame, Row Move, Color Picker & LP Chatbot

> **Tầng nghiệp vụ**: TẦNG 5: LANDING PAGE BUILDER, PHỄU & XUẤT BẢN  
> **Thứ tự thực thi**: 24 / 62  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Chỉ kích hoạt khi các điều kiện tiên quyết đã sẵn sàng.

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT ("CÓ A")
* FLOW-023 (Đã có bản nháp `LandingPage`).

## 2. TÁC NHÂN THAM GIA (ACTORS)
* Người thiết kế / Marketer

## 3. THÀNH PHẦN HỆ THỐNG LIÊN QUAN (CODEBASE ARCHITECTURE)
* **UI Routes**: `/landing-pages/builder/[id]`.
* **Frontend Components**: `landing-page-builder.tsx`, `landing-page-free-drag.tsx` (`resolveClippedPaintHost`), `landing-page-element-vertical-toolbar.tsx`, `landing-page-section-row-move.ts`, `landing-page-color-picker-popover.tsx`, `landing-page-fixed-header.tsx`, `landing-page-chatbot-inspector.tsx`, `landing-page-agency-portfolio-blocks.tsx`.
* **API Endpoints**: `POST /landing-pages/:id/autosave`, `POST /landing-pages/:id/recover-draft`, `POST /landing-pages/:id/upload-image`, `POST /landing-pages/:id/upload-background`, `GET /landing-pages/:id/media`.

## 4. QUY TRÌNH THỰC HIỆN CHI TIẾT (STEP-BY-STEP)
1. Người dùng mở trình dựng `/landing-pages/builder/[id]` chỉnh sửa trực quan Desktop/Mobile.
2. **Kéo thả phần tử & Khung ảnh**: Thanh công cụ dọc (`landing-page-element-vertical-toolbar.tsx`) hỗ trợ kéo tự do (free-drag) hoặc kéo đổi hàng/cột với preview trượt theo con trỏ (`beginSectionRowMove`). Đặc biệt khi kéo ảnh/box nằm trong khung bo góc/clip (`.photo-frame`, `.work-media`, `[data-lp-image-frame]`), `resolveClippedPaintHost` tự động di chuyển cả khung chứa thay vì chỉ dịch ảnh bên trong.
3. **Bộ chọn màu đồng nhất**: Dùng `LandingPageColorPickerPopover` (2 tab **Màu đơn** / **Màu tán sắc Gradient**, bảng Chủ đề & Màu gần đây, thanh kéo Hue, Opacity, thanh kéo Đậm/Nhạt hoặc 2 điểm dừng Gradient, ô Hex 8 ký tự và Eyedropper) cho Box, Section, Button, Text, Icon.
4. **Header điều hướng & Chatbot LP**: Tùy chỉnh menu header cố định (`landing-page-fixed-header.tsx`) và bật cấu hình **Chatbot AI nhúng trực tiếp trên Landing Page** (`landing-page-chatbot-inspector.tsx`, chọn bot/avatar robot, lời chào, thu thập lead).
5. Hệ thống tự động lưu nháp (`POST /landing-pages/:id/autosave`) và hỗ trợ khôi phục draft nếu mất kết nối (`recover-draft`).

## 5. DỮ LIỆU ĐẦU VÀO & ĐẦU RA (INPUT / OUTPUT)
* **Đầu vào (Input)**: Thao tác chỉnh sửa bố cục, màu sắc, ảnh, menu, form và cấu hình chatbot LP.
* **Đầu ra (Output)**: Spec JSON của `LandingPage` được cập nhật realtime và autosave an toàn.

## 6. KIỂM SOÁT NGOẠI LỆ, BẢO MẬT & TÍNH TOÀN VẸN
* Chống overlap ngoài khung (`landing-page-no-overlap`), khôi phục draft an toàn, upload media gắn với `plan-storage`.

## 7. MỞ KHÓA LUỒNG TIẾP THEO ("MỚI CÓ B")
* **Kích hoạt / Mở khóa**: FLOW-026 (Xuất bản trang)

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG

[⬅️ **Luồng trước**: FLOW-023](./FLOW-023-khoi-tao-landing-page-template-packs-ai-generator-crawl-url-pa.md) | [📋 **Mục lục 62 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-025](./FLOW-025-xay-dung-pheu-chuyen-doi-da-buoc-luat-cham-diem.md)
