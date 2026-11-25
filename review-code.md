# HỆ THỐNG FLOWS NGHIỆP VỤ NỀN TẢNG AIBEEGO (MARKETING SPA)
> *Bản sao lưu dẫn hướng từ thư mục `review-code`.*
> Vui lòng xem bản đầy đủ chi tiết tại: [review-code/FLOWS.md](file:///d:/Backup%20VPS/Backup%20new/aibeego/review-code/FLOWS.md)

---

## 1. NGUYÊN TẮC THIẾT KẾ: "CÓ A MỚI CÓ B"
Hệ thống được cấu trúc theo 15 tầng tuần tự:
1. **Tầng 0: Hạ tầng** (Docker, DB Schema, Seed Permissions & Roles)
2. **Tầng 1: Xác thực & Định danh** (Đăng ký tài khoản -> Xác thực OTP -> Đăng nhập JWT -> Quản lý phiên)
3. **Tầng 2: Tổ chức & Doanh nghiệp** (Tạo Organization -> Chi nhánh -> Phân quyền RBAC -> Gói cước Subscription -> Ví Credit AI)
4. **Tầng 3: Tích hợp Ngoại vi** (Meta Fanpage -> Zalo OA -> Domain Email -> Cổng thanh toán VietQR)
5. **Tầng 4: Danh mục & Kho** (Sản phẩm / Dịch vụ Spa -> Đơn mua hàng PO -> Nhập kho Lô/HSD -> Kiểm kê)
6. **Tầng 5: Phễu & Landing Page** (Thiết kế Landing Page -> Thiết lập Phễu -> Domain riêng & Pixels -> Xuất bản -> Khách điền Form)
7. **Tầng 6: CRM & Quản trị Lead** (Nhận Lead khử trùng lặp -> Phân bổ Sales -> Chấm điểm Lead Scoring -> Chăm sóc)
8. **Tầng 7: Đặt lịch Hẹn Spa** (Đặt lịch check phòng/giường -> Nhắc lịch tự động Zalo -> Check-in & Làm dịch vụ)
9. **Tầng 8: Bán hàng & Thanh toán** (Tạo Coupon -> Tạo Đơn hàng áp mã -> Thanh toán QR tự đối soát -> Xuất kho -> Đổi trả)
10. **Tầng 9: Marketing & Quảng cáo** (Content AI & Auto-post -> AI Ads Manager -> Email Marketing -> Zalo ZNS -> Attribution)
11. **Tầng 10: AI CSKH & Chatbot** (RAG Knowledge Base -> Cấu hình Bot -> Tự động trả lời & Chuyển giao người thật)
12. **Tầng 11: Tiếp thị liên kết** (Đăng ký CTV -> Click link & Tính hoa hồng -> Quyết toán rút tiền)
13. **Tầng 12: Quản trị Nhân sự** (Hồ sơ & Hợp đồng -> Phân ca -> Chấm công QR động -> Chốt bảng công)
14. **Tầng 13: Quản lý Công việc** (Dự án Kanban -> Giao task & Log giờ -> Nghiệm thu đóng task)
15. **Tầng 14: Tài chính & Báo cáo** (Thu chi dòng tiền -> Kịch bản mục tiêu -> BI Dashboard & Audit Log)

Chi tiết đặc tả từng flow, actors, input, output và sơ đồ dòng chảy xem tại [review-code/FLOWS.md](file:///d:/Backup%20VPS/Backup%20new/aibeego/review-code/FLOWS.md).
