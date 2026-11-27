# [FLOW-038] Sáng tạo Nội dung AI, Giọng văn Cá nhân & Kiểm duyệt Chính sách Facebook

> **Tầng nghiệp vụ**: TẦNG 9: SÁNG TẠO NỘI DUNG, TELEPROMPTER & TỰ ĐỘNG ĐĂNG BÀI  
> **Thứ tự thực thi**: 38 / 62  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Chỉ kích hoạt khi các điều kiện tiên quyết đã sẵn sàng.

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT ("CÓ A")
* FLOW-007 (`BusinessProfile`), FLOW-011 (Ví Credit AI).

## 2. TÁC NHÂN THAM GIA (ACTORS)
* Content Marketer / Chuyên gia / AI Writer

## 3. THÀNH PHẦN HỆ THỐNG LIÊN QUAN (CODEBASE ARCHITECTURE)
* **UI Routes**: `/content-marketing`, `/content`.
* **API Endpoints**: `GET/PUT /content-marketing/industry-preference`, `GET/PUT /content-marketing/opinion/voice-profile`, `POST /content-marketing/generate-advanced`, `POST /content-marketing/opinion/generate`, `POST /content-marketing/score`, `POST /content-marketing/facebook-policy/check|rewrite|import-url|analyze-media`, `POST /content-marketing/ad-url-analyze`.
* **Models**: `ContentIndustry`, `ContentMarketingPreference`, `ContentOpinionVoiceProfile`.

## 4. QUY TRÌNH THỰC HIỆN CHI TIẾT (STEP-BY-STEP)
1. Thiết lập Ngành hàng (`ContentIndustry`, `ContentMarketingPreference`) và Hồ sơ giọng văn (`ContentOpinionVoiceProfile`) để AI viết đúng văn phong thương hiệu.
2. Sinh nội dung chuyên sâu (`generate-advanced`), bài chia sẻ quan điểm (`opinion/generate`), gợi ý tiêu đề/CTA, chấm điểm chất lượng bài viết (`score`, `opinion/score-naturalness`).
3. Phân tích URL quảng cáo đối thủ/tham khảo (`ad-url-analyze` an toàn SSRF).
4. Trước khi đăng/chạy ads: chạy công cụ **Kiểm tra Chính sách Facebook** (`facebook-policy/check`, `analyze-media`) phát hiện từ ngữ/hình ảnh vi phạm và viết lại an toàn (`facebook-policy/rewrite`).

## 5. DỮ LIỆU ĐẦU VÀO & ĐẦU RA (INPUT / OUTPUT)
* **Đầu vào (Input)**: Chủ đề, ngành hàng, giọng văn, hoặc URL/media cần kiểm duyệt.
* **Đầu ra (Output)**: Bài viết hoàn chỉnh đạt chuẩn chính sách quảng cáo Facebook.

## 6. KIỂM SOÁT NGOẠI LỆ, BẢO MẬT & TÍNH TOÀN VẸN
* Tiêu thụ credit qua cơ chế Reserve-Commit; bảo vệ SSRF khi fetch URL media ngoài (`facebook-policy-ssrf-fetch.ts`).

## 7. MỞ KHÓA LUỒNG TIẾP THEO ("MỚI CÓ B")
* **Kích hoạt / Mở khóa**: FLOW-039 (Đưa vào Teleprompter quay video), FLOW-040 (Đăng bài Fanpage), FLOW-041 (Chạy Ads)

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG

[⬅️ **Luồng trước**: FLOW-037](./FLOW-037-doi-tra-hang-phan-bo-hoan-tra-doanh-thu-nhap-lai-kho.md) | [📋 **Mục lục 62 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-039](./FLOW-039-quay-video-voi-teleprompter-boc-bang-giong-noi-ai.md)
