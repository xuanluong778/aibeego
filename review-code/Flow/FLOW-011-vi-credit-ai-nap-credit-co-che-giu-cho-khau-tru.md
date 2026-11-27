# [FLOW-011] Ví Credit AI: Nạp Credit & Cơ chế Giữ chỗ / Khấu trừ (Reserve-Commit-Release)

> **Tầng nghiệp vụ**: TẦNG 2: TỔ CHỨC, CHI NHÁNH, RBAC & GÓI CƯỚC / CREDIT  
> **Thứ tự thực thi**: 11 / 62  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Chỉ kích hoạt khi các điều kiện tiên quyết đã sẵn sàng.

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT ("CÓ A")
* FLOW-010 (Tổ chức có ví `CreditWallet` và gói cước).

## 2. TÁC NHÂN THAM GIA (ACTORS)
* Người dùng tính năng AI / `CreditContextInterceptor`

## 3. THÀNH PHẦN HỆ THỐNG LIÊN QUAN (CODEBASE ARCHITECTURE)
* **UI Routes**: `/credits`.
* **API Endpoints**: `GET /credits/balance`, `GET /credits/packages`, `GET /credits/pricing`, `GET /credits/history`, `POST /billing/credit-orders`.
* **Interceptors & Models**: `CreditContextInterceptor`, `OpenaiService`, `CreditWallet`, `CreditPackage`, `CreditFeaturePricing`, `CreditTransaction`.

## 4. QUY TRÌNH THỰC HIỆN CHI TIẾT (STEP-BY-STEP)
1. Xem số dư khả dụng (`balance`), số đang tạm giữ (`reservedBalance`), credit theo chu kỳ gói (`planBalance`) và lịch sử (`GET /credits/history`).
2. Nạp thêm credit: chọn `CreditPackage` -> `POST /billing/credit-orders` -> thanh toán qua FLOW-012 -> cộng vào `balance` (credit mua thêm không hết hạn theo tháng).
3. Khi gọi tính năng AI (tạo Landing Page, viết Content, RAG Chat, phân tích Ads, bóc băng video): `CreditContextInterceptor` tra bảng giá `CreditFeaturePricing`.
4. Hệ thống thực hiện **Reserve** (chuyển tạm credit sang `reservedBalance`) trước khi gọi OpenAI; nếu AI thành công -> **Commit** (trừ thật và ghi `CreditTransaction`); nếu AI lỗi -> **Release** (hoàn lại `balance`).

## 5. DỮ LIỆU ĐẦU VÀO & ĐẦU RA (INPUT / OUTPUT)
* **Đầu vào (Input)**: `creditPackageId` khi mua hoặc `featureCode` khi tiêu thụ AI.
* **Đầu ra (Output)**: Số dư `CreditWallet` chuẩn xác và nhật ký `CreditTransaction` minh bạch.

## 6. KIỂM SOÁT NGOẠI LỆ, BẢO MẬT & TÍNH TOÀN VẸN
* Cơ chế 2-phase Reserve/Commit/Release tránh mất tiền oan khi API AI lỗi hoặc timeout; chặn tác vụ ngay nếu `balance` không đủ.

## 7. MỞ KHÓA LUỒNG TIẾP THEO ("MỚI CÓ B")
* **Kích hoạt / Mở khóa**: FLOW-023 (AI Builder), FLOW-038 (Content AI), FLOW-039 (Video AI), FLOW-047 (RAG), FLOW-049 (AI Chat)

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG

[⬅️ **Luồng trước**: FLOW-010](./FLOW-010-kich-hoat-dung-thu-dang-ky-goi-cuoc-kiem-soat-han-ngach.md) | [📋 **Mục lục 62 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-012](./FLOW-012-thanh-toan-vietqr-dong-tu-dong-doi-soat-webhook-sepay.md)
