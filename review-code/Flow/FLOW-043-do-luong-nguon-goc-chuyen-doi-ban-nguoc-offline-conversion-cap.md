# [FLOW-043] Đo lường Nguồn gốc Chuyển đổi (`Attribution`) & Bắn ngược `Offline Conversion CAPI`

> **Tầng nghiệp vụ**: TẦNG 10: QUẢNG CÁO AI, MARKETING AUTOPILOT & PHÂN BỔ (ATTRIBUTION)  
> **Thứ tự thực thi**: 43 / 62  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Chỉ kích hoạt khi các điều kiện tiên quyết đã sẵn sàng.

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT ("CÓ A")
* FLOW-027/028 (Lead có UTM/`fbclid`/`gclid`), FLOW-033/035 (Đơn hàng đã thanh toán), FLOW-041 (Ad Account).

## 2. TÁC NHÂN THAM GIA (ACTORS)
* Attribution Engine / Offline Conversion Worker

## 3. THÀNH PHẦN HỆ THỐNG LIÊN QUAN (CODEBASE ARCHITECTURE)
* **UI Routes**: `/attribution`.
* **API Endpoints**: `GET /attribution/dashboard`, `GET/POST /attribution/leads/:leadId`, `GET /attribution/offline-jobs`, `POST /attribution/offline-jobs/:id/retry`.
* **Models**: `LeadAttribution`, `MarketingFunnelEvent`, `OfflineConversionJob`.

## 4. QUY TRÌNH THỰC HIỆN CHI TIẾT (STEP-BY-STEP)
1. Tổng hợp điểm chạm từ lúc khách nhấp quảng cáo -> xem Landing Page -> gửi Lead -> đặt lịch -> thanh toán đơn hàng (`Order` / `SalesOrder`).
2. Gắn doanh thu thực thu từ đơn hàng ngược về đúng chiến dịch, ad set, mẫu quảng cáo trong `LeadAttribution`.
3. Hệ thống sinh `OfflineConversionJob` gửi tín hiệu chuyển đổi `Purchase` (kèm giá trị thực và dữ liệu hash SĐT/Email) về Meta Conversion API (CAPI) và Google Offline Conversions.
4. Theo dõi trạng thái job và chạy lại (`offline-jobs/:id/retry`) nếu API đối tác gặp lỗi tạm thời.

## 5. DỮ LIỆU ĐẦU VÀO & ĐẦU RA (INPUT / OUTPUT)
* **Đầu vào (Input)**: UTM / Click IDs (`fbclid`, `gclid`) + Dữ liệu đơn hàng `PAID`.
* **Đầu ra (Output)**: Báo cáo ROAS chính xác và tín hiệu tối ưu thuật toán cho Meta/Google Ads.

## 6. KIỂM SOÁT NGOẠI LỆ, BẢO MẬT & TÍNH TOÀN VẸN
* Hash thông tin định danh khách hàng (SHA-256) trước khi gửi Offline Conversion đảm bảo quyền riêng tư.

## 7. MỞ KHÓA LUỒNG TIẾP THEO ("MỚI CÓ B")
* **Kích hoạt / Mở khóa**: FLOW-061 (Báo cáo hiệu quả Marketing & ROI)

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG

[⬅️ **Luồng trước**: FLOW-042](./FLOW-042-chien-dich-marketing-autopilot-tu-dong-co-bao-ve-ngan-sach.md) | [📋 **Mục lục 62 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-044](./FLOW-044-quan-ly-danh-ba-phan-khuc-mau-thu-chien-dich-email-marketing.md)
