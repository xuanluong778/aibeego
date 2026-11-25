# [FLOW-056] Quản Lý Thu - Chi & Sổ Quỹ Dòng Tiền (Finance & Cashflow Ledger)

> **Tầng nghiệp vụ**: TẦNG 14: TÀI CHÍNH, BÁO CÁO & MỤC TIÊU KINH DOANH (FINANCE, ANALYTICS & BUSINESS GOALS)  
> **Thứ tự thực thi**: 56 / 58  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Hoàn thành điều kiện tiên quyết trước khi kích hoạt luồng này.

---

## NỘI DUNG CHI TIẾT LUỒNG NGHIỆP VỤ

* **Điều kiện tiên quyết**: Có dòng tiền vào từ Đơn hàng (FLOW-035) và dòng tiền ra từ Chi phí/Lương/Nhập hàng (FLOW-018, FLOW-052).
* **Tác nhân**: Kế toán / Giám đốc tài chính (CFO) / Chủ doanh nghiệp.
* **Chi tiết luồng**:
  1. **Ghi nhận Dòng tiền Vào (Inflows)**:
     - Tự động đồng bộ từ toàn bộ các giao dịch thanh toán đơn hàng thành công (`SalesPayment`).
     - Ghi nhận các khoản thu khác (Thu từ thanh lý tài sản, thu lãi...).
  2. **Ghi nhận Dòng tiền Ra (Outflows)**:
     - Chi trả đơn mua hàng từ nhà cung cấp (FLOW-018).
     - Chi trả hoa hồng đối tác Affiliate (FLOW-048).
     - Ghi nhận các khoản chi phí hoạt động (`Expense`): Tiền thuê mặt bằng, Tiền điện nước, Tiền ngân sách chạy quảng cáo, Tiền lương nhân viên.
  3. Quản lý Sổ quỹ tiền mặt và Tài khoản ngân hàng, đối soát dòng tiền thuần (Net Cash Flow) theo ngày/tuần/tháng.
* **Đầu ra**: Báo cáo lưu chuyển tiền tệ rõ ràng, tránh nguy cơ mất cân đối thanh khoản.
* **Mở khóa**: FLOW-057, FLOW-058.

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG (NAVIGATION)

[⬅️ **Luồng trước**: FLOW-055 - Đánh Giá, Phê Duyệt & Đóng Công Việc (Task Review & Completion)](./FLOW-055-danh-gia-phe-duyet-dong-cong-viec.md) | [📋 **Mục lục 58 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-057 - Thiết Lập Mục Tiêu Kinh Doanh & Phân Tích Kịch Bản (Business Goals & Scenario Simulation)](./FLOW-057-thiet-lap-muc-tieu-kinh-doanh-phan-tich-kich-ban.md)
