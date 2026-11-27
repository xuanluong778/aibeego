# [FLOW-049] Vận hành Hộp thư Hợp nhất, Tự động Trả lời RAG & Bàn giao Tư vấn viên (Human Handoff)

> **Tầng nghiệp vụ**: TẦNG 12: CƠ SỞ TRI THỨC RAG, CHATBOT CSKH & TRỢ LÝ AI NỘI BỘ  
> **Thứ tự thực thi**: 49 / 62  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Chỉ kích hoạt khi các điều kiện tiên quyết đã sẵn sàng.

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT ("CÓ A")
* FLOW-048 (Chatbot đã gắn kênh và kích hoạt).

## 2. TÁC NHÂN THAM GIA (ACTORS)
* Khách hàng nhắn tin + Chatbot AI + Nhân viên trực Inbox

## 3. THÀNH PHẦN HỆ THỐNG LIÊN QUAN (CODEBASE ARCHITECTURE)
* **UI Routes**: `/chatbot-cskh`, `/messages`, `/messaging`.
* **API Endpoints**: `GET /chatbot-cskh/inbox`, `GET /chatbot-cskh/inbox/unread-summary`, `GET /chatbot-cskh/inbox/:id`, `POST /chatbot-cskh/inbox/:id/read`, `POST /chatbot-cskh/inbox/:id/takeover`, `POST /chatbot-cskh/inbox/:id/reply`, `GET /chatbot-cskh/leads`, `POST /chatbot-cskh/public/message|lead`.
* **Models**: `ChatbotConversation`, `ChatbotMessage`, `ChatbotLead`, `ChatbotUsage`.

## 4. QUY TRÌNH THỰC HIỆN CHI TIẾT (STEP-BY-STEP)
1. Khách nhắn tin từ Messenger, Zalo OA, hoặc Widget Chat Website -> Webhook đưa hội thoại vào `ChatbotConversation` và `ChatbotMessage`.
2. Nếu đang ở chế độ AI: hệ thống truy xuất `RagKbChunk` liên quan nhất (grounding), gọi LLM trả lời tự nhiên và ghi nhận chi phí vào `ChatbotUsage`.
3. Khi khách cung cấp SĐT/tên trong hội thoại: Bot trích xuất tạo `ChatbotLead` và đẩy sang CRM (FLOW-028).
4. Nhân viên CSKH theo dõi tại Hộp thư tập trung (`inbox`, `unread-summary` qua Socket.IO). Khi cần can thiệp trực tiếp: bấm **Tiếp quản** (`POST /inbox/:id/takeover`) -> Bot tạm dừng, nhân viên chat trực tiếp qua `POST /inbox/:id/reply`.

## 5. DỮ LIỆU ĐẦU VÀO & ĐẦU RA (INPUT / OUTPUT)
* **Đầu vào (Input)**: Tin nhắn khách hàng / Phản hồi trực tiếp từ nhân viên.
* **Đầu ra (Output)**: Hội thoại giải đáp 24/7, Lead tự động thu về CRM, chuyển giao mượt mà cho người thật.

## 6. KIỂM SOÁT NGOẠI LỆ, BẢO MẬT & TÍNH TOÀN VẸN
* Tách rõ trạng thái Bot vs Takeover để AI không trả lời đè lên nhân viên đang chat.

## 7. MỞ KHÓA LUỒNG TIẾP THEO ("MỚI CÓ B")
* **Kích hoạt / Mở khóa**: FLOW-028 (Lead mới vào CRM)

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG

[⬅️ **Luồng trước**: FLOW-048](./FLOW-048-cau-hinh-chatbot-cskh-da-kenh-tich-hop-fanpage-zalo-oa-website.md) | [📋 **Mục lục 62 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-050](./FLOW-050-tro-ly-dieu-hanh-ai-noi-bo-voi-tool-calling-xac-nhan-hanh-dong.md)
