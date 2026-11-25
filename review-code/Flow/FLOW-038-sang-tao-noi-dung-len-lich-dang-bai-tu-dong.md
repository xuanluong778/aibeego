# [FLOW-038] Sáng Tạo Nội Dung & Lên Lịch Đăng Bài Tự Động (Content Marketing & Auto-Post)

> **Tầng nghiệp vụ**: TẦNG 9: MARKETING ĐA KÊNH & CHIẾN DỊCH TỰ ĐỘNG (OMNICHANNEL MARKETING & AUTOPILOT)  
> **Thứ tự thực thi**: 38 / 58  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Hoàn thành điều kiện tiên quyết trước khi kích hoạt luồng này.

---

## NỘI DUNG CHI TIẾT LUỒNG NGHIỆP VỤ

* **Điều kiện tiên quyết**: Đã có Doanh nghiệp (FLOW-007), Credit AI (FLOW-011) và Kết nối Fanpage/Zalo (FLOW-012, FLOW-013).
* **Tác nhân**: Marketer / Nhà sáng tạo nội dung.
* **Chi tiết luồng**:
  1. Vào `/content-marketing`, chọn lĩnh vực kinh doanh (`ContentIndustry`) và phong cách giọng văn (`ContentOpinionVoiceProfile`).
  2. Bấm "AI Gợi ý ý tưởng": AI quét xu hướng thị trường và đề xuất 10 chủ đề bài viết tuần này.
  3. Chọn 1 chủ đề, bấm "Tạo bài viết hoàn chỉnh":
     - AI tạo tiêu đề hấp dẫn, nội dung thân bài chuẩn SEO/Facebook, lời kêu gọi hành động (CTA) và bộ hashtag.
     - *Tính năng Teleprompter & Bóc băng video*: Hỗ trợ quay video theo kịch bản nhắc chữ trên màn hình và tự động trích xuất phụ đề (`VideoTranscription`).
  4. Lên lịch đăng bài tự động (`AutoPost`):
     - Chọn kênh đăng: Trang Facebook Fanpage và Zalo OA.
     - Chọn Ngày giờ đăng (ví dụ: Đăng vào khung giờ vàng 11:30 ngày mai).
  5. Đến giờ hẹn: BullMQ Queue gọi Meta Graph API và Zalo API tự động xuất bản bài viết lên các kênh đã chọn.
* **Đầu ra**: Bài viết được đăng đều đặn đa kênh mà không tốn công sức làm tay mỗi ngày.
* **Mở khóa**: FLOW-039 (Lấy bài viết win chuyển thành bài chạy ads).

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG (NAVIGATION)

[⬅️ **Luồng trước**: FLOW-037 - Đổi Trả Hàng, Hoàn Tiền & Nhập Lại Kho (Sales Returns & Refunds)](./FLOW-037-doi-tra-hang-hoan-tien-nhap-lai-kho.md) | [📋 **Mục lục 58 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-039 - Quản Trị & Vận Hành Chiến Dịch Quảng Cáo AI (AI Ads Manager & Autopilot)](./FLOW-039-quan-tri-van-hanh-chien-dich-quang-cao-ai.md)
