# [FLOW-026] Tiếp Nhận Lead, Khử Trùng Lặp & Hợp Nhất Khách Hàng (Lead Ingestion & Deduplication)

> **Tầng nghiệp vụ**: TẦNG 6: QUẢN LÝ QUAN HỆ KHÁCH HÀNG & PHÂN LOẠI LEAD (CRM & LEAD NURTURING)  
> **Thứ tự thực thi**: 26 / 58  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Hoàn thành điều kiện tiên quyết trước khi kích hoạt luồng này.

---

## NỘI DUNG CHI TIẾT LUỒNG NGHIỆP VỤ

* **Điều kiện tiên quyết**: Có Lead gửi về từ Landing Page (FLOW-025) hoặc Chatbot (FLOW-045) hoặc Meta Lead Ads (FLOW-012).
* **Tác nhân**: Hệ thống CRM / Ingestion Pipeline.
* **Chi tiết luồng**:
  1. API nhận payload Lead mới, đưa vào BullMQ Queue để xử lý bất đồng bộ, chống nghẽn khi có hàng ngàn lượt đăng ký cùng lúc.
  2. Thuật toán khử trùng lặp (Deduplication Check):
     - Tìm kiếm trong bảng `Customer` theo Số điện thoại (chuẩn hóa về định dạng quốc tế `+84` hoặc `0x`) hoặc Email.
  3. Trường hợp 1: Nếu Khách hàng **ĐÃ TỒN TẠI**:
     - Không tạo Customer mới để tránh rác dữ liệu.
     - Cập nhật thông tin mới nhất vào bản ghi Customer hiện có.
     - Tạo một bản ghi `Lead` mới gắn với Customer này, ghi nhận nguồn đổ về (LeadSource) và hành vi mới vào nhật ký hoạt động `LeadActivity`.
  4. Trường hợp 2: Nếu là Khách hàng **MỚI HOÀN TOÀN**:
     - Tạo bản ghi `Customer` mới.
     - Tạo bản ghi `Lead` mới với trạng thái `NEW`.
     - Gắn toàn bộ thông tin chiến dịch UTM và thiết bị vào `LeadAttribution`.
* **Đầu ra**: Bản ghi `Lead` sạch, đã được chuẩn hóa và liên kết với hồ sơ `Customer`.
* **Mở khóa**: FLOW-027, FLOW-030, FLOW-034.

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG (NAVIGATION)

[⬅️ **Luồng trước**: FLOW-025 - Khách Truy Cập Landing Page & Điền Form Đăng Ký (Lead Capture)](./FLOW-025-khach-truy-cap-landing-page-dien-form-dang-ky.md) | [📋 **Mục lục 58 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-027 - Phân Bổ Lead Tự Động Cho Nhân Viên Kinh Doanh (Lead Assignment Engine)](./FLOW-027-phan-bo-lead-tu-dong-cho-nhan-vien-kinh-doanh.md)
