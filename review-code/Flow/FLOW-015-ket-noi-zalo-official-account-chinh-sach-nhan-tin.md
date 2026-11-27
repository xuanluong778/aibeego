# [FLOW-015] Kết nối Zalo Official Account (OA / ZNS / ZBS) & Chính sách Nhắn tin

> **Tầng nghiệp vụ**: TẦNG 3: CỔNG THANH TOÁN & TÍCH HỢP KÊNH NGOẠI VI  
> **Thứ tự thực thi**: 15 / 62  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Chỉ kích hoạt khi các điều kiện tiên quyết đã sẵn sàng.

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT ("CÓ A")
* FLOW-007 (Đã có Tổ chức và Zalo OA đã xác thực).

## 2. TÁC NHÂN THAM GIA (ACTORS)
* Quản trị viên / Marketer

## 3. THÀNH PHẦN HỆ THỐNG LIÊN QUAN (CODEBASE ARCHITECTURE)
* **UI Routes**: `/zalo-marketing`, `/messaging`, `/automation`.
* **API Endpoints**: `POST /zalo-marketing/oauth/start`, `GET /zalo-marketing/public/oauth/callback`, `POST /zalo-marketing/oa/:id/refresh`, `POST /zalo-marketing/oa/zbs`, `POST /zalo-marketing/templates/sync`, `/zalo/connections/*`, `/automation/channel-connections/*`, `/automation/messaging-policy`.
* **Models**: `MessagingChannelConnection`, `MessagingOrgPolicy`, `MessageTemplate`, `MessagingWebhookEvent`.

## 4. QUY TRÌNH THỰC HIỆN CHI TIẾT (STEP-BY-STEP)
1. Ủy quyền Zalo OA qua `POST /zalo-marketing/oauth/start` -> Zalo chuyển hướng về `zalo-marketing/public/oauth/callback`.
2. Lưu `MessagingChannelConnection` kèm Access Token / Refresh Token (hỗ trợ làm mới tự động hoặc thủ công qua `oa/:id/refresh` và `zalo/connections/:id/test`).
3. Đồng bộ danh sách mẫu tin ZNS/ZBS đã được Zalo duyệt (`POST /zalo-marketing/templates/sync` -> lưu vào `MessageTemplate`).
4. Cấu hình Webhook Zalo (`webhooks/zalo` và `messaging/webhooks/zalo`) với xác thực chữ ký (`zalo-webhook-signature.ts`).
5. Thiết lập chính sách nhắn tin tổ chức (`MessagingOrgPolicy`: khung giờ yên tĩnh `messaging-quiet-hours`, giới hạn tần suất gửi để tránh khóa OA).

## 5. DỮ LIỆU ĐẦU VÀO & ĐẦU RA (INPUT / OUTPUT)
* **Đầu vào (Input)**: Zalo OA OAuth Code, ZBS/ZNS App credentials, quy tắc Quiet Hours.
* **Đầu ra (Output)**: Kênh Zalo OA/ZNS sẵn sàng gửi thông báo lịch hẹn, chăm sóc và nhận tin chat.

## 6. KIỂM SOÁT NGOẠI LỆ, BẢO MẬT & TÍNH TOÀN VẸN
* Xác thực chữ ký Webhook Zalo, auto-refresh token trước khi hết hạn 25h, tuân thủ `messaging-eligibility`.

## 7. MỞ KHÓA LUỒNG TIẾP THEO ("MỚI CÓ B")
* **Kích hoạt / Mở khóa**: FLOW-032 (Nhắc lịch hẹn), FLOW-046 (Zalo Marketing & Messaging Broadcast), FLOW-049 (Inbox hợp nhất)

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG

[⬅️ **Luồng trước**: FLOW-014](./FLOW-014-ket-noi-tai-khoan-quang-cao-meta-ads-google-ads.md) | [📋 **Mục lục 62 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-016](./FLOW-016-cau-hinh-ten-mien-gui-email-webhook-chuyen-phat.md)
