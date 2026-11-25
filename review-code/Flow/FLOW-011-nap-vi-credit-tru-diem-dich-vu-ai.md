# [FLOW-011] Nạp ví Credit & Trừ điểm dịch vụ AI (Credit Wallet & Usage Metering)

> **Tầng nghiệp vụ**: TẦNG 2: THIẾT LẬP TỔ CHỨC, GÓI CƯỚC & PHÂN QUYỀN (ORGANIZATION, SUBSCRIPTION & RBAC)  
> **Thứ tự thực thi**: 11 / 58  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Hoàn thành điều kiện tiên quyết trước khi kích hoạt luồng này.

---

## NỘI DUNG CHI TIẾT LUỒNG NGHIỆP VỤ

* **Điều kiện tiên quyết**: Đã có Gói cước hoạt động (FLOW-010).
* **Tác nhân**: Người dùng sử dụng các tính năng AI (Viết bài, Tạo landing page, Trả lời CSKH, Phân tích video).
* **Chi tiết luồng**:
  1. Tổ chức sở hữu một ví điểm số (`CreditWallet`).
  2. Nạp thêm Credit: Người dùng vào `/credits`, chọn gói nạp (100k, 500k, 2M credit), thanh toán qua QR. Tiền vào -> Cộng số dư `CreditWallet` và ghi nhận `CreditTransaction`.
  3. Tiêu hao Credit:
     - Khi chạy tác vụ AI (ví dụ: Tạo Landing Page bằng AI mất 50 credits, Phân tích quảng cáo mất 20 credits, Chatbot trả lời mất 1 credit/tin):
     - API kiểm tra số dư: `balance >= requiredCredit`. Nếu không đủ, chặn tác vụ và nhắc nạp tiền.
     - Khóa giao dịch trừ credit (idempotent), lưu nhật ký sử dụng vào `CreditTransaction`.
* **Đầu ra**: Số dư Credit được bảo toàn và hạch toán minh bạch.
* **Mở khóa**: FLOW-021 (AI Builder), FLOW-038 (Content Marketing AI), FLOW-043 (RAG Embedding), FLOW-045 (Chatbot CSKH AI).

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG (NAVIGATION)

[⬅️ **Luồng trước**: FLOW-010 - Đăng ký Gói cước (Subscription & Trial Claim)](./FLOW-010-dang-ky-goi-cuoc.md) | [📋 **Mục lục 58 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-012 - Kết nối Meta Fanpage & Facebook Ads (Meta Integration)](./FLOW-012-ket-noi-meta-fanpage-facebook-ads.md)
