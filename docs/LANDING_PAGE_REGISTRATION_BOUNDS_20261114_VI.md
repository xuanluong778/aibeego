# Sửa tràn khung cụm đếm giờ và form đăng ký

Nguyên nhân: preset trong bản nháp sử dụng hai block float rộng 50%, nhưng Countdown có zoom 1.34. Tổng chiều rộng hiển thị vượt vùng nội dung.

Renderer nhận diện cặp Countdown → LeadForm có biến CSS registration và đặt vào grid có hai cột minmax(0,1fr), giới hạn 1200px và chừa lề theo khung. Gỡ float/zoom trên đúng hai block này. Khi vùng chứa <=780px, chuyển sang một cột. Giữ nguyên dữ liệu giá, CTA, màu sắc, ID và xử lý form; không sửa dữ liệu bản nháp.

Kiểm chứng:
- Regression nhận diện preset cũ, loại trừ block ẩn/tắt/free/nằm trong section và block thông thường: đạt.
- Chrome với bố cục thực tế tại 1440,1280,1100,960,768,390px: form, input, textarea, button, giá trong khung; tràn ngang 0px.
- Canvas scale 0.72: biên thực tế vẫn nằm trong đường giới hạn.
- TypeScript 11 tệp liên quan: 0 lỗi; 23 chẩn đoán từ các dependency ngoài phạm vi đã có trước.

Ảnh và số đo kiểm tra lưu tại .tmp/countdown-bounds (không đưa vào Docker build context).

Triển khai: đã build production và cập nhật container web trên http://localhost:8080; kiểm tra bundle có registration row/grid và health/ready đều HTTP 200.
