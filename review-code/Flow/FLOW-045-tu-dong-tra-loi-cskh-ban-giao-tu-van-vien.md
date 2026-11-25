# [FLOW-045] Tự Động Trả Lời CSKH & Bàn Giao Tư Vấn Viên (AI Auto-Reply & Human Handoff)

> **Tầng nghiệp vụ**: TẦNG 10: CHĂM SÓC KHÁCH HÀNG THÔNG MINH VỚI AI & CHATBOT (AI CSKH & RAG KNOWLEDGE BASE)  
> **Thứ tự thực thi**: 45 / 58  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Hoàn thành điều kiện tiên quyết trước khi kích hoạt luồng này.

---

## NỘI DUNG CHI TIẾT LUỒNG NGHIỆP VỤ

* **Điều kiện tiên quyết**: Chatbot đã được cấu hình và kích hoạt (FLOW-044).
* **Tác nhân**: Khách hàng nhắn tin trên Fanpage/Web + Chatbot AI + Nhân viên trực ca.
* **Chi tiết luồng**:
  1. Khách hàng gửi tin nhắn: *"Cho mình hỏi liệu trình trị mụn bên bạn giá bao nhiêu và có cam kết không?"*
  2. Webhook nhận tin, chuyển tới `ChatbotCskhService`:
     - Chuyển câu hỏi của khách thành vector, tìm kiếm ngữ nghĩa trong Kho tri thức RAG (FLOW-043).
     - Lấy ra đoạn văn bản chính xác nhất về bảng giá và cam kết trị mụn.
     - Ghép vào Prompt gửi mô hình ngôn ngữ lớn (LLM) để sinh câu trả lời tự nhiên, lịch sự và chính xác 100% theo chính sách của quán (không bịa đặt thông tin).
  3. Bot gửi câu trả lời lại cho khách trong vòng 2-3 giây.
  4. Thu thập Lead: Khi khách để lại SĐT, Bot nhận diện ngay và tự động tạo Lead vào CRM (FLOW-026).
  5. **Cơ chế Bàn giao Tư vấn viên (Human Handoff)**:
     - Nếu khách gõ cú pháp *"gặp nhân viên"*, *"tư vấn trực tiếp"* hoặc câu hỏi vượt quá phạm vi tri thức:
     - Bot chuyển trạng thái hội thoại sang `HUMAN_TAKOVER`, tạm dừng trả lời tự động.
     - Bắn chuông thông báo cho nhân viên trực ca vào tiếp quản cuộc trò chuyện trên màn hình Live Chat.
* **Đầu ra**: Trực fanpage 24/7/365, không bao giờ để khách chờ đợi, không bỏ sót bất kỳ khách hàng nào.

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG (NAVIGATION)

[⬅️ **Luồng trước**: FLOW-044 - Cấu Hình Chatbot CSKH Đa Kênh (Chatbot Setup)](./FLOW-044-cau-hinh-chatbot-cskh-da-kenh.md) | [📋 **Mục lục 58 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-046 - Đăng Ký Đối Tác Tiếp Thị & Cấp Link Giới Thiệu (Affiliate Onboarding)](./FLOW-046-dang-ky-doi-tac-tiep-thi-cap-link-gioi-thieu.md)
