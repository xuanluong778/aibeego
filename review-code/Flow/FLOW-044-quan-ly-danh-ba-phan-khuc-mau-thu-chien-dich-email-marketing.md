# [FLOW-044] Quản lý Danh bạ, Phân khúc, Mẫu thư & Chiến dịch Email Marketing

> **Tầng nghiệp vụ**: TẦNG 11: TIẾP THỊ TỰ ĐỘNG EMAIL, ZALO ZNS & TIN NHẮN ĐA KÊNH  
> **Thứ tự thực thi**: 44 / 62  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Chỉ kích hoạt khi các điều kiện tiên quyết đã sẵn sàng.

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT ("CÓ A")
* FLOW-016 (Đã xác minh `EmailSenderDomain`) & FLOW-028 (Tệp khách hàng CRM).

## 2. TÁC NHÂN THAM GIA (ACTORS)
* Email Marketer

## 3. THÀNH PHẦN HỆ THỐNG LIÊN QUAN (CODEBASE ARCHITECTURE)
* **UI Routes**: `/email-marketing`, `/email-unsubscribe`.
* **API Endpoints**: `POST /email-marketing/contacts/import-customers|sync-crm|import-file`, `GET/POST /email-marketing/lists|segments|templates`, `POST /email-marketing/generate|send-test`, `POST /email-marketing/campaigns/:id/send|schedule|pause|cancel`, `GET /email-marketing/public/open/:rid|click/:rid|unsubscribe`.
* **Models**: `EmailContact`, `EmailList`, `EmailSegment`, `EmailTemplate`, `EmailCampaign`, `EmailCampaignRecipient`, `EmailOutboundMessage`, `EmailEvent`, `EmailSuppression`.

## 4. QUY TRÌNH THỰC HIỆN CHI TIẾT (STEP-BY-STEP)
1. Đồng bộ danh bạ từ CRM (`sync-crm`, `import-customers`) hoặc file (`import-file`), tổ chức thành Danh sách (`EmailList`) và Phân khúc động (`EmailSegment`).
2. Thiết kế mẫu thư (`EmailTemplate`) hoặc dùng AI sinh nội dung (`generate`) và gửi thử kiểm tra (`send-test`).
3. Tạo chiến dịch (`EmailCampaign`), xem trước số lượng người nhận (`audience-preview`), chọn Gửi ngay (`send`) hoặc Hẹn lịch (`schedule`).
4. Khi gửi, hệ thống chèn pixel mở thư (`open/:rid`), link theo dõi click (`click/:rid` qua `email-tracked-links.ts`) và link hủy đăng ký (`unsubscribe`). Loại trừ tự động những email nằm trong `EmailSuppression`.

## 5. DỮ LIỆU ĐẦU VÀO & ĐẦU RA (INPUT / OUTPUT)
* **Đầu vào (Input)**: Tệp danh bạ/phân khúc, mẫu email, tên miền gửi verified, lịch gửi.
* **Đầu ra (Output)**: Email gửi hàng loạt kèm báo cáo Open Rate, Click Rate, Bounce, Unsubscribe.

## 6. KIỂM SOÁT NGOẠI LỆ, BẢO MẬT & TÍNH TOÀN VẸN
* Bắt buộc domain đã verified, tự động lọc `EmailSuppression` để không gửi nhầm người đã từ chối.

## 7. MỞ KHÓA LUỒNG TIẾP THEO ("MỚI CÓ B")
* **Kích hoạt / Mở khóa**: FLOW-045

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG

[⬅️ **Luồng trước**: FLOW-043](./FLOW-043-do-luong-nguon-goc-chuyen-doi-ban-nguoc-offline-conversion-cap.md) | [📋 **Mục lục 62 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-045](./FLOW-045-kich-ban-automation-workflow-chuoi-email-cham-soc-tu-dong.md)
