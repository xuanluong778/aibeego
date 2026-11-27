# [FLOW-052] Theo dõi Click/Referral, Tính Hoa hồng & Kiểm duyệt Gian lận

> **Tầng nghiệp vụ**: TẦNG 13: TIẾP THỊ LIÊN KẾT (AFFILIATE MARKETING)  
> **Thứ tự thực thi**: 52 / 62  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Chỉ kích hoạt khi các điều kiện tiên quyết đã sẵn sàng.

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT ("CÓ A")
* FLOW-051 (Đã có Link giới thiệu) & FLOW-035 (Đơn hàng phát sinh thanh toán).

## 2. TÁC NHÂN THAM GIA (ACTORS)
* Người mua qua link + Hệ thống Tracking + Admin duyệt hoa hồng

## 3. THÀNH PHẦN HỆ THỐNG LIÊN QUAN (CODEBASE ARCHITECTURE)
* **UI Routes**: `/affiliate`, `/admin/affiliate`.
* **API Endpoints**: `POST /affiliate/track`, `GET /affiliate/referrals|commissions`, `GET /admin/affiliate/referrals|commissions|fraud`, `POST /admin/affiliate/commissions/:id/approve|reverse`.
* **Models**: `AffiliateClick`, `AffiliateReferral`, `AffiliateCommission`, `AffiliateFraudSignal`.

## 4. QUY TRÌNH THỰC HIỆN CHI TIẾT (STEP-BY-STEP)
1. Khi khách truy cập qua link gắn mã ref -> gọi `POST /affiliate/track` lưu `AffiliateClick` (IP, User-Agent, trang đích).
2. Khi khách đăng ký hoặc mua hàng thành công -> sinh `AffiliateReferral` và bản ghi hoa hồng `AffiliateCommission`.
3. Hệ thống tự động quét dấu hiệu bất thường (`AffiliateFraudSignal`, ví dụ: tự mua cho chính mình cùng IP/SĐT).
4. Admin kiểm tra hoa hồng (`admin/affiliate/commissions`): bấm **Duyệt** (`approve`) sau khi qua thời hạn đổi trả hoặc **Thu hồi** (`reverse`) nếu đơn bị hủy/hoàn trả/gian lận.

## 5. DỮ LIỆU ĐẦU VÀO & ĐẦU RA (INPUT / OUTPUT)
* **Đầu vào (Input)**: Click ref link, đơn hàng quy đổi hợp lệ.
* **Đầu ra (Output)**: Số dư hoa hồng được duyệt khả dụng cho đối tác.

## 6. KIỂM SOÁT NGOẠI LỆ, BẢO MẬT & TÍNH TOÀN VẸN
* Phát hiện self-referral / trùng IP qua `AffiliateFraudSignal`; hỗ trợ `reverse` hoa hồng khi đơn hàng hoàn trả.

## 7. MỞ KHÓA LUỒNG TIẾP THEO ("MỚI CÓ B")
* **Kích hoạt / Mở khóa**: FLOW-053

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG

[⬅️ **Luồng trước**: FLOW-051](./FLOW-051-dang-ky-doi-tac-affiliate-cau-hinh-hoa-hong-cap-link-gioi-thie.md) | [📋 **Mục lục 62 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-053](./FLOW-053-cau-hinh-tai-khoan-nhan-tien-yeu-cau-rut-chi-tra-hoa-hong.md)
