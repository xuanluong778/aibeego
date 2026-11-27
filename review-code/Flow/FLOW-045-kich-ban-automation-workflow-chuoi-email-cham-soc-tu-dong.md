# [FLOW-045] Kịch bản Automation Workflow & Chuỗi Email Chăm sóc Tự động

> **Tầng nghiệp vụ**: TẦNG 11: TIẾP THỊ TỰ ĐỘNG EMAIL, ZALO ZNS & TIN NHẮN ĐA KÊNH  
> **Thứ tự thực thi**: 45 / 62  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Chỉ kích hoạt khi các điều kiện tiên quyết đã sẵn sàng.

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT ("CÓ A")
* FLOW-025 (Phễu) / FLOW-030 (CRM Stages) / FLOW-044 (Email Templates).

## 2. TÁC NHÂN THAM GIA (ACTORS)
* Growth Marketer / Automation Engine

## 3. THÀNH PHẦN HỆ THỐNG LIÊN QUAN (CODEBASE ARCHITECTURE)
* **UI Routes**: `/automation`, `/email-marketing`.
* **API Endpoints**: `GET /automation/variables|templates|funnels`, `GET/POST /automation/flows`, `POST /automation/flows/:id/approve|simulate`, `PATCH /automation/flows/:id/pause`, `GET /automation/logs`, `GET /email-marketing/automations/recipes`, `POST /email-marketing/automations/from-recipe|run`.
* **Models**: `AutomationFlow`, `AutomationLog`, `EmailAutomation`.

## 4. QUY TRÌNH THỰC HIỆN CHI TIẾT (STEP-BY-STEP)
1. Chọn công thức có sẵn (`recipes` -> `from-recipe`) hoặc tự dựng kịch bản `AutomationFlow` gắn với sự kiện CRM/Funnel (VD: khi Lead mới vào, hoặc khi Lead chuyển sang stage `Tiềm năng`).
2. Thiết lập các biến động (`automation/variables`, cá nhân hóa tên khách theo `messaging-name-vars.ts`) và các bước chờ/gửi tin/gửi email.
3. Chạy mô phỏng kiểm thử (`POST /automation/flows/:id/simulate`) trước khi phê duyệt kích hoạt (`approve`).
4. Worker lắng nghe sự kiện phát sinh, tự động thực thi chuỗi hành động và ghi nhận toàn bộ lịch sử vào `AutomationLog`.

## 5. DỮ LIỆU ĐẦU VÀO & ĐẦU RA (INPUT / OUTPUT)
* **Đầu vào (Input)**: Trigger sự kiện CRM/Funnel, các bước hành động (Email/Zalo/Gán tag).
* **Đầu ra (Output)**: Luồng chăm sóc tự động 24/7 theo hành vi khách hàng.

## 6. KIỂM SOÁT NGOẠI LỆ, BẢO MẬT & TÍNH TOÀN VẸN
* Bắt buộc qua bước `approve` mới chạy thật; hỗ trợ tạm dừng `pause` tức thì khi cần điều chỉnh.

## 7. MỞ KHÓA LUỒNG TIẾP THEO ("MỚI CÓ B")
* **Kích hoạt / Mở khóa**: Tăng tỷ lệ chuyển đổi từ Lead thành khách hàng mua lại

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG

[⬅️ **Luồng trước**: FLOW-044](./FLOW-044-quan-ly-danh-ba-phan-khuc-mau-thu-chien-dich-email-marketing.md) | [📋 **Mục lục 62 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-046](./FLOW-046-chien-dich-tin-nhan-zalo-zns-zbs-messaging-broadcast-da-kenh.md)
