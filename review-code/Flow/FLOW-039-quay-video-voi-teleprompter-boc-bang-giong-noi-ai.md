# [FLOW-039] Quay Video với Teleprompter & Bóc băng Giọng nói AI (Video Transcription)

> **Tầng nghiệp vụ**: TẦNG 9: SÁNG TẠO NỘI DUNG, TELEPROMPTER & TỰ ĐỘNG ĐĂNG BÀI  
> **Thứ tự thực thi**: 39 / 62  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Chỉ kích hoạt khi các điều kiện tiên quyết đã sẵn sàng.

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT ("CÓ A")
* FLOW-038 (Có kịch bản nội dung) & FLOW-011 (Credit AI).

## 2. TÁC NHÂN THAM GIA (ACTORS)
* Nhà sáng tạo nội dung / Chuyên gia / Chủ Spa

## 3. THÀNH PHẦN HỆ THỐNG LIÊN QUAN (CODEBASE ARCHITECTURE)
* **UI Routes**: `/teleprompter`.
* **API Endpoints**: `POST /content-marketing/teleprompter/rewrite|teleprompter-source`, `GET /content-marketing/teleprompter-signed/:id`, `POST /video-transcriptions`, `POST /video-transcriptions/probe-url`, `GET /video-transcriptions/glossary`, `GET /video-transcriptions/:id/download-video|download-transcript`.
* **Models**: `ContentTeleprompterSource`, `ContentTeleprompterRecording`, `VideoTranscription`, `VideoTranscriptionGlossary`.

## 4. QUY TRÌNH THỰC HIỆN CHI TIẾT (STEP-BY-STEP)
1. **Quay Video Teleprompter**: Đưa kịch bản vào `/teleprompter` (hoặc nhờ AI viết lại cho văn nói qua `teleprompter/rewrite`). Mở camera quay video với chữ chạy trên màn hình và tải bản ghi an toàn qua signed download URL.
2. **Bóc băng Video AI**: Nhập link video hoặc tải video lên (`POST /video-transcriptions`, kiểm tra trước bằng `probe-url`).
3. Hệ thống chia nhỏ âm thanh, dùng từ điển chuyên ngành (`VideoTranscriptionGlossary`) để chuyển giọng nói thành văn bản chính xác cao (hỗ trợ `retry-chunk` nếu đoạn lỗi) và cho phép tải bản chép lời (`download-transcript`).

## 5. DỮ LIỆU ĐẦU VÀO & ĐẦU RA (INPUT / OUTPUT)
* **Đầu vào (Input)**: Kịch bản văn bản hoặc Video/URL cần bóc băng.
* **Đầu ra (Output)**: Video hoàn chỉnh & Bản transcript văn bản tái sử dụng cho bài viết/KB.

## 6. KIỂM SOÁT NGOẠI LỆ, BẢO MẬT & TÍNH TOÀN VẸN
* Signed URL có chữ ký hết hạn cho file video quay; xử lý nền theo chunk với cơ chế retry/cancel.

## 7. MỞ KHÓA LUỒNG TIẾP THEO ("MỚI CÓ B")
* **Kích hoạt / Mở khóa**: FLOW-040 (Đăng video lên mạng xã hội), FLOW-047 (Nạp transcript vào Kho tri thức RAG)

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG

[⬅️ **Luồng trước**: FLOW-038](./FLOW-038-sang-tao-noi-dung-ai-giong-van-ca-nhan-kiem-duyet-chinh-sach-f.md) | [📋 **Mục lục 62 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-040](./FLOW-040-len-lich-tu-dong-dang-bai-len-meta-fanpage.md)
