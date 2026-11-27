# [FLOW-030] Quản lý Pipeline Kanban, Chấm điểm, Chăm sóc & Chuyển đổi Khách hàng

> **Tầng nghiệp vụ**: TẦNG 6: QUẢN LÝ QUAN HỆ KHÁCH HÀNG (CRM 360) & ĐỊNH DANH ĐA KÊNH  
> **Thứ tự thực thi**: 30 / 62  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Chỉ kích hoạt khi các điều kiện tiên quyết đã sẵn sàng.

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT ("CÓ A")
* FLOW-029 (Lead đã có người phụ trách).

## 2. TÁC NHÂN THAM GIA (ACTORS)
* Nhân viên kinh doanh / CSKH

## 3. THÀNH PHẦN HỆ THỐNG LIÊN QUAN (CODEBASE ARCHITECTURE)
* **UI Routes**: `/crm`, `/leads`.
* **API Endpoints**: `GET /leads/kanban`, `GET /leads/alerts/stale`, `GET/POST /leads/saved-views`, `PATCH /leads/:id/status`, `POST /leads/:id/notes`, `POST /leads/:id/convert-customer`, `GET /crm/pipeline`, `POST /crm/pipeline/stages`.
* **Models**: `FunnelPipeline`, `FunnelStage`, `Lead`, `LeadNote`, `LeadActivity`, `CrmTask`, `LeadSavedView`.

## 4. QUY TRÌNH THỰC HIỆN CHI TIẾT (STEP-BY-STEP)
1. Quản lý tùy biến các cột giai đoạn phễu (`FunnelStage` trong `FunnelPipeline`). Nhân viên sử dụng giao diện Kanban (`/leads` / `/crm`) và bộ lọc lưu sẵn (`LeadSavedView`).
2. Hệ thống cảnh báo các Lead bị bỏ quên lâu chưa tương tác (`GET /leads/alerts/stale`).
3. Nhân viên gọi/nhắn tư vấn, ghi chú lịch sử (`POST /leads/:id/notes`), tạo công việc hẹn gọi lại (`CrmTask`) và kéo thả Lead qua các cột trạng thái (`PATCH /leads/:id/status`).
4. Khi chốt thành công: bấm chuyển đổi thành khách hàng chính thức (`POST /leads/:id/convert-customer`) hoặc chuyển tiếp sang Đặt lịch / Tạo đơn hàng.

## 5. DỮ LIỆU ĐẦU VÀO & ĐẦU RA (INPUT / OUTPUT)
* **Đầu vào (Input)**: Trạng thái pipeline, ghi chú tư vấn, tác vụ nhắc hẹn.
* **Đầu ra (Output)**: Lead dịch chuyển trong phễu, ghi nhận đầy đủ `LeadActivity` & chuyển đổi khách hàng.

## 6. KIỂM SOÁT NGOẠI LỆ, BẢO MẬT & TÍNH TOÀN VẸN
* Kiểm tra chuyển đổi trạng thái hợp lệ (`status-transitions.util.ts`), đồng bộ cập nhật với Automation Trigger (FLOW-045).

## 7. MỞ KHÓA LUỒNG TIẾP THEO ("MỚI CÓ B")
* **Kích hoạt / Mở khóa**: FLOW-031 (Đặt lịch), FLOW-033 & FLOW-034 (Tạo đơn hàng)

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG

[⬅️ **Luồng trước**: FLOW-029](./FLOW-029-phan-bo-lead-tu-dong-co-che-nhan-lead.md) | [📋 **Mục lục 62 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-031](./FLOW-031-dat-lich-hen-dich-vu-spa-kiem-tra-xung-dot-phong-giuong-ky-thu.md)
