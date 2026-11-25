# [FLOW-007] Khởi tạo & Cấu hình Tổ chức / Doanh nghiệp (Organization Setup)

> **Tầng nghiệp vụ**: TẦNG 2: THIẾT LẬP TỔ CHỨC, GÓI CƯỚC & PHÂN QUYỀN (ORGANIZATION, SUBSCRIPTION & RBAC)  
> **Thứ tự thực thi**: 7 / 58  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Hoàn thành điều kiện tiên quyết trước khi kích hoạt luồng này.

---

## NỘI DUNG CHI TIẾT LUỒNG NGHIỆP VỤ

* **Điều kiện tiên quyết**: Người dùng đã đăng nhập thành công (FLOW-004).
* **Tác nhân**: Chủ doanh nghiệp (Org Owner) / Quản trị viên.
* **Chi tiết luồng**:
  1. Người dùng truy cập `/settings`, thiết lập hồ sơ tổ chức (`BusinessProfile`):
     - Tên công ty, Thương hiệu, Lĩnh vực hoạt động (Spa, Thẩm mỹ, Giáo dục, Bán lẻ, v.v.).
     - Logo, Favicon, Màu sắc thương hiệu chủ đạo.
     - Mã số thuế, Địa chỉ trụ sở, Email CSKH, Hotline liên hệ.
  2. Cấu hình tiền tệ mặc định (VND, USD), định dạng ngày tháng, múi giờ (`Asia/Ho_Chi_Minh`).
* **Đầu vào**: Thông tin pháp nhân và nhận diện thương hiệu.
* **Đầu ra**: Cập nhật bản ghi `Organization` và `BusinessProfile`.
* **Mở khóa**: FLOW-008, FLOW-009, FLOW-010, FLOW-012 -> FLOW-015.

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG (NAVIGATION)

[⬅️ **Luồng trước**: FLOW-006 - Quản lý Hồ sơ & Phiên Đăng nhập (User Profile & Active Sessions)](./FLOW-006-quan-ly-ho-so-phien-dang-nhap.md) | [📋 **Mục lục 58 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-008 - Cấu hình Chi nhánh & Cơ sở Vận hành (Branches Management)](./FLOW-008-cau-hinh-chi-nhanh-co-so-van-hanh.md)
