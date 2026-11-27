# [FLOW-060] Thiết lập Mục tiêu Kinh doanh & Mô phỏng Kịch bản Tăng trưởng

> **Tầng nghiệp vụ**: TẦNG 15: TÀI CHÍNH, MỤC TIÊU KINH DOANH & QUẢN TRỊ TOÀN SÀN  
> **Thứ tự thực thi**: 60 / 62  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Chỉ kích hoạt khi các điều kiện tiên quyết đã sẵn sàng.

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT ("CÓ A")
* FLOW-059 (Có dữ liệu tài chính & vận hành thực tế).

## 2. TÁC NHÂN THAM GIA (ACTORS)
* Ban giám đốc / Chủ doanh nghiệp

## 3. THÀNH PHẦN HỆ THỐNG LIÊN QUAN (CODEBASE ARCHITECTURE)
* **UI Routes**: `/business-goals`.
* **API Endpoints**: `GET /business-goals`, `POST /business-goals/calculate`, `POST /business-goals`, `GET/DELETE /business-goals/:id`.
* **Models**: `BusinessGoalScenario`.

## 4. QUY TRÌNH THỰC HIỆN CHI TIẾT (STEP-BY-STEP)
1. Người dùng nhập mục tiêu doanh thu, giá trị đơn trung bình (AOV), tỷ lệ chuyển đổi mong muốn và ngân sách dự kiến.
2. Gọi `POST /business-goals/calculate` để mô phỏng toán học số lượng Lead, số lịch hẹn/đơn hàng và chi phí Ads cần thiết để đạt mục tiêu.
3. Lưu các kịch bản (`BusinessGoalScenario`) để đối chiếu với kết quả thực tế từ phễu Marketing và Bán hàng.

## 5. DỮ LIỆU ĐẦU VÀO & ĐẦU RA (INPUT / OUTPUT)
* **Đầu vào (Input)**: Chỉ tiêu doanh thu, AOV, tỷ lệ chuyển đổi, ngân sách.
* **Đầu ra (Output)**: Kịch bản mục tiêu định lượng (`BusinessGoalScenario`).

## 6. KIỂM SOÁT NGOẠI LỆ, BẢO MẬT & TÍNH TOÀN VẸN
* Đảm bảo các tham số đầu vào nằm trong khoảng hợp lý (chống chia cho 0 khi tỷ lệ chuyển đổi = 0).

## 7. MỞ KHÓA LUỒNG TIẾP THEO ("MỚI CÓ B")
* **Kích hoạt / Mở khóa**: FLOW-042 (Làm mục tiêu đầu vào cho Marketing Autopilot), FLOW-061

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG

[⬅️ **Luồng trước**: FLOW-059](./FLOW-059-quan-ly-thu-chi-tong-hop-so-quy-dong-tien.md) | [📋 **Mục lục 62 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-061](./FLOW-061-bao-cao-tong-quan-dieu-hanh-ai-report-nhat-ky-kiem-toan.md)
