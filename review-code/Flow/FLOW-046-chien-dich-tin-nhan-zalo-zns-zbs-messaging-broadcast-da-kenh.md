# [FLOW-046] Chiến dịch Tin nhắn Zalo ZNS/ZBS & Messaging Broadcast Đa kênh

> **Tầng nghiệp vụ**: TẦNG 11: TIẾP THỊ TỰ ĐỘNG EMAIL, ZALO ZNS & TIN NHẮN ĐA KÊNH  
> **Thứ tự thực thi**: 46 / 62  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Chỉ kích hoạt khi các điều kiện tiên quyết đã sẵn sàng.

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT ("CÓ A")
* FLOW-015 (Đã kết nối Zalo OA/Messenger & có `MessageTemplate`), FLOW-028 (Tệp khách hàng).

## 2. TÁC NHÂN THAM GIA (ACTORS)
* Marketer / CSKH

## 3. THÀNH PHẦN HỆ THỐNG LIÊN QUAN (CODEBASE ARCHITECTURE)
* **UI Routes**: `/zalo-marketing`, `/messaging`, `/automation`.
* **API Endpoints**: `POST /zalo-marketing/campaigns`, `POST /zalo-marketing/campaigns/:id/preview-segment|preview-eligibility|schedule|start|pause`, `POST /zalo-marketing/test/zbs`, `POST /automation/eligibility/check`, `POST /automation/messaging-campaigns/:id/test-send|schedule|start|pause|resume|cancel`.
* **Models**: `MessagingCampaign`, `MessagingCampaignRecipient`, `MessagingSuppression`, `MessagingOrgPolicy`.

## 4. QUY TRÌNH THỰC HIỆN CHI TIẾT (STEP-BY-STEP)
1. Tạo chiến dịch nhắn tin qua Zalo ZNS/ZBS (`/zalo-marketing`) hoặc Messaging Campaign đa kênh (`/automation/messaging-campaigns`).
2. Lọc tệp người nhận (`preview-segment`) và chạy kiểm tra điều kiện gửi hợp lệ (`preview-eligibility` / `automation/eligibility/check`: kiểm tra SĐT hợp lệ, cửa sổ 24h/48h Messenger, opt-out, chính sách tần suất).
3. Gửi thử nghiệm (`test/zbs` hoặc `test-send`) để kiểm tra hiển thị biến mẫu.
4. Kích hoạt gửi (`start` / `schedule`): Worker xử lý queue `messaging-queue.ts`, tôn trọng khung giờ yên tĩnh (`messaging-quiet-hours.ts`) và cập nhật thống kê dashboard (`campaigns/:id/dashboard`).

## 5. DỮ LIỆU ĐẦU VÀO & ĐẦU RA (INPUT / OUTPUT)
* **Đầu vào (Input)**: Mẫu tin ZNS/Messenger, tệp khách hàng mục tiêu, lịch gửi.
* **Đầu ra (Output)**: Tin nhắn gửi đúng tệp hợp lệ, báo cáo tỷ lệ thành công/lỗi.

## 6. KIỂM SOÁT NGOẠI LỆ, BẢO MẬT & TÍNH TOÀN VẸN
* Kiểm tra `messaging-eligibility` trước khi gửi tránh vi phạm spam policy của Meta/Zalo; hỗ trợ pause/resume/cancel.

## 7. MỞ KHÓA LUỒNG TIẾP THEO ("MỚI CÓ B")
* **Kích hoạt / Mở khóa**: FLOW-049 (Tương tác tiếp theo của khách đi vào Inbox)

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG

[⬅️ **Luồng trước**: FLOW-045](./FLOW-045-kich-ban-automation-workflow-chuoi-email-cham-soc-tu-dong.md) | [📋 **Mục lục 62 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-047](./FLOW-047-xay-dung-co-so-tri-thuc-doanh-nghiep-rag.md)
