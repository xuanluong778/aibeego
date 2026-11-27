# [FLOW-041] Quản lý Quảng cáo AI (AI Ads Manager, Google Campaign Builder & Ads Actions)

> **Tầng nghiệp vụ**: TẦNG 10: QUẢNG CÁO AI, MARKETING AUTOPILOT & PHÂN BỔ (ATTRIBUTION)  
> **Thứ tự thực thi**: 41 / 62  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Chỉ kích hoạt khi các điều kiện tiên quyết đã sẵn sàng.

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT ("CÓ A")
* FLOW-014 (Đã kết nối Meta Ads / Google Ads) & FLOW-026 (Đã có Landing Page đích).

## 2. TÁC NHÂN THAM GIA (ACTORS)
* Media Buyer / AI Ads Manager

## 3. THÀNH PHẦN HỆ THỐNG LIÊN QUAN (CODEBASE ARCHITECTURE)
* **UI Routes**: `/ads`, `/advertising`.
* **API Endpoints**: `GET /ai-ads-manager/dashboard`, `GET/POST /ai-ads-manager/rules`, `PATCH /ai-ads-manager/settings/auto-mode|emergency-stop`, `POST /ai-ads-manager/drafts/generate|publish`, `/ai-ads-manager/google/campaign-builder/*`, `/ai-ads-manager/google/autopilot/*`, `POST /ads-actions/propose|submit|approve|reject`.
* **Models**: `AdManagerCampaign`, `AdInsight`, `AdAutomationRule`, `AdAutomationLog`, `AdDraft`, `GoogleAdsCampaignDraft`, `GoogleAdsCampaignDeployment`, `GoogleAdsAutopilotConfig`, `GoogleAdsAutopilotProposal`, `AdsActionRequest`.

## 4. QUY TRÌNH THỰC HIỆN CHI TIẾT (STEP-BY-STEP)
1. Xem tổng quan chỉ số Meta & Google Ads tại `/ads` (`GET /ai-ads-manager/dashboard`).
2. Dùng AI sinh nháp quảng cáo (`drafts/generate` -> `drafts/publish`) hoặc trình dựng chiến dịch Google Ads theo quy trình 4 bước: `create draft` -> `preview` -> `preflight` -> `approve` -> `deploy`.
3. Cấu hình Quy tắc Tự động (`AdAutomationRule`) hoặc Google Autopilot (`proposals`, `scan`, `optimization/analyze`).
4. Mọi thao tác nhạy cảm lên ngân sách/bật-tắt đều có thể đi qua luồng phê duyệt `AdsActionRequest` (`propose` -> `submit` -> `approve`/`reject`) hoặc bật cầu dao ngắt khẩn cấp (`emergency-stop`).

## 5. DỮ LIỆU ĐẦU VÀO & ĐẦU RA (INPUT / OUTPUT)
* **Đầu vào (Input)**: Mục tiêu, ngân sách, từ khóa/creative, quy tắc tối ưu.
* **Đầu ra (Output)**: Chiến dịch chạy trên Meta/Google kèm nhật ký tối ưu tự động.

## 6. KIỂM SOÁT NGOẠI LỆ, BẢO MẬT & TÍNH TOÀN VẸN
* Nút dừng khẩn cấp (`emergency-stop`), bước `preflight` kiểm tra trước khi deploy Google Ads, cơ chế duyệt người dùng cho action rủi ro.

## 7. MỞ KHÓA LUỒNG TIẾP THEO ("MỚI CÓ B")
* **Kích hoạt / Mở khóa**: FLOW-042, FLOW-043

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG

[⬅️ **Luồng trước**: FLOW-040](./FLOW-040-len-lich-tu-dong-dang-bai-len-meta-fanpage.md) | [📋 **Mục lục 62 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-042](./FLOW-042-chien-dich-marketing-autopilot-tu-dong-co-bao-ve-ngan-sach.md)
