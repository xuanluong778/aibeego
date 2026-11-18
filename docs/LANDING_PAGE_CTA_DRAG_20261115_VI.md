# Sửa kéo CTA chỉ di chuyển chữ — 15/11/2026

## Nguyên nhân

Hero và CTA có hai cây render khác nhau. Khi chỉnh sửa, InlineEditable mang cả màu nền và chữ. Ở preview/public, thẻ a bên ngoài mang nền và mũi tên, còn InlineEditable bên trong nhận free layout của ctaLabel. Vì vậy, vị trí đã kéo chỉ di chuyển chữ khi chuyển sang xem trước hoặc tải lại.

## Thay đổi

- Dùng chung một InlineEditable cho Hero CTA và CTA section ở cả hai chế độ.
- Public render thành a có href và mang toàn bộ kiểu nền, padding, bo góc; wrapper free layout bao cả nút.
- Chế độ sửa giữ sự kiện chọn/kéo/chỉnh chữ hiện có và không điều hướng.
- Mũi tên là pseudo-element của cùng nút, không thành nội dung có thể lưu nhầm vào nhãn.
- Giữ nguyên field ctaLabel và key lưu tọa độ để tương thích các vị trí đã lưu. Không chỉnh lại dữ liệu trang của người dùng.

## Kiểm chứng

- Build Web thành công và đã cập nhật container local tại localhost:8080.
- Kiểm tra cú pháp hai file TSX không có lỗi; test cấu trúc chống hồi quy cho Hero CTA và CTA section đã qua.
- Tạo hai bản nháp QA cùng nội dung, một bản ở tọa độ gốc và một bản có offset đã lưu x=140px, y=35px. Sau tải lại, bounding box của nút và bounding box phần chữ đều dịch chuyển đúng 140px/35px, kích thước giữ nguyên. Gradient nền nằm trên chính thẻ a chứa chữ; mũi tên gắn trên cùng thẻ.
- Bấm nút trong bản nháp dẫn đúng tới form. Không gửi form.
- Các bản nháp QA đã được dọn sau kiểm tra. Health, ready và đường dẫn builder trả 200.
- Kết quả đo: `.tmp/lp-conversion/button-move-browser-proof.json`; ảnh trang thật: `.tmp/lp-conversion/cta-button-fixed.jpg`.

Kiểm tra trình duyệt xác nhận preview/public tái hiện tọa độ đã lưu. Không có kiểm thử kéo chuột trong phiên builder đã đăng nhập của người dùng ở lượt này; đường kéo và double-click của editor được giữ nguyên, lỗi nằm ở cây render preview/public.
