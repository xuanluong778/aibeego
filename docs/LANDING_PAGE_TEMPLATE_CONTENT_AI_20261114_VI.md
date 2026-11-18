# Tạo nội dung cho mẫu bằng AI — triển khai và kiểm thử

## Tiếp tục hoàn thiện ngày 14/11/2026

Phần này cập nhật bản triển khai bên dưới; các giới hạn của bản đầu được ghi lại để đối chiếu lịch sử.

- Bản sửa hiện có đã mở rộng ánh xạ sang SEO title/meta description, alt ảnh, FAQ, chữ và placeholder của form, chữ quanh countdown và các trường hiển thị đang trống. Các khối trùng loại dùng vai trò riêng theo dàn ý chung. Khi thiếu dữ liệu thật, màn hình duyệt có thao tác ẩn demo cần người dùng chọn.
- Đã sửa nhận diện nguồn: từng đề xuất có `source: ai | fallback | user`. Kết quả tổng thể dùng `mixed` khi có cả chữ AI được chấp nhận và gợi ý dự phòng sẵn sàng. Một phản hồi AI thành công nhưng không có câu nào được chấp nhận phải mang nguồn `fallback`.
- Vị trí AI bỏ sót có chẩn đoán `AI_SLOT_MISSING`; màn hình duyệt hiển thị lời giải thích tiếng Việt thay cho mã lỗi kỹ thuật. Nội dung người dùng sửa trong bảng duyệt được lưu với nguồn `user` và được bảo vệ ở lần tạo tiếp theo.
- Cập nhật bộ kiểm thử cũ theo hành vi mới: cho phép các trường hiển thị trống, copy form và SEO, đồng thời tiếp tục kiểm tra cấu hình form, đích CTA, bố cục, thao tác khóa và xung đột khi áp dụng.

Kiểm chứng trong lượt tiếp tục: 38 kiểm tra shared cũ đã cập nhật, 24 kiểm tra shared v2, 14 kiểm tra service với provider/database giả lập, 22 kiểm tra Prisma/service thật trong transaction được rollback và 4 kiểm tra phân quyền qua HTTP đều đạt. Build shared/database/API và production build web đều đạt. Kiểm tra TypeScript riêng cho logic shared và dialog đạt; Next.js vẫn bỏ qua full web typecheck/lint theo cấu hình sẵn có.

API và web đã được cập nhật trong Docker local tại `http://localhost:8080`. Chưa triển khai production.

Kiểm tra trình duyệt: 50 kiểm tra đạt trên hai trang QA riêng, gồm chọn từng khối, sửa thủ công và xác nhận vị trí được bảo vệ, autosave, undo/redo, tải lại, publish trang thử và metadata title/description/Open Graph. Preview có Desktop/Tablet/Mobile; trang public kiểm tra ở 1440/768/390 px, không tràn ngang hoặc cắt chữ ở các phần tử được đo, mỗi trang có một H1, các CTA được đo có nhãn và độ tương phản từ 7,98:1 trở lên.

Rà ảnh đã phát hiện thêm bảy câu suy diễn trong lần gọi AI thật (kết quả học tập, tài liệu và xu hướng). Đã mở rộng kiểm tra hồi quy và bộ kiểm chứng để từ chối các câu này khi không có dữ liệu xác nhận. Kiểm tra trình duyệt cuối tái sử dụng đề xuất từ lần gọi AI thật sau khi duyệt lại bằng validator mới, tránh gọi provider thêm; mẫu sản phẩm dùng fallback xác định. Bộ kiểm chứng vẫn có tính quy tắc, không thay thế bước người dùng duyệt tính đúng đắn của nội dung trước khi xuất bản.

Đã nạp API local bản cuối và chạy lại 14 kiểm tra service thành công. Tổ chức QA tạm cùng hai trang thử và ảnh thử đã được dọn, xác nhận không còn tổ chức QA vừa tạo. Không ghi lên trang gốc của người dùng.

Ngày: 14/11/2026. Môi trường đã cập nhật: Docker local, http://localhost:8080. Chưa triển khai lên VPS/production.

## Kết quả

Đã đọc `Tu-van-Tao-nhanh-noi-dung-Landing-Page.md` và đối chiếu mockup trước khi triển khai. Builder có nút riêng **Tạo nội dung cho mẫu bằng AI** cho trang tạo từ template JSON dạng khối, có quyền `lead.write`, không bị archive và không phải tài liệu HTML import. Đã bỏ giới hạn chỉ nhóm `product` để hỗ trợ cả template Agency người dùng đang mở.

Luồng **Tạo Landing Page bằng AI** hiện có được giữ nguyên. Tính năng mới dùng chung OpenAiService nhưng trả đề xuất theo vị trí, không dùng hàm dựng lại trang hoặc hàm đổi theme.

Người dùng nhập tên sản phẩm, thương hiệu, đặc điểm/mô tả, khách hàng và mục tiêu Bán hàng/Nhận tư vấn. Thương hiệu được điền sẵn từ hồ sơ doanh nghiệp nếu có; dữ liệu đang nhập không bị ghi đè. Giá, ưu đãi, chính sách và đánh giá là tùy chọn. Có tải ảnh, chọn nhiều ảnh từ thư viện tổ chức và đặt ảnh chính.

Màn hình duyệt có cấu trúc trang, preview trên mẫu và bảng đề xuất theo khối, với chuyển Desktop/Mobile, sửa chữ, đổi ảnh, viết lại một khối, chọn từng vị trí/từng khối hoặc chọn tất cả vị trí đủ dữ liệu. Nội dung thiếu dữ liệu có nhãn **Cần bổ sung** và hiển thị nội dung mẫu để rà soát.

## Các mẫu đã kiểm thử

| Mẫu | Slug ổn định | Cấu trúc khác biệt đã kiểm tra |
| --- | --- | --- |
| Ra mắt sản phẩm · Buy Path | `product-launch` | Thư viện ảnh trước đầu trang, sau đó lợi ích và thông tin mua |
| Ra mắt sản phẩm · Trust Reviews | `product-launch-trust-reviews` | Đầu trang trước, chính sách/lợi ích ở vị trí khác, sau đó ảnh và giá |
| Agency Portfolio · Cream Editorial Sales | `agency-portfolio-cream-editorial` | Cấu trúc Agency/dịch vụ; mẫu trong trang người dùng phản ánh thiếu nút |

Đã kiểm thử cả catalog trong mã nguồn và tạo bản nháp từ ba template đang lưu trong database local. Cơ chế ánh xạ dùng cấu trúc block có sẵn, nhưng chưa kiểm chứng trực quan toàn bộ các mẫu khác.

## Giữ nội dung và thiết kế

- Mỗi đề xuất tham chiếu ID block, ID item nếu có và trường trong danh sách cho phép. Item đổi thứ tự vẫn được tìm theo ID, không theo chỉ số mảng. Không nhận đường dẫn JSON tùy ý do model trả về.
- Preview được dựng bằng bản sao qua LandingPageRenderer và LandingPagePreviewViewport hiện có. Xem trước, sửa đề xuất và viết lại không ghi bản nháp.
- Không biến các trường tùy chọn đang trống thành phần tử hiển thị mới. Chỉ thay chữ/ảnh tại vị trí đang có; không thêm/xóa block hay item.
- Khi áp dụng, clone bản mới nhất từ `specRef`, kiểm tra thay đổi kể từ snapshot, rồi chỉ ghi các trường đã chọn. Không thay theme, token màu, style/font, hiệu ứng, vị trí/kích thước, biểu mẫu, navigation hay URL/đích CTA.
- Nội dung đã chỉnh thủ công được bỏ chọn mặc định. Muốn thay phải xác nhận riêng. Xác nhận gắn với giá trị hiện tại; nếu vị trí thay đổi lần nữa thì phải duyệt lại. Vị trí đã khóa/ẩn/xóa không được cập nhật âm thầm.
- Toàn bộ lần áp dụng đi qua một `pushHistory`. Dùng lại undo/redo, autosave có revision/request ID và cơ chế xử lý xung đột hiện có. Không tự publish.
- Nếu giá trị thay đổi trong khi kiểm tra ảnh trước áp dụng, callback vẫn đối chiếu với `specRef` mới nhất. Có xung đột thì chưa commit lần áp dụng.

## Dữ liệu thực và quyền truy cập

- Endpoint mới: `POST /landing-pages/:id/ai-template-content` và `POST /landing-pages/:id/ai-template-content/validate-images`. Cả hai dùng JWT, TenantGuard, PermissionsGuard và yêu cầu `lead.write`.
- Kiểm tra trang theo tổ chức, trạng thái sửa được, quyền truy cập template và nhóm mẫu trước khi gọi AI. Có giới hạn tần suất và idempotency tách biệt với generator cũ.
- Ảnh đầu vào chỉ là ID thuộc thư viện lấy từ API media hiện có; URL được server giải quyết. Không nhận URL ảnh tự do từ AI. Các ID ảnh đã duyệt được kiểm tra lại trước áp dụng, kể cả ảnh vừa đổi trong màn hình duyệt.
- Dùng lại upload-image và media theo tổ chức. Ảnh chính được ưu tiên cho ảnh Hero. Giữ cách fit/crop và style ảnh hiện tại của mẫu.
- AI không được cấp nội dung mẫu như dữ liệu sản phẩm thật. Chi tiết, lợi ích và mô tả phải bám trích đoạn dữ liệu đã cung cấp. Tiêu đề/nút có tập cách diễn đạt an toàn; kết quả không hợp lệ được thay bằng đề xuất có căn cứ hoặc đánh dấu thiếu.
- Giá, chính sách và đánh giá được ánh xạ từ trường đã xác nhận, không để model tự tạo. Một giá không tự gán cho nhiều gói khác nhau. Đánh giá dùng định dạng `tên | đánh giá`; chỉ điền vào vị trí đánh giá đã có.
- Khi provider không sẵn sàng hoặc kết quả không hợp lệ, thông báo rõ nguồn tham khảo/fallback. Không gắn fallback thành kết quả provider thành công.

## Kiểm thử đã chạy

**117 kiểm tra mới đạt** sau bản sửa hiển thị nút cho Agency, ngoài canary AI thật và các bộ hồi quy bên dưới.

| Bộ kiểm tra | Kết quả | Phạm vi |
| --- | --- | --- |
| `scripts/test-landing-page-template-content.ts` | 38 đạt | Ba catalog thật; áp dụng theo ID; một khối/toàn bộ; giữ cấu trúc/design/form/đích nút; snapshot; dữ liệu thiếu; grounding; khóa phần tử; đổi thứ tự item; xác nhận giá trị vừa sửa; roundtrip qua bộ chuẩn hóa autosave |
| `scripts/test-landing-page-template-content-service.cjs` | 12 đạt | Class API biên dịch thật, mock I/O/provider; quyền trang, ảnh ngoài thư viện, ảnh đã mất, archive, thiếu template, metadata quyền controller, idempotency, rewrite theo block và generation không ghi trang |
| `scripts/test-landing-page-template-content-database.cjs` | 22 đạt | Prisma và service thật; tạo ba trang từ template database, upload ảnh thật, tìm ảnh trong thư viện, generation không đổi draft, từ chối trang/ảnh không hợp lệ, autosave rồi đọc lại chữ/ảnh/design, lưu bản undo; rollback toàn bộ fixture và xóa file ảnh thử |
| `scripts/qa-landing-page-template-content.cjs` | 45 đạt | Builder production thật, API fixture được chặn trong trình duyệt; cả ba mẫu; Desktop/Mobile; upload/chọn ảnh chính; sửa chữ/đổi ảnh; áp dụng một khối và toàn bộ; undo/redo; reload sau autosave; thiếu dữ liệu; rewrite một khối; lỗi generation giữ draft; màn hình trình duyệt 390 px; nút đầy đủ ở viewport 1534 px của trang Agency |
| `scripts/canary-landing-page-template-content.cjs` | Đạt | Gọi provider đang cấu hình thật, `source=ai`, 21 vị trí đầu trang/lợi ích, 7 vị trí đủ dữ liệu và 14 vị trí thiếu với brief chỉ có hai đặc điểm; kiểm tra grounding; không ghi trang |
| Build shared, database, API | Đạt | TypeScript build thực tế trong Docker |
| Production build web | Đạt | Next.js build. Cấu hình dự án hiện có bỏ qua lint và full web typecheck trong build; không xem đây là chứng nhận full typecheck/lint |
| Endpoint không đăng nhập | HTTP 401 | Smoke route mới trên local |

Đã chạy thêm các bộ hồi quy hiện có:

- Autosave identity: **14/14 đạt**, bao gồm request ID, retry nguyên payload và bảo vệ bản nháp khi nhiều tab lưu.
- AI generation: **đạt**, gồm 200 mẫu catalog, dữ liệu có căn cứ, sửa kết quả lỗi, idempotency và giữ nội dung người dùng.
- AI brief suggestion: **đạt**, gồm dữ liệu trống, fallback có thông báo và dedupe.

Một số bộ test tĩnh cũ còn báo lỗi; không báo chung là toàn bộ suite đều xanh:

- Inspector modes: 9/13 đạt; bốn gate `CANVAS_EXPAND`, `MOBILE_UNCHANGED`, `DOCKED_CANVAS_SCROLL_INDEPENDENT`, `FLOATING_PAGE_BROWSER_SCROLL` cũng lỗi khi chạy trên file lấy trực tiếp từ **HEAD trước thay đổi**.
- Inline AI: assertion cũ yêu cầu đúng 8 action, trong khi `HEAD` đã có 9 action, gồm `rewrite`. File định nghĩa action không bị sửa trong tính năng này; các kiểm tra còn lại của bộ đó đạt.
- Template engine: ba gate cũ `WEBINAR_COMPLETE`, `SCHEMA_COMPATIBLE`, `PREVIEW_RESPONSIVE` còn lỗi trên cấu trúc catalog/renderer/template page không thay đổi. Các gate AI selection, autosave, publish, performance và Facebook trong bộ đó đạt. Chưa sửa các kỳ vọng cũ này trong phạm vi tính năng mới.

Ảnh kiểm tra được lưu tại `.tmp/lp-template-content/`, gồm preview Desktop/Mobile và màn hình duyệt ở trình duyệt 390 px cho cả ba mẫu. API trong browser test được mô phỏng; lưu thực tế được kiểm chứng riêng qua Prisma/service, không tuyên bố đã chạy một lượt HTTP E2E xuyên suốt browser → provider → database.

## Sửa trường hợp người dùng không thấy nút

Trang `2a68892a-e811-4647-a29c-600827b46cc8` sử dụng `agency-portfolio-cream-editorial`, có `templateId`, không phải HTML và tài khoản tạo trang là SUPER_ADMIN. Nút trước đây bị ẩn bởi điều kiện `meta.category === 'product'`; API cũng chặn nhóm mẫu khác.

Đã bỏ giới hạn nhóm sản phẩm ở cả hai phía, giữ kiểm tra quyền và template hợp lệ. Nhãn nút đầy đủ hiện từ breakpoint XL, thay vì đợi 2XL; form ghi rõ “Tên sản phẩm / dịch vụ”. Đã build và cập nhật lại API/web local, reload Nginx.

Kiểm tra service trên chính trang nêu trên tìm được 107 vị trí, tạo được đề xuất tham khảo và xác nhận `draftSpec` cùng `updatedAt` không thay đổi. Kiểm tra trình duyệt dùng đúng đường dẫn trang đó với fixture Agency, xác nhận nút có chữ đầy đủ ở 1534 px và mở được luồng duyệt/áp dụng/undo/autosave. Không dùng bản nháp thật của người dùng để thử ghi dữ liệu.

## Giới hạn / phần chưa xác minh

- Chưa triển khai production, chưa kiểm tra tải đồng thời và thiết bị iOS/Android thật; chưa chạy full web typecheck/lint toàn repository.
- Bản đầu chưa hỗ trợ HTML import, ảnh nền CSS hoặc tự thêm vị trí mới. Không tự thay cấu hình form, menu, tracking, countdown hay video.
- Chưa kiểm thử trực quan mọi biến thể sản phẩm hoặc mọi độ dài nội dung. Việc viết lại đặc điểm được kiểm soát chặt theo dữ liệu cung cấp; nội dung dài/không đủ phù hợp vị trí có thể cần người dùng chỉnh ngắn lại.
- Nhãn thiếu dữ liệu thuộc màn hình duyệt. Nội dung mẫu chưa duyệt được giữ nguyên; người dùng cần rà soát trước publish. Không bổ sung một bộ chặn xuất bản mới trong luồng hiện có.
- Không có công cụ crop mới trong bảng AI; preview sử dụng đúng cách cắt ảnh của mẫu để người dùng rà lại, hoặc chỉnh tiếp trong Inspector ảnh hiện có.

Không thay schema database, không chạy migration và không thay dữ liệu khách hàng để thử tính năng.
