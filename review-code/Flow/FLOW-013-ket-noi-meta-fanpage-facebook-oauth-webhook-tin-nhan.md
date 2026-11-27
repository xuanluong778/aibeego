# [FLOW-013] Kết nối Meta Fanpage, Facebook OAuth & Webhook Tin nhắn

> **Tầng nghiệp vụ**: TẦNG 3: CỔNG THANH TOÁN & TÍCH HỢP KÊNH NGOẠI VI  
> **Thứ tự thực thi**: 13 / 62  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Chỉ kích hoạt khi các điều kiện tiên quyết đã sẵn sàng.

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT ("CÓ A")
* FLOW-007 (Đã có Tổ chức và tài khoản Facebook Business/Fanpage).

## 2. TÁC NHÂN THAM GIA (ACTORS)
* Marketer / Admin tổ chức

## 3. THÀNH PHẦN HỆ THỐNG LIÊN QUAN (CODEBASE ARCHITECTURE)
* **UI Routes**: `/auto-post`, `/chatbot-cskh`, `/settings`.
* **API Endpoints**: `GET /auto-post/facebook/oauth/start|callback|pages`, `POST /auto-post/facebook/oauth/select`, `GET /auto-post/facebook/permissions-diagnostics`, `POST /auto-post/facebook/deauthorize|data-deletion`, `GET/POST /chatbot-cskh/facebook/pages`, `GET/POST /chatbot-cskh/facebook/webhook`.
* **Models**: `AutoPostFacebookConnection`, `AutoPostFacebookPage`, `AutoPostFacebookOAuthState`, `ChatbotFacebookPage`.

## 4. QUY TRÌNH THỰC HIỆN CHI TIẾT (STEP-BY-STEP)
1. Người dùng bấm kết nối Facebook -> `GET /auto-post/facebook/oauth/start` tạo `OAuthState` chống CSRF và mở hộp thoại cấp quyền Meta.
2. Meta redirect về `oauth/callback` -> Backend đổi code lấy Token, kiểm tra quyền hạn (`permissions-diagnostics`).
3. Người dùng chọn các Fanpage muốn kết nối (`POST /auto-post/facebook/oauth/select` hoặc `/chatbot-cskh/facebook/pages`).
4. Hệ thống đăng ký Webhook Fanpage (`chatbot-cskh/facebook/webhook` và `messaging/webhooks/messenger`) để nhận tin nhắn Messenger/bình luận realtime.
5. Hỗ trợ đầy đủ endpoint tuân thủ chính sách Meta: `deauthorize` và `data-deletion` (`status/:code`).

## 5. DỮ LIỆU ĐẦU VÀO & ĐẦU RA (INPUT / OUTPUT)
* **Đầu vào (Input)**: Meta OAuth Authorization Code & danh sách Page IDs được chọn.
* **Đầu ra (Output)**: `AutoPostFacebookPage`, `ChatbotFacebookPage`, Webhook Messenger hoạt động.

## 6. KIỂM SOÁT NGOẠI LỆ, BẢO MẬT & TÍNH TOÀN VẸN
* Kiểm tra `state` OAuth chống CSRF, kiểm tra chữ ký `X-Hub-Signature-256` trên Webhook Meta.

## 7. MỞ KHÓA LUỒNG TIẾP THEO ("MỚI CÓ B")
* **Kích hoạt / Mở khóa**: FLOW-040 (Auto-post), FLOW-048 & FLOW-049 (Chatbot Fanpage)

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG

[⬅️ **Luồng trước**: FLOW-012](./FLOW-012-thanh-toan-vietqr-dong-tu-dong-doi-soat-webhook-sepay.md) | [📋 **Mục lục 62 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-014](./FLOW-014-ket-noi-tai-khoan-quang-cao-meta-ads-google-ads.md)
