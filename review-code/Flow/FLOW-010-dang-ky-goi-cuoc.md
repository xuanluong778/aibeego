# [FLOW-010] Đăng ký Gói cước (Subscription & Trial Claim)

> **Tầng nghiệp vụ**: TẦNG 2: THIẾT LẬP TỔ CHỨC, GÓI CƯỚC & PHÂN QUYỀN (ORGANIZATION, SUBSCRIPTION & RBAC)  
> **Thứ tự thực thi**: 10 / 58  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Hoàn thành điều kiện tiên quyết trước khi kích hoạt luồng này.

---

## NỘI DUNG CHI TIẾT LUỒNG NGHIỆP VỤ

* **Điều kiện tiên quyết**: Đã có Tổ chức (FLOW-007).
* **Tác nhân**: Chủ doanh nghiệp.
* **Chi tiết luồng**:
  1. Người dùng vào `/pricing`, xem bảng tính năng của các gói cước.
  2. Nếu là tài khoản mới: Bấm "Kích hoạt dùng thử" (`TrialClaim`). Hệ thống cấp gói Trial 14 ngày không tính phí.
  3. Nếu nâng cấp gói trả phí:
     - Chọn gói (Standard / Pro / Enterprise) và chu kỳ thanh toán (Tháng / Năm).
     - Hệ thống tạo `PaymentOrder`, hiển thị mã QR VietQR động kèm nội dung chuyển khoản duy nhất.
     - Sau khi nhận được thanh toán (qua FLOW-015), webhook kích hoạt `Subscription` mới, cập nhật `PlanUsage` và gia hạn ngày hết hạn.
* **Đầu vào**: Mã gói cước, chu kỳ thanh toán.
* **Đầu ra**: Bản ghi `Subscription` trạng thái `ACTIVE`, mở khóa các hạn ngạch (Quota) về số Landing Page, số Lead, số Email được gửi.
* **Mở khóa**: FLOW-011, FLOW-021, FLOW-038.

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG (NAVIGATION)

[⬅️ **Luồng trước**: FLOW-009 - Phân quyền & Quản lý Vai trò Đội ngũ (RBAC - Roles & Permissions)](./FLOW-009-phan-quyen-quan-ly-vai-tro-doi-ngu.md) | [📋 **Mục lục 58 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-011 - Nạp ví Credit & Trừ điểm dịch vụ AI (Credit Wallet & Usage Metering)](./FLOW-011-nap-vi-credit-tru-diem-dich-vu-ai.md)
