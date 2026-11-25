# [FLOW-024] Xuất Bản Landing Page & Tối Ưu CDN Caching (Publishing)

> **Tầng nghiệp vụ**: TẦNG 5: THIẾT KẾ & XUẤT BẢN LANDING PAGE / PHỄU (LANDING PAGES & FUNNEL CONVERSION)  
> **Thứ tự thực thi**: 24 / 58  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Hoàn thành điều kiện tiên quyết trước khi kích hoạt luồng này.

---

## NỘI DUNG CHI TIẾT LUỒNG NGHIỆP VỤ

* **Điều kiện tiên quyết**: Landing Page đã hoàn thiện và gắn domain/subdomain (FLOW-023).
* **Tác nhân**: Người dùng.
* **Chi tiết luồng**:
  1. Người dùng bấm nút "XUẤT BẢN" (Publish).
  2. Hệ thống kiểm tra hợp lệ toàn bộ thành phần (Validation Check: Form có trường SĐT chưa, nút bấm CTA có gắn link chưa).
  3. Tạo bản snapshot `LandingPageVersion`, cập nhật trạng thái `isPublished = true`.
  4. Gửi tín hiệu On-demand Revalidation tới Next.js frontend để xóa cache cũ và render trang tĩnh (SSG/ISR) mới nhất lên Edge.
  5. Trang chính thức hoạt động công khai trên Internet với tốc độ tải trang cực nhanh (< 1 giây).
* **Đầu ra**: Trang web trực tuyến công khai tiếp nhận khách hàng truy cập.
* **Mở khóa**: FLOW-025, FLOW-039 (Dùng URL này chạy Ads).

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG (NAVIGATION)

[⬅️ **Luồng trước**: FLOW-023 - Gắn Tên Miền Riêng & Cài Đặt Tracking Pixels](./FLOW-023-gan-ten-mien-rieng-cai-dat-tracking-pixels.md) | [📋 **Mục lục 58 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-025 - Khách Truy Cập Landing Page & Điền Form Đăng Ký (Lead Capture)](./FLOW-025-khach-truy-cap-landing-page-dien-form-dang-ky.md)
