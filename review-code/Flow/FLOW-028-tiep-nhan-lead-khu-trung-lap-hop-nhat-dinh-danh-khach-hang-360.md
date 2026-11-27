# [FLOW-028] Tiếp nhận Lead, Khử trùng lặp & Hợp nhất Định danh Khách hàng 360

> **Tầng nghiệp vụ**: TẦNG 6: QUẢN LÝ QUAN HỆ KHÁCH HÀNG (CRM 360) & ĐỊNH DANH ĐA KÊNH  
> **Thứ tự thực thi**: 28 / 62  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Chỉ kích hoạt khi các điều kiện tiên quyết đã sẵn sàng.

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT ("CÓ A")
* FLOW-027 (Lead từ LP/Funnel), FLOW-013 (Lead Ads Facebook) hoặc FLOW-049 (Lead từ Chatbot).

## 2. TÁC NHÂN THAM GIA (ACTORS)
* Hệ thống CRM / Nhân viên CSKH

## 3. THÀNH PHẦN HỆ THỐNG LIÊN QUAN (CODEBASE ARCHITECTURE)
* **UI Routes**: `/customers`, `/customers/[id]`, `/leads`.
* **API Endpoints**: `POST /leads`, `GET /crm/customers/:id/360`, `GET /crm/customers/:id/duplicates`, `POST /crm/customers/merge`, `POST /messaging-identities/upsert|link|link-verified-phone|merge`, `POST /messaging-identities/merge-logs/:logId/undo`.
* **Models**: `Customer`, `CustomerIdentity`, `CustomerMergeLog`, `Lead`, `MessagingContactIdentity`, `MessagingIdentityMergeLog`.

## 4. QUY TRÌNH THỰC HIỆN CHI TIẾT (STEP-BY-STEP)
1. Khi có Lead mới, hệ thống chuẩn hóa số điện thoại/email và đối chiếu với `Customer` & `CustomerIdentity`.
2. Nếu phát hiện khách hàng cũ (trùng SĐT/Email/Messaging Identity): gợi ý liên kết hoặc tự động gắn `Lead` mới vào hồ sơ `Customer` sẵn có để không tạo bản sao rác.
3. Trên màn hình Khách hàng 360 (`/customers/[id]`), nhân viên xem được toàn bộ lịch sử mua hàng, lịch hẹn spa, tương tác chat Messenger/Zalo và danh sách nghi ngờ trùng lặp (`duplicates`).
4. Nếu có 2 hồ sơ trùng nhau: dùng `POST /crm/customers/merge` hoặc `messaging-identities/merge` để gộp về 1 khách hàng gốc (có lưu `CustomerMergeLog` / `MessagingIdentityMergeLog` cho phép hoàn tác `undo`).

## 5. DỮ LIỆU ĐẦU VÀO & ĐẦU RA (INPUT / OUTPUT)
* **Đầu vào (Input)**: Payload Lead / Identity từ đa kênh (Web, Facebook, Zalo).
* **Đầu ra (Output)**: Hồ sơ `Customer` 360 độ sạch, thống nhất định danh đa kênh.

## 6. KIỂM SOÁT NGOẠI LỆ, BẢO MẬT & TÍNH TOÀN VẸN
* Lưu lịch sử merge để có thể `undo` nếu gộp nhầm; bảo toàn toàn bộ đơn hàng và lịch sử khi gộp.

## 7. MỞ KHÓA LUỒNG TIẾP THEO ("MỚI CÓ B")
* **Kích hoạt / Mở khóa**: FLOW-029, FLOW-031, FLOW-033, FLOW-034, FLOW-044

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG

[⬅️ **Luồng trước**: FLOW-027](./FLOW-027-khach-truy-cap-cong-khai-tuong-tac-chatbot-lp-gui-form-thu-lea.md) | [📋 **Mục lục 62 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-029](./FLOW-029-phan-bo-lead-tu-dong-co-che-nhan-lead.md)
