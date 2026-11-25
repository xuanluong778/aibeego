# Credit tháng và kiểm tra tính phí — 22/11/2026

Mức giá mặc định trong báo cáo này đã được người dùng tùy chỉnh xuống thấp hơn. Xem [báo cáo rà soát cấu hình mới](credit-costs-review-20261122.md) để biết giá hiện hành và kết quả xác nhận áp dụng.

Đã triển khai và kiểm tra trên **http://localhost:8080**. Basic nhận **5.000**, Pro **15.000**, VIP **45.000 credit mỗi tháng**, cho cả kỳ mua 1/6/12 tháng. Pro/VIP mua 6 tháng vẫn dùng 7 tháng; tháng tặng có hạn mức tháng đầy đủ. Pro 6 tháng giữ 4.800.000đ. Header rút gọn giữ nguyên.

## Kết quả rà soát

| Hạng mục | Trước sửa | Sau sửa / đơn vị cơ bản |
|---|---|---|
| Content AI: bài viết, viết lại, kịch bản, phân tích nội dung | Hàm trừ credit để trống; nhiều lời gọi AI trực tiếp | 40 credit/lời gọi tạo nội dung; gợi ý ngắn 10 |
| Trợ lý AI | Có tính phí theo lượt, nhiều vòng gọi model chưa phản ánh chi phí | 20/lời gọi cơ bản, cộng phần gọi bổ sung/ngữ cảnh dài/model đắt hơn |
| Chatbot web, Messenger, Zalo, chatbot Landing Page | Có wrapper cho gói mới; legacy có nhánh bỏ qua; callback dùng lại reference | 6/câu trả lời AI; reference riêng từng lần; không tính trùng ở gateway |
| Landing Page: tạo nội dung, nâng cấp, gợi ý | Inline hard-code 2; nhiều lời gọi khác chưa qua ledger | Inline 10; tạo nội dung trang 80; bỏ override cố định |
| Phễu, gợi ý canvas | Nhiều lời gọi OpenAI trực tiếp | 60/lời gọi AI |
| Auto Post, Marketing Autopilot | Một số lời gọi AI chưa qua ledger | Áp mức tạo nội dung/gợi ý tương ứng tại gateway |
| Quảng cáo AI, phân tích URL nền | Google draft có wrapper; phân tích URL worker chưa tính phí | 60/lời gọi, cả API và worker |
| Email AI | Đã có wrapper | 10/lời gọi; không tính thêm lần đầu ở gateway |
| Email Marketing, email thử, email qua router | Có quota số email nhưng chưa trừ ví | 2/người nhận; email đã gửi không bị trừ lại khi retry; thiếu credit tạm dừng chiến dịch |
| Phiên âm video | Gói mới đã tính theo đoạn/phút; legacy bỏ qua; làm tròn từng đoạn gây tính dư phần chồng | 100/phút, tính theo giây rồi làm tròn credit; không tính trùng phần âm thanh chồng lấn |
| Knowledge Base | Truy xuất SQL/text và tổng hợp AI là hai việc khác nhau | Truy xuất dữ liệu không tính; tổng hợp bằng AI 10/lời gọi |
| Phân tích ảnh/OCR AI | Chưa qua tính phí thống nhất | 60/ảnh/lời gọi; không tính chuỗi base64 như token văn bản |
| Tạo ảnh AI | Có mã giá dự phòng nhưng không tìm thấy luồng gọi nhà cung cấp tạo ảnh trong mã nguồn hiện tại | Không xác nhận là tính năng đang chạy; mức dự phòng 1.000/ảnh được giữ trong cấu hình, không hiện trong bảng tác vụ khả dụng |
| CRM, lịch hẹn, công việc, HRM, kho, tài chính, xem/sửa dữ liệu, dựng trang thủ công | Không gọi nhà cung cấp AI | Không trừ AI credit |
| Đồng bộ website/Knowledge Base, phản hồi theo luật | Xử lý nội bộ, không có API embeddings trả phí trong luồng hiện tại | Không trừ AI credit; quota tài nguyên vẫn áp dụng |
| OTP, xác thực, email hóa đơn và thông báo hệ thống | Chi phí vận hành nền tảng | Giữ trong phí dịch vụ, không trừ AI credit |
| Ngân sách chạy quảng cáo, Zalo/ZBS và phí tài khoản kết nối ngoài | Do tài khoản/nhà cung cấp ngoài quản lý | Không quy đổi/trừ thêm AI credit khi chỉ gửi qua tài khoản kết nối; phần nội dung AI của các kênh vẫn tính như trên |

Mức trên là **định mức cơ bản**, không phải giá mua API theo token chính xác. Gateway ước lượng độ dài bằng số ký tự đầu vào và mức output yêu cầu: mỗi khối tối đa khoảng 6.000 token là một đơn vị; model mini/nano hệ số 1, GPT-4o/GPT-4.1 tiêu chuẩn hệ số 15, model khác hệ số dự phòng 30. Mỗi ảnh thêm trong một lượt vision tăng số đơn vị. Một thao tác tạo nhiều nội dung hoặc gọi model nhiều vòng có thể dùng nhiều hơn giá cơ bản. Các giá trị lấy từ `credit_feature_pricing`; seed và migration dùng cùng `CREDIT_PRICING`.

## Kịch bản dùng trong 30 ngày

Đây là giả định sử dụng hỗn hợp ở mức cơ bản, không phải cam kết dùng không giới hạn hoặc được dùng hết đồng thời mọi quota tối đa.

| Tác vụ trong tháng | Basic | Pro | VIP |
|---|---:|---:|---:|
| Tạo nội dung (40/lượt) | 30 → 1.200 | 75 → 3.000 | 200 → 8.000 |
| Gợi ý ngắn (10/lượt) | 20 → 200 | 70 → 700 | 120 → 1.200 |
| Trợ lý AI (20/lượt cơ bản) | 20 → 400 | 60 → 1.200 | 200 → 4.000 |
| Chatbot AI (6/câu) | 150 → 900 | 500 → 3.000 | 1.500 → 9.000 |
| Email Marketing (2/người nhận) | 250 → 500 | 1.000 → 2.000 | 3.000 → 6.000 |
| Phiên âm (100/phút) | 5 phút → 500 | 15 phút → 1.500 | 60 phút → 6.000 |
| Gợi ý phễu (60/lượt) | 0 | 10 → 600 | 30 → 1.800 |
| Phân tích AI (30/lượt) | 10 → 300 | 0 | 0 |
| **Tổng dự kiến** | **4.000 / 5.000** | **12.000 / 15.000** | **36.000 / 45.000** |
| **Dự phòng cho tác vụ dài/gọi thêm** | **1.000 (20%)** | **3.000 (20%)** | **9.000 (20%)** |

Hạn mức toàn tháng phân bổ lần lượt khoảng 166, 500 và 1.500 credit/ngày nếu chia đều 30 ngày. Trang giá hiển thị gợi ý này; trang Credit hiển thị bảng mức trừ trực tiếp từ API. Nên xem phân bố sử dụng thực tế sau một chu kỳ để hiệu chỉnh định mức; chưa có dữ liệu nhà cung cấp thực tế của 30 ngày sau thay đổi để khẳng định mọi kiểu sử dụng đều đủ tháng.

## Cơ sở chi phí

Cấu hình local đang dùng `gpt-4o-mini` và `gpt-4o-mini-transcribe`. Giá tham chiếu công khai của GPT-4o mini là $0,15/triệu token vào, $0,60/triệu token ra; giá thực tế tùy model, token và nhà cung cấp tương thích. [Tài liệu giá GPT-4o mini](https://developers.openai.com/api/docs/models/gpt-4o-mini).

Phiên âm có giá tham chiếu khoảng $0,003/phút cho mini-transcribe; worker còn có bước kiểm tra/xử lý lại, nên định mức cao hơn một lượt ASR đơn. [Bảng giá OpenAI](https://developers.openai.com/api/docs/pricing). Amazon SES à la carte có giá gửi cơ bản $0,10/1.000 email, chưa gồm dữ liệu gửi và dịch vụ bổ sung. [Giá SES](https://aws.amazon.com/ses/pricing/).

Để lập kế hoạch nội bộ, có thể dự trù **tối đa 4đ chi phí biến đổi/credit** và giả định tỷ giá dự toán **26.000đ/USD** (đây là giả định, không phải tỷ giá được xác minh hoặc tỷ lệ đổi credit thành tiền). Ngân sách biến đổi theo toàn bộ allowance sẽ là Basic 20.000đ, Pro 60.000đ, VIP 180.000đ/tháng, tương ứng khoảng 5%, 7,5%, 10% giá một tháng. Đây là ngân sách dự toán cho nhà cung cấp, không phải kết luận lợi nhuận: chưa bao gồm máy chủ, lưu trữ, hỗ trợ, phí thanh toán và thuế. Những model/nhà cung cấp hoặc tính năng tạo ảnh mới cần đối chiếu hóa đơn và cấu hình giá riêng trước khi bật.

## Bảo toàn ví và kiểm soát lỗi

- Chỉ khi ví có grant của **đúng kỳ tháng đang hoạt động**, ledger cộng phần chênh lệch từ allowance cũ lên allowance mới. Dùng khóa ví và idempotency để nhiều request đồng thời chỉ cộng một lần. Credit đã tiêu không được cấp lại; phần mua thêm không bị nhân hệ số.
- Credit gói hết hạn cuối kỳ tháng; credit mua thêm tiếp tục được giữ riêng. Các gói mua thêm 500/1.500/5.000 và số tiền của đơn cũ không được sửa trong yêu cầu này.
- Reserve trước khi gọi nhà cung cấp; thiếu credit thì không gọi. Nhà cung cấp trả HTTP lỗi hoặc chưa chấp nhận tác vụ thì hoàn reserve. Nhà cung cấp đã chấp nhận rồi lỗi đọc kết quả/xử lý sau đó thì giữ phí đã phát sinh.
- Wrapper có sẵn bao gồm lần gọi cơ bản đầu tiên. Lần gọi bổ sung hoặc phần model/context đắt hơn được tính thêm; không tính lại toàn bộ hai lần. Phần cộng thêm không tiêu quota số câu chatbot thêm lần nữa.
- Những hàm bắt lỗi rồi trả nội dung dự phòng không thể nuốt lỗi thiếu credit để tiếp tục gọi AI. Nội dung dự phòng thuần quy tắc vẫn không dùng credit.
- Các request AI thiếu định danh tổ chức bị chặn, không có nhánh gọi provider miễn phí không rõ tài khoản.

## Kiểm chứng và giới hạn

Đã chạy `scripts/test-credit-economy.cjs` trên image API candidate với database QA riêng và provider giả: mức trừ 14 loại tác vụ khả dụng; nhiều vòng AI, model đắt/ngữ cảnh dài; ảnh base64; chống chi vượt số dư khi đồng thời; gửi lặp; hoàn reserve; giữ phí sau provider đã chấp nhận; thiếu credit bị bắt rồi trả fallback; tăng allowance giữ phần đã dùng và mua thêm; email router thật và không tính email hệ thống. Không gọi provider trả phí thật.

`scripts/test-credit-economy-worker.cjs` kiểm tra bộ phân tích URL worker thật với database QA/provider giả: trừ 60, chặn duplicate và thiếu credit trước provider; load email/video modules và giữ hai adapter Google Ads cũ. Bộ `test-subscription-tiers.cjs` đạt với allowance mới, chu kỳ tháng, credit tháng tặng và chuyển hạng/gia hạn. Typecheck shared/database/API đạt. Worker còn sáu lỗi đã có từ trước ở SLA và nguồn Google Ads adapter, không thuộc module sửa lần này; runtime overlay giữ các adapter đang chạy đã được xác nhận. Web production build đạt theo cấu hình hiện tại bỏ kiểm tra type/lint; không khẳng định toàn bộ monorepo hết lỗi type.

Migration chỉ sửa catalogue plan và pricing. Đã sao lưu database, so sánh hash trước/sau migration để xác nhận đơn hàng, subscription, ví và lịch sử không bị thay đổi bởi migration. Sau rollout, API khỏe, heartbeat worker mới. `scripts/verify-local-credit-economy.cjs` kiểm tra UI/API trên local: chín gói đúng credit, Pro 6 tháng đúng giá và cả Pro/VIP có tháng tặng; bảng 14 giá; header ngắn; desktop/mobile không tràn ngang và không có lỗi JavaScript. Kiểm thử live chỉ đọc, không tạo đơn/gửi email/gọi AI trả phí.

Artifacts: `tmp/credit-economy-20261122/` chứa `database-before.dump`, `before.json`, `after-migration.json`, `deployment.json`, `economy-test-report.json`, `live-verification.json`, ảnh UI và SQL rollback giá. Image cũ được giữ với tag `before-credit-economy-20261122`. Override cuối khi recreate local: `deploy/local-credit-economy.yml`. Migration: `20261122050000_credit_economy`.
