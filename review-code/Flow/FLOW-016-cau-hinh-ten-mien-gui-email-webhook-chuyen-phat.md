# [FLOW-016] Cấu hình Tên miền Gửi Email (SPF/DKIM/DMARC) & Webhook Chuyển phát

> **Tầng nghiệp vụ**: TẦNG 3: CỔNG THANH TOÁN & TÍCH HỢP KÊNH NGOẠI VI  
> **Thứ tự thực thi**: 16 / 62  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Chỉ kích hoạt khi các điều kiện tiên quyết đã sẵn sàng.

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT ("CÓ A")
* FLOW-007 (Tổ chức sở hữu tên miền riêng).

## 2. TÁC NHÂN THAM GIA (ACTORS)
* Kỹ thuật viên / Email Marketer

## 3. THÀNH PHẦN HỆ THỐNG LIÊN QUAN (CODEBASE ARCHITECTURE)
* **UI Routes**: `/email-marketing`.
* **API Endpoints**: `GET/POST /email-marketing/domains`, `POST /email-marketing/domains/:id/verify`, `POST /email-marketing/domains/:id/check`, `POST /webhooks/brevo`, `POST /email-marketing/public/ses-events`.
* **Models**: `EmailSenderDomain`, `EmailWebhookEvent`, `EmailSuppression`.

## 4. QUY TRÌNH THỰC HIỆN CHI TIẾT (STEP-BY-STEP)
1. Thêm tên miền gửi thư (`POST /email-marketing/domains` -> lưu `EmailSenderDomain`).
2. Hệ thống sinh các bản ghi DNS cần trỏ (SPF, DKIM, DMARC) tùy theo provider (Amazon SES / Brevo / SMTP từ `packages/shared/email-provider.ts`).
3. Người dùng cập nhật DNS -> bấm kiểm tra & xác minh (`domains/:id/check`, `domains/:id/verify`).
4. Đăng ký Webhook phản hồi (`webhooks/brevo` với kiểm tra chữ ký hoặc `email-marketing/public/ses-events` với SNS signature `sns-signature.ts`).
5. Khi email bị bounce cứng hoặc báo spam, hệ thống tự động đưa địa chỉ vào danh sách chặn `EmailSuppression` để bảo vệ uy tín domain.

## 5. DỮ LIỆU ĐẦU VÀO & ĐẦU RA (INPUT / OUTPUT)
* **Đầu vào (Input)**: Tên miền gửi thư, cấu hình provider, bản ghi DNS.
* **Đầu ra (Output)**: `EmailSenderDomain` trạng thái `VERIFIED`, sẵn sàng gửi chiến dịch.

## 6. KIỂM SOÁT NGOẠI LỆ, BẢO MẬT & TÍNH TOÀN VẸN
* Chặn gửi hàng loạt nếu domain chưa verified; tự động suppress email lỗi/unsubscribe.

## 7. MỞ KHÓA LUỒNG TIẾP THEO ("MỚI CÓ B")
* **Kích hoạt / Mở khóa**: FLOW-044 (Chiến dịch Email), FLOW-045 (Email Automation)

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG

[⬅️ **Luồng trước**: FLOW-015](./FLOW-015-ket-noi-zalo-official-account-chinh-sach-nhan-tin.md) | [📋 **Mục lục 62 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-017](./FLOW-017-quan-ly-danh-muc-san-pham-ban-le.md)
