# [FLOW-061] Báo cáo Tổng quan Điều hành (BI Dashboard), AI Report & Nhật ký Kiểm toán

> **Tầng nghiệp vụ**: TẦNG 15: TÀI CHÍNH, MỤC TIÊU KINH DOANH & QUẢN TRỊ TOÀN SÀN  
> **Thứ tự thực thi**: 61 / 62  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Chỉ kích hoạt khi các điều kiện tiên quyết đã sẵn sàng.

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT ("CÓ A")
* Các phân hệ nghiệp vụ từ FLOW-001 đến FLOW-060 đã vận hành.

## 2. TÁC NHÂN THAM GIA (ACTORS)
* Ban lãnh đạo / Kiểm soát nội bộ

## 3. THÀNH PHẦN HỆ THỐNG LIÊN QUAN (CODEBASE ARCHITECTURE)
* **UI Routes**: `/overview`, `/reports`, `/sales/reports`, `/landing-pages/analytics`.
* **API Endpoints**: `GET /landing-pages/overview|analytics`, `GET /leads/funnel/stats|analytics`, `GET /marketing/reports`, `GET /sales/reports/summary`, `GET /hrm/audit`, `GET /work-management/audit-logs`.
* **Models**: `AiReport`, `AuditLog`.

## 4. QUY TRÌNH THỰC HIỆN CHI TIẾT (STEP-BY-STEP)
1. Trang `/overview` và `/reports` hợp nhất KPI đa chiều: Doanh thu, Lợi nhuận, Funnel Lead -> Khách hàng, Hiệu quả Ads/ROAS, Lịch hẹn & Tồn kho.
2. Sinh báo cáo phân tích tự động (`AiReport`) tóm tắt tình hình và khuyến nghị điểm cần tối ưu.
3. Tra cứu Nhật ký Kiểm toán (`AuditLog`, `hrm/audit`, `work-management/audit-logs`) theo dõi chi tiết mọi thay đổi quan trọng kèm user thực hiện, thời gian và dữ liệu trước/sau.

## 5. DỮ LIỆU ĐẦU VÀO & ĐẦU RA (INPUT / OUTPUT)
* **Đầu vào (Input)**: Dữ liệu tổng hợp đa phân hệ theo khoảng thời gian & chi nhánh.
* **Đầu ra (Output)**: Dashboard điều hành trực quan và bằng chứng kiểm toán minh bạch.

## 6. KIỂM SOÁT NGOẠI LỆ, BẢO MẬT & TÍNH TOÀN VẸN
* Audit Log chỉ ghi thêm (append-only), không cho phép chỉnh sửa thủ công.

## 7. MỞ KHÓA LUỒNG TIẾP THEO ("MỚI CÓ B")
* **Kích hoạt / Mở khóa**: Vòng lặp tối ưu chiến lược kinh doanh liên tục

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG

[⬅️ **Luồng trước**: FLOW-060](./FLOW-060-thiet-lap-muc-tieu-kinh-doanh-mo-phong-kich-ban-tang-truong.md) | [📋 **Mục lục 62 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-062](./FLOW-062-quan-tri-sieu-cap-toan-san-tenant-billing-credit-costs-jobs.md)
