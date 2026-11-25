# THƯ MỤC REVIEW CODE & ĐẶC TẢ FLOWS NGHIỆP VỤ AIBEEGO

Thư mục này chứa tài liệu đặc tả toàn bộ các flow nghiệp vụ của hệ thống **AiBeego (Marketing SPA)** theo nguyên tắc phụ thuộc **"Có A thì mới có B"** và theo thứ tự ưu tiên quan trọng nhất.

---

### Danh sách tài liệu:

* 📄 [**FLOWS.md**](file:///d:/Backup%20VPS/Backup%20new/aibeego/review-code/FLOWS.md) - **Tài liệu tổng thể 58 Flow nghiệp vụ chi tiết kèm Sơ đồ Mermaid & Ma trận phụ thuộc**
  * **Tầng 0 & 1**: Hạ tầng (Docker, DB Seed) & Quản trị danh tính (Register -> Login -> Password Reset -> Profile)
  * **Tầng 2**: Thiết lập Tổ chức & Bản quyền (Organization -> Branches -> RBAC Roles & Permissions -> Subscription & Billing -> Credit AI)
  * **Tầng 3**: Tích hợp Kênh ngoại vi (Meta Fanpage -> Zalo OA -> Email Sender Domain -> Cổng thanh toán VietQR/SePAY)
  * **Tầng 4**: Sản phẩm, Dịch vụ & Kho hàng (Sản phẩm / Dịch vụ Spa -> Đơn mua hàng PO -> Nhập kho Lô/HSD FIFO -> Kiểm kê & Cân đối kho)
  * **Tầng 5**: Phễu & Landing Page (Visual/AI Builder -> Funnel Pipeline -> Tên miền riêng & Pixels -> Xuất bản CDN -> Khách truy cập & Điền Form)
  * **Tầng 6**: CRM & Quản trị Lead (Tiếp nhận & Khử trùng lặp Lead -> Phân bổ tự động -> Chấm điểm Lead Scoring -> Chăm sóc & CRM Tasks)
  * **Tầng 7**: Đặt lịch hẹn Spa (Đặt lịch check phòng/KTV -> Xác nhận & Tự động nhắc lịch Zalo/Email -> Check-in & Hoàn tất liệu trình)
  * **Tầng 8**: Bán hàng, Khuyến mãi & Thanh toán (Tạo Coupon -> Tạo Đơn hàng kèm Coupon -> Thanh toán tự động đối soát VietQR -> Xuất kho giao hàng -> Đổi trả & Hoàn tiền)
  * **Tầng 9**: Marketing & Quảng cáo tự động (Content AI & Auto-post -> AI Ads Manager & Autopilot -> Email Marketing -> Zalo ZNS -> Attribution & CAPI)
  * **Tầng 10**: Trợ lý AI & Chatbot CSKH (RAG Knowledge Base -> Cấu hình Bot Fanpage/Web -> Tự động CSKH & Bàn giao tư vấn viên)
  * **Tầng 11**: Tiếp thị liên kết Affiliate (Đăng ký CTV -> Theo dõi Ref link & Tính hoa hồng -> Yêu cầu rút tiền)
  * **Tầng 12**: Quản trị Nhân sự HRM (Hồ sơ nhân viên & Hợp đồng -> Phân ca làm việc -> Chấm công QR động/GPS -> Quản lý phép & Chốt bảng công)
  * **Tầng 13**: Quản lý Công việc (Dự án & Kanban -> Giao việc, Checklist & Log thời gian -> Đánh giá & Đóng task)
  * **Tầng 14**: Tài chính & Mục tiêu kinh doanh (Sổ quỹ Thu - Chi Dòng tiền -> Mục tiêu & Kịch bản doanh thu -> Executive BI Dashboard & Audit Log)

---
*Tài liệu được sinh tự động chuẩn hóa theo toàn bộ 238 Prisma Data Models và hệ thống Controllers/Services trong dự án.*
