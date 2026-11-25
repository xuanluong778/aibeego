# [FLOW-043] Xây Dựng Cơ Sở Tri Thức Doanh Nghiệp (RAG Knowledge Base)

> **Tầng nghiệp vụ**: TẦNG 10: CHĂM SÓC KHÁCH HÀNG THÔNG MINH VỚI AI & CHATBOT (AI CSKH & RAG KNOWLEDGE BASE)  
> **Thứ tự thực thi**: 43 / 58  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Hoàn thành điều kiện tiên quyết trước khi kích hoạt luồng này.

---

## NỘI DUNG CHI TIẾT LUỒNG NGHIỆP VỤ

* **Điều kiện tiên quyết**: Đã có Tổ chức (FLOW-007) và Ví Credit AI (FLOW-011).
* **Tác nhân**: Quản lý / Chuyên viên đào tạo bot.
* **Chi tiết luồng**:
  1. Vào `/knowledge-base`, tạo Cơ sở tri thức (`RagKnowledgeBase`): ví dụ "Cẩm nang Dịch vụ & Bảng giá Spa 2026".
  2. Nạp dữ liệu vào tri thức (`RagKbSource`):
     - Cách 1: Tải lên tài liệu tệp (File PDF, Word, TXT quy trình, tài liệu nội bộ).
     - Cách 2: Nhập đường link Website / Landing page (Hệ thống tự động cào dữ liệu URL).
     - Cách 3: Nhập danh sách câu hỏi thường gặp (Q&A FAQ).
  3. Quá trình xử lý tự động (Embedding Pipeline):
     - Bóc tách văn bản, làm sạch thẻ HTML.
     - Cắt thành từng đoạn ngắn ngữ nghĩa (`RagKbChunk`: 500-1000 tokens).
     - Sử dụng mô hình OpenAI Text-Embedding sinh vector biểu diễn ý nghĩa và lưu vào Database.
* **Đầu ra**: Kho tri thức số hóa độc quyền của doanh nghiệp sẵn sàng phục vụ AI.
* **Mở khóa**: FLOW-044, FLOW-045.

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG (NAVIGATION)

[⬅️ **Luồng trước**: FLOW-042 - Đo Lường Nguồn Gốc & Phân Bổ Chuyển Đổi (Attribution & Meta CAPI)](./FLOW-042-do-luong-nguon-goc-phan-bo-chuyen-doi.md) | [📋 **Mục lục 58 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-044 - Cấu Hình Chatbot CSKH Đa Kênh (Chatbot Setup)](./FLOW-044-cau-hinh-chatbot-cskh-da-kenh.md)
