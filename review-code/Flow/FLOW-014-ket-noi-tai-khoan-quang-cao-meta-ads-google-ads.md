# [FLOW-014] Kết nối Tài khoản Quảng cáo Meta Ads & Google Ads

> **Tầng nghiệp vụ**: TẦNG 3: CỔNG THANH TOÁN & TÍCH HỢP KÊNH NGOẠI VI  
> **Thứ tự thực thi**: 14 / 62  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Chỉ kích hoạt khi các điều kiện tiên quyết đã sẵn sàng.

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT ("CÓ A")
* FLOW-007 (Đã có Tổ chức và tài khoản Ad Manager).

## 2. TÁC NHÂN THAM GIA (ACTORS)
* Performance Marketer / Ads Manager

## 3. THÀNH PHẦN HỆ THỐNG LIÊN QUAN (CODEBASE ARCHITECTURE)
* **UI Routes**: `/ads`, `/advertising`.
* **API Endpoints**: `GET /ad-performance/facebook/oauth/start|callback`, `POST /ad-performance/facebook/ad-account|sync`, `GET /ad-performance/google/oauth/start|callback`, `POST /ad-performance/google/customer|accounts|sync`, `/integrations/:provider/connect|test`.
* **Models**: `FacebookAdsConnection`, `AdAccount`, `AdGoogleAdsAccount`, `AdConnection`, `AdPlatformAccount`, `AdsSyncJob`.

## 4. QUY TRÌNH THỰC HIỆN CHI TIẾT (STEP-BY-STEP)
1. Người dùng chọn kết nối Facebook Ads (`ad-performance/facebook/oauth/start`) hoặc Google Ads (`ad-performance/google/oauth/start`) qua OAuth2.
2. Lấy danh sách Ad Account / Google Ads Customer & Sub-accounts -> Người dùng chọn tài khoản cần theo dõi (`POST .../ad-account`, `POST .../accounts`).
3. Kích hoạt đồng bộ dữ liệu (`POST .../sync`) tạo `AdsSyncJob` để kéo chiến dịch (`AdManagerCampaign`, `AdCampaign`), AdSet, Creative và thống kê hàng ngày (`AdDailyStat`, `AdInsight`).
4. Kiểm tra tình trạng kết nối (`test` / `status`) hoặc ngắt kết nối (`DELETE disconnect`) bất cứ lúc nào.

## 5. DỮ LIỆU ĐẦU VÀO & ĐẦU RA (INPUT / OUTPUT)
* **Đầu vào (Input)**: OAuth Token quảng cáo & ID tài khoản Ads.
* **Đầu ra (Output)**: Dữ liệu chiến dịch, từ khóa (`AdKeyword`), search terms và chi phí quảng cáo đồng bộ về hệ thống.

## 6. KIỂM SOÁT NGOẠI LỆ, BẢO MẬT & TÍNH TOÀN VẸN
* Lưu trữ token bảo mật, theo dõi job đồng bộ qua `sync-jobs/:jobId` tránh rate limit của Meta/Google.

## 7. MỞ KHÓA LUỒNG TIẾP THEO ("MỚI CÓ B")
* **Kích hoạt / Mở khóa**: FLOW-041 (AI Ads Manager & Autopilot), FLOW-043 (Attribution)

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG

[⬅️ **Luồng trước**: FLOW-013](./FLOW-013-ket-noi-meta-fanpage-facebook-oauth-webhook-tin-nhan.md) | [📋 **Mục lục 62 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-015](./FLOW-015-ket-noi-zalo-official-account-chinh-sach-nhan-tin.md)
