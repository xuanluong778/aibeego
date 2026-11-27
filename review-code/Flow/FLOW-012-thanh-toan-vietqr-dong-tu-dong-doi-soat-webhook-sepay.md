# [FLOW-012] Thanh toán VietQR Động & Tự động Đối soát Webhook SePAY

> **Tầng nghiệp vụ**: TẦNG 3: CỔNG THANH TOÁN & TÍCH HỢP KÊNH NGOẠI VI  
> **Thứ tự thực thi**: 12 / 62  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Chỉ kích hoạt khi các điều kiện tiên quyết đã sẵn sàng.

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT ("CÓ A")
* FLOW-007 & FLOW-010/011 (Đã có `PaymentOrder` chờ thanh toán).

## 2. TÁC NHÂN THAM GIA (ACTORS)
* Người mua gói/credit + Ngân hàng + SePAY Webhook

## 3. THÀNH PHẦN HỆ THỐNG LIÊN QUAN (CODEBASE ARCHITECTURE)
* **API Endpoints**: `GET /billing/orders/:idOrCode`, `POST /payments/sepay/webhook`, `POST /admin/billing/transactions/:id/reprocess`, `POST /admin/billing/orders/review`.
* **Models**: `PaymentOrder`, `PaymentTransaction`, `Subscription`, `CreditWallet`.

## 4. QUY TRÌNH THỰC HIỆN CHI TIẾT (STEP-BY-STEP)
1. Khi `PaymentOrder` được tạo, hệ thống hiển thị mã `qrUrl` (VietQR) kèm `bankCode`, `accountNumber`, `accountName`, `amountVnd` và `transferContent` (chứa mã đơn duy nhất).
2. Người dùng quét QR chuyển khoản. Ngân hàng ghi nhận biến động số dư và SePAY bắn webhook `POST /payments/sepay/webhook`.
3. Backend xác thực chữ ký/token SePAY, lưu `PaymentTransaction` (kiểm tra trùng lặp giao dịch), khớp `transferContent` và số tiền với `PaymentOrder`.
4. Nếu khớp hợp lệ: cập nhật `PaymentOrder.status = PAID`, kích hoạt `Subscription` hoặc cộng `CreditWallet`.
5. Nếu chuyển sai nội dung/thiếu tiền: ghi nhận trạng thái chờ Admin kiểm duyệt (`POST /admin/billing/orders/review`) hoặc xử lý lại (`reprocess`).

## 5. DỮ LIỆU ĐẦU VÀO & ĐẦU RA (INPUT / OUTPUT)
* **Đầu vào (Input)**: Payload Webhook SePAY (`transferAmount`, `content`, `referenceCode`...).
* **Đầu ra (Output)**: Đơn thanh toán hoàn tất tự động sau vài giây; gói cước/credit được kích hoạt.

## 6. KIỂM SOÁT NGOẠI LỆ, BẢO MẬT & TÍNH TOÀN VẸN
* Chống xử lý trùng lặp webhook (idempotency theo mã giao dịch ngân hàng), xác thực API Key SePAY.

## 7. MỞ KHÓA LUỒNG TIẾP THEO ("MỚI CÓ B")
* **Kích hoạt / Mở khóa**: FLOW-010, FLOW-011

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG

[⬅️ **Luồng trước**: FLOW-011](./FLOW-011-vi-credit-ai-nap-credit-co-che-giu-cho-khau-tru.md) | [📋 **Mục lục 62 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-013](./FLOW-013-ket-noi-meta-fanpage-facebook-oauth-webhook-tin-nhan.md)
