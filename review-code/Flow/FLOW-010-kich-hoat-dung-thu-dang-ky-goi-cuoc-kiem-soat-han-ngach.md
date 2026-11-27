# [FLOW-010] Kích hoạt Dùng thử, Đăng ký Gói cước & Kiểm soát Hạn ngạch (Subscription)

> **Tầng nghiệp vụ**: TẦNG 2: TỔ CHỨC, CHI NHÁNH, RBAC & GÓI CƯỚC / CREDIT  
> **Thứ tự thực thi**: 10 / 62  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Chỉ kích hoạt khi các điều kiện tiên quyết đã sẵn sàng.

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT ("CÓ A")
* FLOW-007 (Đã có Tổ chức).

## 2. TÁC NHÂN THAM GIA (ACTORS)
* Chủ doanh nghiệp / Billing Engine

## 3. THÀNH PHẦN HỆ THỐNG LIÊN QUAN (CODEBASE ARCHITECTURE)
* **UI Routes**: `/pricing`, `/finance-billing`.
* **API Endpoints**: `GET /billing/plans`, `GET /billing/subscription`, `GET /billing/entitlements`, `GET /billing/trial/status`, `POST /billing/trial/activate`, `POST /billing/orders`, `POST /billing/orders/:id/cancel`.
* **Interceptors & Models**: `SubscriptionEntitlementInterceptor`, `SubscriptionPlan`, `Subscription`, `TrialSetting`, `TrialClaim`, `PaymentOrder`, `PlanUsage`.

## 4. QUY TRÌNH THỰC HIỆN CHI TIẾT (STEP-BY-STEP)
1. Người dùng vào `/pricing` xem danh sách gói (`GET /billing/plans`) và quyền lợi hiện tại (`GET /billing/entitlements`).
2. Nếu đủ điều kiện dùng thử (`GET /billing/trial/status`), người dùng bấm kích hoạt dùng thử (`POST /billing/trial/activate`) -> tạo `TrialClaim` và đặt `trialStartedAt`/`trialEndsAt`.
3. Nếu mua gói trả phí: gọi `POST /billing/orders` với `planId` -> sinh `PaymentOrder` (mã đơn duy nhất, mã VietQR, thời gian hết hạn `expiresAt`).
4. Sau khi `PaymentOrder` thanh toán thành công (FLOW-012), `Subscription` được kích hoạt/gia hạn và đồng bộ `PlanUsage` + `planBalance` credit hàng tháng.
5. Mọi request tạo mới tài nguyên (Landing Page, Bot, File...) đi qua `SubscriptionEntitlementInterceptor` để kiểm tra hạn mức gói.

## 5. DỮ LIỆU ĐẦU VÀO & ĐẦU RA (INPUT / OUTPUT)
* **Đầu vào (Input)**: Lựa chọn `planId` hoặc kích hoạt Trial.
* **Đầu ra (Output)**: `Subscription` trạng thái `ACTIVE`/`TRIALING`, cập nhật `entitlements` và `PlanUsage`.

## 6. KIỂM SOÁT NGOẠI LỆ, BẢO MẬT & TÍNH TOÀN VẸN
* Mỗi tổ chức/chủ thể chỉ claim dùng thử theo quy định `TrialSetting`; tự động hết hạn `PaymentOrder` quá hạn.

## 7. MỞ KHÓA LUỒNG TIẾP THEO ("MỚI CÓ B")
* **Kích hoạt / Mở khóa**: FLOW-011, FLOW-023, FLOW-038, FLOW-047

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG

[⬅️ **Luồng trước**: FLOW-009](./FLOW-009-phan-quyen-rbac-bao-ve-tai-nguyen-he-thong.md) | [📋 **Mục lục 62 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-011](./FLOW-011-vi-credit-ai-nap-credit-co-che-giu-cho-khau-tru.md)
