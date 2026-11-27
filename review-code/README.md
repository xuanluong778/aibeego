# THƯ MỤC REVIEW CODE & ĐẶC TẢ FLOWS NGHIỆP VỤ AIBEEGO

Thư mục này chứa toàn bộ tài liệu đặc tả hệ thống **AiBeego (Marketing & Spa Automation)** được chuẩn hóa và kiểm chứng 100% từ mã nguồn thực tế (Prisma schema, NestJS backend, Next.js frontend).

Mọi tài liệu tuân thủ tuyệt đối nguyên tắc **"CÓ A THÌ MỚI CÓ B"** (luồng tiên quyết thực thi trước, luồng phái sinh thực thi sau).

---

### Cấu trúc tài liệu:

1. 📂 [**Thư mục Flow (62 Files MD riêng biệt)**](./Flow/README.md)
   * Chứa **62 file markdown độc lập** được đánh số thứ tự từ `FLOW-001` đến `FLOW-062`.
   * Mỗi file định nghĩa chi tiết:
     - **Điều kiện tiên quyết ("CÓ A")**
     - **Tác nhân tham gia (Actors)**
     - **Thành phần hệ thống liên quan (Frontend Routes/Components, API Endpoints, DB Models)**
     - **Quy trình thực hiện chi tiết (Step-by-step)**
     - **Dữ liệu Vào/Ra (Input / Output)**
     - **Kiểm soát ngoại lệ & bảo mật**
     - **Mở khóa luồng tiếp theo ("MỚI CÓ B")**
     - **Liên kết điều hướng (Prev / Index / Next)**

2. 📑 [**Mục lục & Sơ đồ Mermaid 15 Tầng (Flow/README.md)**](./Flow/README.md)
   * Sơ đồ phân tầng kiến trúc tổng thể từ Hạ tầng, Định danh, Tổ chức, Kho vận, Landing Page, CRM, POS, Marketing Autopilot, AI CSKH, Affiliate, HRM đến Quản trị Siêu cấp Toàn sàn (Platform Admin).

---

### Các cập nhật tính năng và giao diện mới nhất đã đồng bộ vào Flow:
* **FLOW-004**: Bổ sung `rotation_root_id` vào cơ chế Refresh Token Rotation để thu hồi toàn bộ chuỗi phiên bị xâm nhập khi phát hiện token tái sử dụng.
* **FLOW-024**: Cập nhật bộ Visual Builder: Free-Drag Frame (`resolveClippedPaintHost` - kéo cả khung bo góc/clip ảnh), Section Row Move (preview trượt theo con trỏ chuột), đồng bộ bộ chọn màu Color Picker Popover (Tab Màu đơn / Màu tán sắc Gradient) và Chatbot AI nhúng trên Landing Page.
* **FLOW-026 & FLOW-027**: Kiểm tra tên miền con hệ thống (`subdomain-availability`), revalidate cache công khai, widget chatbot robot tương tác trực tiếp với khách truy cập trên Landing Page.
* **FLOW-033 & FLOW-034**: Tách biệt rõ ràng Đơn dịch vụ Spa (`Order` tại `/finance/orders`) và Đơn bán lẻ POS (`SalesOrder` tại `/sales/orders` với chiết khấu dòng `lineDiscount`, chiết khấu đơn `discount`, phí ship `shippingFee`).
* **FLOW-037**: Hoàn tiền đổi trả với `allocationSnapshot` tách bạch hoàn doanh thu, hoàn giảm giá và hoàn phí ship.
* **FLOW-057 & FLOW-058**: Quản lý công việc với hiển thị avatar thành viên (`WorkTaskMemberAvatars`), và giao việc theo từng hạng mục checklist (`WorkChecklistItemRow` với `assigneeId`, `startDate`, `dueDate`), tự động cấp quyền theo dõi (`WorkTaskWatcher`) và bắn thông báo riêng cho nhân viên.
* **FLOW-062**: Bổ sung luồng Quản trị Siêu cấp Toàn sàn (`/admin` - Platform Super Admin: quản trị tổ chức, người dùng, gia hạn thuê bao, điều chỉnh bảng giá credit AI, chạy lại background jobs lỗi).
