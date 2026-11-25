# [FLOW-022] Thiết lập Phễu Chuyển Đổi Đa Bước (Multi-Step Funnel Pipeline)

> **Tầng nghiệp vụ**: TẦNG 5: THIẾT KẾ & XUẤT BẢN LANDING PAGE / PHỄU (LANDING PAGES & FUNNEL CONVERSION)  
> **Thứ tự thực thi**: 22 / 58  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Hoàn thành điều kiện tiên quyết trước khi kích hoạt luồng này.

---

## NỘI DUNG CHI TIẾT LUỒNG NGHIỆP VỤ

* **Điều kiện tiên quyết**: Đã tạo các trang Landing Page thành phần (FLOW-021).
* **Tác nhân**: Growth Marketer / Chiến lược gia phễu.
* **Chi tiết luồng**:
  1. Vào `/funnel`, bấm "Tạo Phễu mới" (`FunnelPipeline`).
  2. Lắp ráp các bước trong hành trình khách hàng:
     - Bước 1: Trang giới thiệu / Nam châm thu hút (Opt-in Lead Magnet).
     - Bước 2: Trang Bán hàng chính (Main Sales Page).
     - Bước 3: Trang Bán thêm / Nâng cấp (Upsell / Order Bump).
     - Bước 4: Trang Cảm ơn / Hướng dẫn thanh toán (Thank You Page).
  3. Cấu hình điều kiện rẽ nhánh (Funnel Logic): Nếu khách mua Upsell thì chuyển sang Bước 3B, nếu từ chối (Downsell) thì chuyển sang Bước 3C.
* **Đầu ra**: Bản thiết kế phễu chuyển đổi thông minh đa giai đoạn.
* **Mở khóa**: FLOW-023, FLOW-025.

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG (NAVIGATION)

[⬅️ **Luồng trước**: FLOW-021 - Thiết kế Landing Page bằng Visual Builder & AI Generator](./FLOW-021-thiet-ke-landing-page-bang-visual-builder-ai-generator.md) | [📋 **Mục lục 58 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-023 - Gắn Tên Miền Riêng & Cài Đặt Tracking Pixels](./FLOW-023-gan-ten-mien-rieng-cai-dat-tracking-pixels.md)
