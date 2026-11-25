# [FLOW-028] Chấm Điểm Tiềm Năng & Quản Lý Giai Đoạn Phễu (Lead Scoring & Pipeline)

> **Tầng nghiệp vụ**: TẦNG 6: QUẢN LÝ QUAN HỆ KHÁCH HÀNG & PHÂN LOẠI LEAD (CRM & LEAD NURTURING)  
> **Thứ tự thực thi**: 28 / 58  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Hoàn thành điều kiện tiên quyết trước khi kích hoạt luồng này.

---

## NỘI DUNG CHI TIẾT LUỒNG NGHIỆP VỤ

* **Điều kiện tiên quyết**: Lead đã được phân bổ (FLOW-027).
* **Tác nhân**: Động cơ Funnel Scoring + Nhân viên kinh doanh.
* **Chi tiết luồng**:
  1. Hệ thống tự động tính điểm tiềm năng (`FunnelScoringRule`):
     - Điền đầy đủ thông tin: +10 điểm.
     - Đến từ chiến dịch quảng cáo giá trị cao: +20 điểm.
     - Khách mở email hoặc xem lại landing page lần 2: +15 điểm.
     - Khách từng mua hàng trong quá khứ: +50 điểm.
  2. Xếp loại khách hàng: Lạnh (Cold: < 30 điểm), Ấm (Warm: 30-70 điểm), Nóng (Hot: > 70 điểm).
  3. Nhân viên theo dõi Lead trên Kanban Pipeline:
     - `MỚI` -> `ĐÃ LIÊN HỆ` -> `TIỀM NĂNG` -> `HẸN DỊCH VỤ` -> `BÁO GIÁ` -> `CHỐT THÀNH CÔNG` / `THẤT BẠI`.
* **Đầu ra**: Tỷ lệ chuyển đổi được đo lường chính xác qua từng nấc thang.
* **Mở khóa**: FLOW-029, FLOW-030, FLOW-034.

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG (NAVIGATION)

[⬅️ **Luồng trước**: FLOW-027 - Phân Bổ Lead Tự Động Cho Nhân Viên Kinh Doanh (Lead Assignment Engine)](./FLOW-027-phan-bo-lead-tu-dong-cho-nhan-vien-kinh-doanh.md) | [📋 **Mục lục 58 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-029 - Chăm Sóc Lead, Ghi Chú & Lịch Nhắc Việc (Lead Notes & CRM Tasks)](./FLOW-029-cham-soc-lead-ghi-chu-lich-nhac-viec.md)
