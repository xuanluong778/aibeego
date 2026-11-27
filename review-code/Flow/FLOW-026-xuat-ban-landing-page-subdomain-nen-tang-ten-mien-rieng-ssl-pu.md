# [FLOW-026] Xuất bản Landing Page: Subdomain Nền tảng, Tên miền Riêng SSL & Public Cache

> **Tầng nghiệp vụ**: TẦNG 5: LANDING PAGE BUILDER, PHỄU & XUẤT BẢN  
> **Thứ tự thực thi**: 26 / 62  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Chỉ kích hoạt khi các điều kiện tiên quyết đã sẵn sàng.

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT ("CÓ A")
* FLOW-024 (Landing Page đã hoàn thiện thiết kế).

## 2. TÁC NHÂN THAM GIA (ACTORS)
* Người dùng / Nginx & Next.js Revalidation

## 3. THÀNH PHẦN HỆ THỐNG LIÊN QUAN (CODEBASE ARCHITECTURE)
* **UI Routes**: `/landing-pages/domain`, `/landing-pages/builder/[id]`, `/p/[slug]`, `/p/preview/[token]`.
* **API Endpoints**: `GET /landing-pages/:id/publication-options`, `GET /landing-pages/:id/subdomain-availability`, `POST /landing-pages/:id/publish|unpublish`, `POST /landing-pages/:id/domain|domain/verify`, `POST /landing-pages/:id/refresh-public-cache`, `POST /landing-pages/actions/retry-public-cache`, `GET /landing-pages/public/domains/resolve|allow-certificate`.
* **Models**: `LandingPage`, `LandingPageDomainConnection`, `LandingPagePlatformDomain`.

## 4. QUY TRÌNH THỰC HIỆN CHI TIẾT (STEP-BY-STEP)
1. Kiểm tra tùy chọn xuất bản (`GET :id/publication-options`) gồm 3 hình thức: (1) Đường dẫn mặc định `/p/:slug`, (2) **Subdomain nền tảng** (`slug.aibeego.com` kiểm tra khả dụng qua `subdomain-availability`), (3) **Tên miền riêng** (`custom domain`).
2. Nếu dùng tên miền riêng: thêm domain (`POST :id/domain`), trỏ DNS CNAME -> xác minh (`domain/verify`). Reverse proxy hỏi `GET /landing-pages/public/domains/allow-certificate` để tự động cấp SSL.
3. Có thể tạo link xem trước riêng tư (`POST :id/preview-token`) trước khi công khai.
4. Bấm **Xuất bản** (`POST :id/publish`): tạo phiên bản live và gọi `landing-page-public-cache.service.ts` làm mới bộ nhớ đệm Next.js (`/api/landing-pages/revalidate`). Nếu lỗi đồng bộ cache có nút `retry-public-cache`.

## 5. DỮ LIỆU ĐẦU VÀO & ĐẦU RA (INPUT / OUTPUT)
* **Đầu vào (Input)**: Lựa chọn slug / subdomain / custom domain, lệnh Publish.
* **Đầu ra (Output)**: Trang hoạt động công khai (HTTPS) trên đường dẫn/tên miền đã chọn.

## 6. KIỂM SOÁT NGOẠI LỆ, BẢO MẬT & TÍNH TOÀN VẸN
* Chống trùng slug/subdomain, verify quyền sở hữu DNS trước khi cấp SSL, tách cache scope theo domain.

## 7. MỞ KHÓA LUỒNG TIẾP THEO ("MỚI CÓ B")
* **Kích hoạt / Mở khóa**: FLOW-027, FLOW-041 (Lấy URL chạy quảng cáo)

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG

[⬅️ **Luồng trước**: FLOW-025](./FLOW-025-xay-dung-pheu-chuyen-doi-da-buoc-luat-cham-diem.md) | [📋 **Mục lục 62 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-027](./FLOW-027-khach-truy-cap-cong-khai-tuong-tac-chatbot-lp-gui-form-thu-lea.md)
