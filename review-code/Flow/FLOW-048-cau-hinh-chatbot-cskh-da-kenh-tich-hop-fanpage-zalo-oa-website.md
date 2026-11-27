# [FLOW-048] Cấu hình Chatbot CSKH Đa kênh & Tích hợp Fanpage / Zalo OA / Website

> **Tầng nghiệp vụ**: TẦNG 12: CƠ SỞ TRI THỨC RAG, CHATBOT CSKH & TRỢ LÝ AI NỘI BỘ  
> **Thứ tự thực thi**: 48 / 62  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Chỉ kích hoạt khi các điều kiện tiên quyết đã sẵn sàng.

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT ("CÓ A")
* FLOW-047 (Đã có Kho tri thức RAG) & FLOW-013/015 (Đã kết nối Fanpage/Zalo OA nếu bật kênh MXH).

## 2. TÁC NHÂN THAM GIA (ACTORS)
* Quản trị viên CSKH

## 3. THÀNH PHẦN HỆ THỐNG LIÊN QUAN (CODEBASE ARCHITECTURE)
* **UI Routes**: `/chatbot-cskh`.
* **API Endpoints**: `GET/POST/PATCH/DELETE /chatbot-cskh/bots`, `GET /chatbot-cskh/bots/:id/embed`, `POST /chatbot-cskh/bots` + `suggest`, `GET/POST/DELETE /chatbot-cskh/channels`, `POST /chatbot-cskh/zalo-oa/attach`, `POST /chatbot-cskh/facebook/pages`, `POST /chatbot-cskh/facebook/pages/sync-messaging`, `PATCH /chatbot-cskh/settings`.
* **Models**: `ChatbotBot`, `ChatbotKnowledgeSource`, `ChatbotChannel`, `ChatbotOrgSettings`, `ChatbotFacebookPage`.

## 4. QUY TRÌNH THỰC HIỆN CHI TIẾT (STEP-BY-STEP)
1. Tạo/cấu hình Bot (`ChatbotBot`): tên bot, system prompt nhân cách, gợi ý prompt theo ngành (`POST /chatbot-cskh/suggest`), chọn Kho tri thức RAG liên kết (`ChatbotKnowledgeSource`).
2. Cấu hình chế độ thu lead tự động và chính sách trừ credit / giới hạn theo gói (`plan-billed-chat.ts`).
3. Gắn Bot vào các kênh thực tế: Trang Facebook Fanpage (`facebook/pages` + `sync-messaging`), Zalo OA (`zalo-oa/attach`), Website nhúng ngoài (lấy đoạn mã từ `GET /bots/:id/embed`) hoặc nhúng trực tiếp vào Landing Page (FLOW-024).

## 5. DỮ LIỆU ĐẦU VÀO & ĐẦU RA (INPUT / OUTPUT)
* **Đầu vào (Input)**: Prompt nhân cách bot, liên kết RAG KB, kênh hoạt động.
* **Đầu ra (Output)**: Bot CSKH kích hoạt và sẵn sàng tiếp nhận hội thoại khách hàng.

## 6. KIỂM SOÁT NGOẠI LỆ, BẢO MẬT & TÍNH TOÀN VẸN
* Kiểm tra trạng thái OpenAI (`GET /chatbot-cskh/openai/status`) và hạn mức credit/plan trước khi bật.

## 7. MỞ KHÓA LUỒNG TIẾP THEO ("MỚI CÓ B")
* **Kích hoạt / Mở khóa**: FLOW-049

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG

[⬅️ **Luồng trước**: FLOW-047](./FLOW-047-xay-dung-co-so-tri-thuc-doanh-nghiep-rag.md) | [📋 **Mục lục 62 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-049](./FLOW-049-van-hanh-hop-thu-hop-nhat-tu-dong-tra-loi-rag-ban-giao-tu-van-.md)
