# [FLOW-044] Cấu Hình Chatbot CSKH Đa Kênh (Chatbot Setup)

> **Tầng nghiệp vụ**: TẦNG 10: CHĂM SÓC KHÁCH HÀNG THÔNG MINH VỚI AI & CHATBOT (AI CSKH & RAG KNOWLEDGE BASE)  
> **Thứ tự thực thi**: 44 / 58  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Hoàn thành điều kiện tiên quyết trước khi kích hoạt luồng này.

---

## NỘI DUNG CHI TIẾT LUỒNG NGHIỆP VỤ

* **Điều kiện tiên quyết**: Đã có Kho tri thức RAG (FLOW-043) và Kết nối Fanpage (FLOW-012).
* **Tác nhân**: Quản trị viên CSKH.
* **Chi tiết luồng**:
  1. Vào `/chatbot-cskh`, tạo Bot mới (`ChatbotBot`):
     - Đặt tên Bot (ví dụ: "Trợ lý ảo Mai Anh").
     - Định nghĩa Nhân cách & Giọng điệu (System Prompt: Thân thiện, lễ phép, dạ vâng, chuyên môn sâu về làm đẹp).
     - Gán Kho tri thức RAG (FLOW-043) làm "bộ não" tham chiếu cho bot.
  2. Cấu hình kịch bản Thu thập Lead tự động:
     - Bot chủ động hỏi khéo léo để lấy Họ tên và Số điện thoại của khách trước khi tư vấn sâu.
  3. Kích hoạt kênh hoạt động:
     - Gắn Bot vào Trang Facebook Fanpage (`ChatbotFacebookPage`).
     - Nhúng Widget Chatbot lên các trang Landing Page của doanh nghiệp.
* **Đầu ra**: Chatbot AI sẵn sàng trực chiến 24/7 trên Fanpage và Website.
* **Mở khóa**: FLOW-045.

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG (NAVIGATION)

[⬅️ **Luồng trước**: FLOW-043 - Xây Dựng Cơ Sở Tri Thức Doanh Nghiệp (RAG Knowledge Base)](./FLOW-043-xay-dung-co-so-tri-thuc-doanh-nghiep.md) | [📋 **Mục lục 58 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-045 - Tự Động Trả Lời CSKH & Bàn Giao Tư Vấn Viên (AI Auto-Reply & Human Handoff)](./FLOW-045-tu-dong-tra-loi-cskh-ban-giao-tu-van-vien.md)
