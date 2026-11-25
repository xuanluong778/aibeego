# [FLOW-058] Báo Cáo Tổng Thể Doanh Nghiệp & Nhật Ký Kiểm Toán (BI Dashboard & Audit Log)

> **Tầng nghiệp vụ**: TẦNG 14: TÀI CHÍNH, BÁO CÁO & MỤC TIÊU KINH DOANH (FINANCE, ANALYTICS & BUSINESS GOALS)  
> **Thứ tự thực thi**: 58 / 58  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Hoàn thành điều kiện tiên quyết trước khi kích hoạt luồng này.

---

## NỘI DUNG CHI TIẾT LUỒNG NGHIỆP VỤ

* **Điều kiện tiên quyết**: Toàn bộ các flow từ FLOW-001 đến FLOW-057 đã vận hành và sinh dữ liệu.
* **Tác nhân**: Ban lãnh đạo / Cấp quản lý.
* **Chi tiết luồng**:
  1. Mở Bảng điều khiển Trung tâm (Executive BI Dashboard) tại `/overview` và `/reports`:
     - **Chỉ số Tài chính**: Tổng doanh thu thực thu, Doanh thu theo chi nhánh, Chi phí, Lợi nhuận gộp, Lợi nhuận ròng.
     - **Chỉ số Marketing & Ads**: Tổng ngân sách chi tiêu, Số lượng Lead thu về, Giá mỗi Lead (CPL), Tỷ lệ chuyển đổi phễu (Funnel Conversion Rate), Chỉ số hoàn vốn quảng cáo (ROAS).
     - **Chỉ số Vận hành & Dịch vụ**: Số ca dịch vụ hoàn thành, Tỷ lệ lấp đầy giường spa, Năng suất của kỹ thuật viên.
     - **Chỉ số Tồn kho**: Giá trị hàng tồn, Top sản phẩm bán chạy, Cảnh báo các mặt hàng sắp hết hoặc sắp cận date.
  2. Báo cáo Tự động bằng AI (`AiReport`):
     - Mỗi sáng thứ Hai, Trợ lý AI tự động tổng hợp báo cáo tuần, phân tích điểm nghẽn (Bottlenecks) và gửi bản tóm tắt điều hành qua Email cho Lãnh đạo.
  3. Nhật ký Kiểm toán Toàn hệ thống (`AuditLog`):
     - Ghi nhận chi tiết mọi hành vi nhạy cảm: Ai đã sửa giá sản phẩm? Ai đã xóa đơn hàng? Ai đã duyệt xuất kho? Ai đã đổi quyền nhân viên? Kèm địa chỉ IP và thời gian chính xác tới từng mili-giây.
* **Đầu ra**: Bức tranh toàn cảnh về sức khỏe doanh nghiệp, hỗ trợ ra quyết định kinh doanh dựa trên dữ liệu chuẩn xác 100%.

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG (NAVIGATION)

[⬅️ **Luồng trước**: FLOW-057 - Thiết Lập Mục Tiêu Kinh Doanh & Phân Tích Kịch Bản (Business Goals & Scenario Simulation)](./FLOW-057-thiet-lap-muc-tieu-kinh-doanh-phan-tich-kich-ban.md) | [📋 **Mục lục 58 Flows**](./README.md) | *Đây là luồng cuối cùng trong chuỗi nghiệp vụ*
