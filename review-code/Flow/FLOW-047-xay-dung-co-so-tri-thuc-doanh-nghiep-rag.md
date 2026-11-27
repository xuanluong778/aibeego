# [FLOW-047] Xây dựng Cơ sở Tri thức Doanh nghiệp RAG (Multi-source Ingest & Embedding)

> **Tầng nghiệp vụ**: TẦNG 12: CƠ SỞ TRI THỨC RAG, CHATBOT CSKH & TRỢ LÝ AI NỘI BỘ  
> **Thứ tự thực thi**: 47 / 62  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Chỉ kích hoạt khi các điều kiện tiên quyết đã sẵn sàng.

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT ("CÓ A")
* FLOW-007 (Tổ chức) & FLOW-011 (Ví Credit AI cho quá trình Embedding).

## 2. TÁC NHÂN THAM GIA (ACTORS)
* Quản lý kiến thức / Đào tạo Bot

## 3. THÀNH PHẦN HỆ THỐNG LIÊN QUAN (CODEBASE ARCHITECTURE)
* **UI Routes**: `/knowledge-base`.
* **API Endpoints**: `GET/POST /rag-kb`, `POST /rag-kb/:id/import/text|url|file`, `GET/POST /rag-kb/:id/sources`, `POST /rag-kb/:id/sources/:sourceId/sync`, `POST /rag-kb/:id/reindex`, `POST /rag-kb/:id/search`, `GET /rag-kb/:id/export.md`.
* **Shared Utils & Models**: `rag-source-collect.ts`, `rag-website-markdown.ts`, `ssrf-fetch.ts`, `RagKnowledgeBase`, `RagKbSource`, `RagKbDocument`, `RagKbChunk`.

## 4. QUY TRÌNH THỰC HIỆN CHI TIẾT (STEP-BY-STEP)
1. Tạo Kho tri thức (`POST /rag-kb`) hoặc xem/xuất markdown tổng hợp (`export.md`).
2. Nạp dữ liệu đa nguồn (`RagKbSource` & `RagKbDocument`): (1) Nhập văn bản thuần (`import/text`), (2) Tải file tài liệu PDF/DOCX/TXT (`import/file`), (3) Cào nội dung website chuyển sang Markdown sạch (`import/url` qua `rag-website-markdown.ts` & `ssrf-fetch.ts`), hoặc đồng bộ từ Fanpage/Zalo OA.
3. Hệ thống tách tài liệu thành các đoạn ngữ nghĩa (`RagKbChunk`), gọi OpenAI Embedding tạo vector và lưu chỉ mục.
4. Hỗ trợ đồng bộ lại nguồn (`sources/:sourceId/sync`), đánh chỉ mục lại (`reindex`), kiểm thử truy vấn ngữ nghĩa (`POST /rag-kb/:id/search`) và gán thẳng cho Chatbot (`PATCH /rag-kb/chatbots/:botId`).

## 5. DỮ LIỆU ĐẦU VÀO & ĐẦU RA (INPUT / OUTPUT)
* **Đầu vào (Input)**: File tài liệu, URL website, văn bản FAQ, nguồn đồng bộ.
* **Đầu ra (Output)**: Kho vector `RagKbChunk` chính xác cao làm nền tảng trả lời chống bịa đặt (grounding).

## 6. KIỂM SOÁT NGOẠI LỆ, BẢO MẬT & TÍNH TOÀN VẸN
* Bảo vệ SSRF tuyệt đối khi nhập URL ngoài; dọn dẹp tài liệu/chunk mồ côi khi xóa source.

## 7. MỞ KHÓA LUỒNG TIẾP THEO ("MỚI CÓ B")
* **Kích hoạt / Mở khóa**: FLOW-048, FLOW-049, FLOW-027 (Chatbot trên Landing Page)

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG

[⬅️ **Luồng trước**: FLOW-046](./FLOW-046-chien-dich-tin-nhan-zalo-zns-zbs-messaging-broadcast-da-kenh.md) | [📋 **Mục lục 62 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-048](./FLOW-048-cau-hinh-chatbot-cskh-da-kenh-tich-hop-fanpage-zalo-oa-website.md)
