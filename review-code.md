# HỆ THỐNG 62 FLOWS NGHIỆP VỤ NỀN TẢNG AIBEEGO (MARKETING SPA)
> Tài liệu chuẩn hóa theo mã nguồn thực tế (`Prisma Schema`, `NestJS Controllers/Services`, `Next.js App Routes/Components`).
> Xem thư mục chi tiết từng Flow tại: [review-code/Flow/README.md](file:///d:/Backup%20VPS/Backup%20new/aibeego/review-code/Flow/README.md)

---

## TÓM TẮT 15 TẦNG PHỤ THUỘC ("CÓ A THÌ MỚI CÓ B")
1. **Tầng 0 (FLOW-001 → 002)**: Hạ tầng Docker, Migration DB & Seed Permissions/Roles/Plans.
2. **Tầng 1 (FLOW-003 → 006)**: Đăng ký OTP, Đăng nhập & Google OAuth, Refresh Rotation Root, Quên mật khẩu, Hồ sơ & Locale.
3. **Tầng 2 (FLOW-007 → 011)**: Tổ chức & `BusinessProfile`, Chi nhánh, RBAC & Bảo vệ Uploads, Trial/Subscription Quota, Ví Credit AI (Reserve-Commit-Release).
4. **Tầng 3 (FLOW-012 → 016)**: Thanh toán VietQR & SePAY Webhook, Meta Fanpage, Facebook/Google Ads, Zalo OA/ZNS & Messaging Policy, Email Domain (SPF/DKIM/DMARC & SES/Brevo).
5. **Tầng 4 (FLOW-017 → 022)**: Danh mục & Sản phẩm bán lẻ, Excel Import & WooCommerce Sync, Dịch vụ/Phòng/Giường Spa, Nhà cung cấp & PO, Nhập kho Lô FIFO & Cảnh báo, Kiểm kê & Đối soát kho.
6. **Tầng 5 (FLOW-023 → 027)**: Khởi tạo LP (AI/Templates/Page Doctor), Visual Builder (Image-Frame Free-Drag, Row Move, Color Picker, LP Chatbot), Funnel Builder, Xuất bản (Path/Subdomain/Custom Domain SSL & Cache), Khách truy cập & Thu Lead/Chatbot LP.
7. **Tầng 6 (FLOW-028 → 030)**: Tiếp nhận Lead & Merge Định danh 360, Phân bổ & Claim Lead, Kanban Pipeline & Chăm sóc.
8. **Tầng 7 (FLOW-031 → 032)**: Đặt lịch hẹn Spa (Check trùng Phòng/Giường/KTV), Xác nhận, Dời lịch, Nhắc lịch & Hoàn tất dịch vụ.
9. **Tầng 8 (FLOW-033 → 037)**: Đơn Dịch vụ Spa (`/finance/orders`), Đơn Bán lẻ POS/Online (`SO-*` với `lineDiscount`, `discount`, `shippingFee`), Thanh toán & Hoàn tiền, Xuất kho FIFO (`Export`), Đổi trả hàng (`SalesReturn` với `allocationSnapshot`).
10. **Tầng 9 (FLOW-038 → 040)**: Content AI & Kiểm duyệt Chính sách Facebook, Teleprompter & Video Transcription, Auto-Post Fanpage.
11. **Tầng 10 (FLOW-041 → 043)**: AI Ads Manager & Google Campaign Builder (`AdsActionRequest`), Marketing Autopilot (`Missions`, `Guardrails`, `StopLoss`), Attribution & Offline CAPI.
12. **Tầng 11 (FLOW-044 → 046)**: Email Marketing (Contacts, Lists, Segments, Campaigns, Tracking), Automation Workflows & Drip, Zalo ZNS/ZBS & Messaging Broadcast.
13. **Tầng 12 (FLOW-047 → 050)**: Kho Tri thức RAG đa nguồn, Cấu hình Chatbot CSKH đa kênh, Inbox Hợp nhất & Human Takeover, Trợ lý Điều hành AI Assistant (Tool-Calling + Pending Actions).
14. **Tầng 13 (FLOW-051 → 053)**: Đăng ký Affiliate, Tracking Click/Hoa hồng & Fraud Signal, Rút tiền & Quyết toán.
15. **Tầng 14 (FLOW-054 → 058)**: Nhân sự & Hợp đồng/Tài liệu/Tài khoản, Chính sách & Phân ca, Chấm công QR động/Phép/Bảng công, Dự án Kanban & Giao việc (`WorkTaskMemberAvatars`), Checklist Giao riêng theo Hạng mục (`assigneeId`, `startDate`, `dueDate`, auto-watcher), TimeLog & Review.
16. **Tầng 15 (FLOW-059 → 062)**: Tài chính Thu Chi (`Finance`), Mục tiêu & Kịch bản Kinh doanh, Báo cáo BI & Audit Log, Quản trị Siêu cấp Platform Admin (`/admin`).
