# [FLOW-021] Thiết kế Landing Page bằng Visual Builder & AI Generator

> **Tầng nghiệp vụ**: TẦNG 5: THIẾT KẾ & XUẤT BẢN LANDING PAGE / PHỄU (LANDING PAGES & FUNNEL CONVERSION)  
> **Thứ tự thực thi**: 21 / 58  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Hoàn thành điều kiện tiên quyết trước khi kích hoạt luồng này.

---

## NỘI DUNG CHI TIẾT LUỒNG NGHIỆP VỤ

* **Điều kiện tiên quyết**: Đã có Sản phẩm (FLOW-016) hoặc Dịch vụ (FLOW-017), và Tổ chức (FLOW-007).
* **Tác nhân**: Marketer / Thiết kế / Người dùng.
* **Chi tiết luồng**:
  1. Vào `/landing-pages`, chọn:
     - Cách 1: Chọn từ kho Template chuyên biệt ngành (Spa, Thẩm mỹ, Nha khoa, Khóa học, Bất động sản, E-commerce).
     - Cách 2: Sử dụng AI Page Generator: Nhập mô tả sản phẩm/dịch vụ -> AI tự động sinh cấu trúc trang, tiêu đề headline, nội dung copy, hình ảnh minh họa, bảng giá và form thu thập.
  2. Mở Visual Drag-and-drop Canvas:
     - Kéo thả các Section (Hero, Giới thiệu, Lợi ích, Đánh giá khách hàng, Bảng giá, Form đăng ký, FAQ, Chân trang).
     - Tùy chỉnh màu sắc bằng bộ chọn màu chuyên nghiệp: Tab Màu đơn (Solid), Tab Màu tán sắc (Gradient), Thanh kéo màu đậm nhạt, Chọn mã Hex, Hút màu Eyedropper.
     - Tùy chỉnh Font chữ, Hiệu ứng chuyển động (Motion effects), Tối ưu bố cục riêng cho Desktop và Mobile.
  3. Tích hợp Form đăng ký: Chọn các trường thu thập (Họ tên, SĐT, Email, Dịch vụ quan tâm, Ghi chú).
* **Đầu ra**: Bản ghi `LandingPage` và `LandingPageVersion` lưu trữ cấu trúc JSON của trang.
* **Mở khóa**: FLOW-022, FLOW-023.

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG (NAVIGATION)

[⬅️ **Luồng trước**: FLOW-020 - Quản trị Tồn kho Đa chi nhánh, Kiểm kê & Cân đối (Stocktake & Reconciliation)](./FLOW-020-quan-tri-ton-kho-da-chi-nhanh-kiem-ke-can-doi.md) | [📋 **Mục lục 58 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-022 - Thiết lập Phễu Chuyển Đổi Đa Bước (Multi-Step Funnel Pipeline)](./FLOW-022-thiet-lap-pheu-chuyen-doi-da-buoc.md)
