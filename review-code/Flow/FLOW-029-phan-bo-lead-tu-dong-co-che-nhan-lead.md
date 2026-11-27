# [FLOW-029] Phân bổ Lead Tự động (Assignment Rules) & Cơ chế Nhận Lead (Claim)

> **Tầng nghiệp vụ**: TẦNG 6: QUẢN LÝ QUAN HỆ KHÁCH HÀNG (CRM 360) & ĐỊNH DANH ĐA KÊNH  
> **Thứ tự thực thi**: 29 / 62  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Chỉ kích hoạt khi các điều kiện tiên quyết đã sẵn sàng.

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT ("CÓ A")
* FLOW-028 (Đã tiếp nhận Lead) & FLOW-054 (Có danh sách nhân viên Sales).

## 2. TÁC NHÂN THAM GIA (ACTORS)
* Assignment Engine / Quản lý Sales / Nhân viên Sales

## 3. THÀNH PHẦN HỆ THỐNG LIÊN QUAN (CODEBASE ARCHITECTURE)
* **UI Routes**: `/crm`, `/leads`.
* **API Endpoints**: `GET/POST/DELETE /crm/assignment-rules`, `POST /crm/leads/:id/claim`, `PATCH /leads/:id/assign`.
* **Models**: `LeadAssignmentRule`, `Lead`, `LeadActivity`.

## 4. QUY TRÌNH THỰC HIỆN CHI TIẾT (STEP-BY-STEP)
1. Quản lý thiết lập quy tắc phân bổ (`LeadAssignmentRule`): chia xoay vòng (Round-Robin), chia theo chi nhánh/nguồn đổ về, hoặc cơ chế giỏ chung cho Sales tự nhận (`claim`).
2. Khi Lead mới vào hệ thống, động cơ phân bổ áp dụng rule phù hợp để gán nhân viên phụ trách (`PATCH /leads/:id/assign`) hoặc đẩy vào giỏ để nhân viên bấm nhận (`POST /crm/leads/:id/claim`).
3. Ghi nhận sự kiện phân bổ vào `LeadActivity` và gửi thông báo realtime qua Socket.IO tới nhân viên được giao.

## 5. DỮ LIỆU ĐẦU VÀO & ĐẦU RA (INPUT / OUTPUT)
* **Đầu vào (Input)**: Lead mới + Cấu hình `LeadAssignmentRule`.
* **Đầu ra (Output)**: Lead có nhân viên chịu trách nhiệm chăm sóc.

## 6. KIỂM SOÁT NGOẠI LỆ, BẢO MẬT & TÍNH TOÀN VẸN
* Cơ chế khóa chống 2 nhân viên `claim` cùng 1 lead đồng thời.

## 7. MỞ KHÓA LUỒNG TIẾP THEO ("MỚI CÓ B")
* **Kích hoạt / Mở khóa**: FLOW-030

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG

[⬅️ **Luồng trước**: FLOW-028](./FLOW-028-tiep-nhan-lead-khu-trung-lap-hop-nhat-dinh-danh-khach-hang-360.md) | [📋 **Mục lục 62 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-030](./FLOW-030-quan-ly-pipeline-kanban-cham-diem-cham-soc-chuyen-doi-khach-ha.md)
