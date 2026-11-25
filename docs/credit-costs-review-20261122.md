# Rà soát mức Credit costs đã giảm

Đã kiểm tra cấu hình thực tế người dùng lưu khoảng 22:05 ngày 22/11/2026 (Asia/Saigon), và triển khai sửa phân loại tác vụ lên localhost. **Giữ nguyên cả 15 mức credit người dùng vừa đặt.** Không có căn cứ cần tăng lại giá các tác vụ đang hoạt động với model/quota hiện tại.

## Mức đang áp dụng và kiểm thử

| Tác vụ | Giá hiện tại | Kết quả kiểm thử sổ cái |
|---|---:|---|
| Tạo/viết lại nội dung | 20 | Trừ 20 cho một đơn vị; ngữ cảnh dài hai đơn vị trừ 40 |
| Gợi ý ngắn Content | 10 | Đã tách mã riêng `content_ai.suggest`, trừ 10 |
| Trợ lý chat | 10 | Một lời gọi trừ 10; hai lời gọi trừ 20, không trừ lặp lớp ngoài |
| Chatbot | 3 | Trừ 3 |
| Phiên âm | 50/phút | 30 giây trừ 25; vẫn không tính trùng đoạn chồng lấn |
| Gợi ý phễu | 30 | Trừ 30 |
| Email AI | 10 | Trừ 10; chỉnh giá Email không đổi giá gợi ý Content |
| Creative/phân tích URL quảng cáo | 30 | API và bộ phân tích URL worker thật đều trừ 30 với provider giả |
| Knowledge Base tổng hợp AI | 10 | Trừ 10 |
| Phân tích AI | 15 | Trừ 15 |
| Gợi ý chữ Landing Page | 5 | Trừ 5 |
| Tạo nội dung Landing Page | 40 | Trừ 40 |
| Phân tích ảnh/OCR | 30 | Trừ 30 cho một ảnh cơ bản |
| Gửi email Marketing | 2/người nhận | Trừ 2 |

Mức là **giá một đơn vị cơ bản**, không phải giá cố định cho mọi thao tác bất kể kích thước. Nội dung dài, nhiều ảnh, nhiều lời gọi model hoặc model cao cấp vẫn có hệ số như trước. Reservation tạo trước thời điểm đổi giá giữ mức đã tạm giữ; lịch sử không tính lại theo giá mới.

Hai dòng dự phòng được giữ giá nhưng đánh dấu đúng trạng thái trong quản trị:

- `content_ai.image`: 100. Không tìm thấy provider tạo ảnh đang triển khai, nên chưa có tác vụ thực tế trừ theo dòng này. Chưa thể xác nhận giá kinh tế khi chưa chọn model/chất lượng/kích thước; không tự tăng giá một tính năng chưa hoạt động.
- `assistant.write`: 20. Chưa có luồng soạn thảo độc lập gọi mã này. Soạn thảo trong chat hiện đi qua `assistant.chat`. Đã đánh dấu dự phòng để không hiểu nhầm mức 20 đang được dùng cho một luồng riêng.

Bảng người dùng `/credits` chỉ hiển thị 14 dòng có luồng hoạt động; quản trị hiển thị đầy đủ 16 dòng, gồm mục Content gợi ý mới và hai cấu hình dự phòng.

## Đánh giá sử dụng tháng

Giữ cùng kịch bản hỗn hợp đã lập trước, thay bằng giá mới:

| Gói | Credit tháng | Dự kiến dùng | Còn lại |
|---|---:|---:|---:|
| Basic | 5.000 | 2.350 (47%) | 2.650 |
| Pro | 15.000 | 7.350 (49%) | 7.650 |
| VIP | 45.000 | 21.600 (48%) | 23.400 |

Kịch bản Basic: 30 lượt tạo nội dung, 20 gợi ý, 20 lượt trợ lý cơ bản, 150 câu chatbot, 250 email, 5 phút phiên âm, 10 lượt phân tích. Pro: 75 lượt nội dung, 70 gợi ý, 60 trợ lý, 500 chatbot, 1.000 email, 15 phút phiên âm, 10 gợi ý phễu. VIP: 200 nội dung, 120 gợi ý, 200 trợ lý, 1.500 chatbot, 3.000 email, 60 phút phiên âm, 30 gợi ý phễu.

Tăng các khối lượng trên khoảng 1,6 lần sẽ lần lượt tiêu khoảng 3.760, 11.760, 34.560 credit, vẫn dưới 80% hạn mức và nằm trong các quota riêng của từng gói theo kịch bản này. Đây là mô phỏng, không cam kết mọi tác vụ dài/model đắt đều dùng bằng mức cơ bản hoặc mọi kiểu sử dụng đều đủ tháng.

## Cơ sở nhận định chi phí

Runtime chat hiện dùng `gpt-4o-mini`. Giá tham chiếu là $0,15/triệu token vào và $0,60/triệu token ra. [Tài liệu giá model](https://developers.openai.com/api/docs/models/gpt-4o-mini). Worker thực tế dùng `whisper-1` cho lượt đầu và `gpt-4o-transcribe` cho kiểm tra/xử lý lại, không phải cấu hình mini-transcribe của API. Giá tham chiếu gpt-4o-transcribe khoảng $0,006/phút. [Bảng giá OpenAI](https://platform.openai.com/pricing/). SES à la carte có giá gửi cơ bản $0,10/1.000 email, chưa gồm dữ liệu và dịch vụ bổ sung. [Bảng giá SES](https://aws.amazon.com/ses/pricing/).

Lấy giả định dự toán 26.000đ/USD, chưa phải tỷ giá/hóa đơn thực tế: một lượt chat nhỏ và một phút phiên âm vẫn có chi phí biến đổi thấp hơn phần doanh thu phân bổ cho mức credit đang đặt. Ngay kỳ VIP 12 tháng (trả 10 tháng), doanh thu phân bổ khoảng 33,3đ/credit; 50 credit phiên âm tương ứng khoảng 1.666đ doanh thu phân bổ/phút. Phải tính thêm vòng xử lý lại, máy chủ, lưu trữ, hỗ trợ và thuế khi đánh giá lợi nhuận. Không tiếp tục coi giả định dự toán cũ 4đ chi phí/credit là trần chắc chắn sau khi đã giảm mức trừ: cần đối chiếu hóa đơn thật để kiểm tra biên lợi nhuận.

## Lỗi được sửa

1. Gợi ý ngắn của Content/Auto Post/Autopilot trước đây dùng chung `email_ai.subject`. Đã tạo `content_ai.suggest`, giá khởi tạo sao chép giá Email hiện hành (10), để giữ giá thực thu nhưng cho phép chỉnh độc lập.
2. Bộ phân loại trước đây đọc cả query string và không chuẩn hóa chữ hoa/thường. Tham số `suggest`/`industry` có thể làm chọn nhầm mã phí. Đã chỉ xét đường dẫn, chuẩn hóa chữ thường và nhận diện action cuối đường dẫn. `/content-marketing/generate?suggest=true` vẫn tính `content_ai.generate` đúng 20.
3. `assistant.write` chưa có call site riêng nhưng trước đây được đếm là đang hoạt động. Đã đánh dấu dự phòng, đồng thời bổ sung đúng đơn vị ảnh cho dòng tạo ảnh.

## Bằng chứng và phạm vi xác nhận

- `scripts/test-configured-credit-costs.cjs` sao chép **đúng giá đã lưu**, không dùng lại giá mặc định, vào database QA. Kiểm tra 14 tác vụ, phí bổ sung, ngữ cảnh dài, thiếu credit, độc lập giá Content/Email và query string không thể hạ phí. Provider giả, không phát sinh chi phí ngoài.
- `scripts/test-configured-credit-costs-worker.cjs` dùng image worker đang chạy với database QA: kiểm tra đủ giá đã cấu hình, bộ phân tích URL thực trừ 30, phiên âm 30 giây trừ 25.
- Typecheck shared/database/API đạt. Không thay frontend; UI hiện có đọc danh sách và giá từ database.
- `scripts/verify-credit-costs-review.cjs` đọc giá bằng `CreditLedger.getFeatureCost` trực tiếp trong **API và worker local đang chạy**, xác nhận hai bên giống nhau và giữ nguyên 15 giá người dùng đã lưu. Kiểm tra trang quản trị trên desktop/mobile, 14 tác vụ hoạt động, hai dự phòng.
- Tại lúc kiểm tra chưa có giao dịch USAGE mới sau khi người dùng hoàn tất đổi giá. Những dòng -40 trước đó là giao dịch cũ. Do đó kết luận “trừ đúng” dựa vào kiểm thử sổ cái trên QA và đối chiếu runtime/config local, không phải một lượt AI trả phí mới trên tài khoản người dùng.

Không trừ ví người dùng, không gửi email hoặc gọi provider trả phí để kiểm tra. Migration `20261122060000_content_suggestion_credit` chỉ thêm dòng mới, không sửa 15 dòng cũ. Override cuối: `deploy/local-credit-costs-review.yml`; giữ image rollback `aibeego-api:before-credit-costs-review-20261122`. Artifacts: `tmp/credit-costs-review-20261122/` chứa snapshot trước, kết quả test, deployment, kiểm tra live và ảnh UI.
