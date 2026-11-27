# [FLOW-051] Đăng ký Đối tác Affiliate, Cấu hình Hoa hồng & Cấp Link Giới thiệu

> **Tầng nghiệp vụ**: TẦNG 13: TIẾP THỊ LIÊN KẾT (AFFILIATE MARKETING)  
> **Thứ tự thực thi**: 51 / 62  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Chỉ kích hoạt khi các điều kiện tiên quyết đã sẵn sàng.

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT ("CÓ A")
* FLOW-004 (Đã đăng nhập) & FLOW-007 (Tổ chức có chính sách Affiliate).

## 2. TÁC NHÂN THAM GIA (ACTORS)
* Đối tác/CTV Affiliate + Admin quản trị Affiliate

## 3. THÀNH PHẦN HỆ THỐNG LIÊN QUAN (CODEBASE ARCHITECTURE)
* **UI Routes**: `/affiliate`, `/admin/affiliate`.
* **API Endpoints**: `GET /affiliate/me`, `GET/PATCH /admin/affiliate/settings`, `GET /admin/affiliate/partners`, `PATCH /admin/affiliate/partners/:id/status|rate`.
* **Models**: `AffiliateProfile`, `AffiliateSetting`, `AffiliateAuditLog`.

## 4. QUY TRÌNH THỰC HIỆN CHI TIẾT (STEP-BY-STEP)
1. Admin cấu hình tỷ lệ hoa hồng mặc định, thời gian lưu cookie và ngưỡng rút tối thiểu (`GET/PATCH /admin/affiliate/settings`).
2. Người dùng truy cập `/affiliate` (`GET /affiliate/me`) để lấy hồ sơ đối tác và mã/link giới thiệu cá nhân.
3. Admin quản lý danh sách đối tác (`admin/affiliate/partners`): kích hoạt/tạm khóa (`status`) hoặc thiết lập mức chiết khấu riêng cho KOL/đối tác lớn (`rate`).

## 5. DỮ LIỆU ĐẦU VÀO & ĐẦU RA (INPUT / OUTPUT)
* **Đầu vào (Input)**: Thông tin hồ sơ đối tác, cấu hình tỷ lệ hoa hồng.
* **Đầu ra (Output)**: `AffiliateProfile` trạng thái hoạt động kèm mã giới thiệu độc quyền.

## 6. KIỂM SOÁT NGOẠI LỆ, BẢO MẬT & TÍNH TOÀN VẸN
* Ghi nhật ký mọi thay đổi tỷ lệ/trạng thái vào `AffiliateAuditLog`.

## 7. MỞ KHÓA LUỒNG TIẾP THEO ("MỚI CÓ B")
* **Kích hoạt / Mở khóa**: FLOW-052

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG

[⬅️ **Luồng trước**: FLOW-050](./FLOW-050-tro-ly-dieu-hanh-ai-noi-bo-voi-tool-calling-xac-nhan-hanh-dong.md) | [📋 **Mục lục 62 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-052](./FLOW-052-theo-doi-click-referral-tinh-hoa-hong-kiem-duyet-gian-lan.md)
