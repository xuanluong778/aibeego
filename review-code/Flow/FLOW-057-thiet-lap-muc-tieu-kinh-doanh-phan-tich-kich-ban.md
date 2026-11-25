# [FLOW-057] Thiết Lập Mục Tiêu Kinh Doanh & Phân Tích Kịch Bản (Business Goals & Scenario Simulation)

> **Tầng nghiệp vụ**: TẦNG 14: TÀI CHÍNH, BÁO CÁO & MỤC TIÊU KINH DOANH (FINANCE, ANALYTICS & BUSINESS GOALS)  
> **Thứ tự thực thi**: 57 / 58  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Hoàn thành điều kiện tiên quyết trước khi kích hoạt luồng này.

---

## NỘI DUNG CHI TIẾT LUỒNG NGHIỆP VỤ

* **Điều kiện tiên quyết**: Đã có số liệu tài chính và vận hành lịch sử (FLOW-056).
* **Tác nhân**: Ban lãnh đạo / Chiến lược gia.
* **Chi tiết luồng**:
  1. Vào `/business-goals`, thiết lập Mục tiêu kinh doanh tháng/quý:
     - Mục tiêu Doanh thu: ví dụ 1,000,000,000 VND.
     - Mục tiêu Số lượng Khách hàng mới: 500 khách.
     - Ngân sách Marketing cho phép: 150,000,000 VND.
  2. Mô phỏng Kịch bản Tương lai (`BusinessGoalScenario`):
     - AI phân tích dữ liệu lịch sử (Tỷ lệ chuyển đổi phễu, Giá trị đơn bình quân, Chi phí trên mỗi lead).
     - Đưa ra 3 kịch bản:
       - *Kịch bản Thận trọng (Pessimistic)*: Cần thêm bao nhiêu ngân sách để bù đắp nếu CPL tăng?
       - *Kịch bản Cơ sở (Realistic)*: Cần chạy bao nhiêu chiến dịch ads, gửi bao nhiêu email để về đích?
       - *Kịch bản Tăng trưởng (Optimistic)*: Mức trần doanh thu có thể đạt được nếu tối ưu hóa thêm 5% tỷ lệ chốt sale.
* **Đầu ra**: Bản đồ hành động cụ thể cho toàn bộ đội ngũ bán hàng và marketing.
* **Mở khóa**: FLOW-058.

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG (NAVIGATION)

[⬅️ **Luồng trước**: FLOW-056 - Quản Lý Thu - Chi & Sổ Quỹ Dòng Tiền (Finance & Cashflow Ledger)](./FLOW-056-quan-ly-thu-chi-so-quy-dong-tien.md) | [📋 **Mục lục 58 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-058 - Báo Cáo Tổng Thể Doanh Nghiệp & Nhật Ký Kiểm Toán (BI Dashboard & Audit Log)](./FLOW-058-bao-cao-tong-the-doanh-nghiep-nhat-ky-kiem-toan.md)
