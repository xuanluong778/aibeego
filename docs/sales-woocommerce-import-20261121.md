# Nhập nhanh sản phẩm WooCommerce — 21/11/2026

## Phạm vi

Bổ sung nguồn WooCommerce vào **Bán hàng → Sản phẩm → Nhập nhanh sản phẩm**. Giữ luồng Excel/CSV; tái sử dụng `ProductImportService`, previewVersion, xác nhận, 25 dòng/lô, lịch sử, CSV kết quả, retry và transaction tạo/sửa sản phẩm của `SalesService`. Không thêm importer ghi kho riêng hoặc worker mới.

## Sử dụng

1. Mở tab **Kết nối WooCommerce**. Nhập URL gốc HTTPS (kèm thư mục WordPress nếu có), Consumer Key/Secret có quyền Read. Tạo khóa tại WooCommerce → Settings → Advanced → REST API.
2. Kiểm tra và lưu. Website được kiểm tra quyền đọc sản phẩm và tiền tệ. Có thể nhập lại URL/khóa để thay khóa cùng kết nối.
3. Chọn website, danh mục hoặc dán URL danh mục cùng website. Link được đối chiếu slug với danh mục API; không xác định duy nhất thì chọn thủ công, không tự chuyển sang nhập toàn shop.
4. Chọn sản phẩm qua nhiều trang; hỗ trợ chọn trang hoặc tất cả kết quả trong giới hạn 100 sản phẩm cha. Sản phẩm variable được đọc toàn bộ biến thể. Grouped/external chưa hỗ trợ.
5. Bấm đọc chi tiết để tạo phiên nháp. Hệ thống chuyển sang giao diện nhập hiện có: kiểm tra ánh xạ/tùy chọn, xem trước rồi xác nhận. Bật tạo danh mục mới nếu cần. Chưa ghi sản phẩm ở bước đọc/xem trước.
6. Mở lại phiên trong lịch sử để xem kết quả, tiếp tục hoặc thử lại. Việc nhập vẫn theo lô do giao diện gọi; đóng trang dừng sau lô đang chạy, không phải tác vụ tự chạy hết phiên khi đóng trình duyệt.

## Quy tắc dữ liệu

- Chỉ nhập VND; kiểm tra lại tiền tệ khi lấy snapshot, không quy đổi tự động.
- Lưu tên, SKU, barcode chuẩn `global_unique_id` nếu có, danh mục đầu tiên, giá vào danh mục nội bộ. Giữ toàn bộ danh mục nguồn, mô tả HTML, mô tả ngắn, URL ảnh, thuộc tính, giá thường/giảm, trạng thái, ID cha/biến thể và thời điểm đọc trong snapshot liên kết.
- Ảnh giữ ở website nguồn, không tải về server. Hiển thị ảnh từ URL chỉ ở preview; mô tả được hiển thị dạng văn bản, không thực thi HTML/script. Danh sách nội bộ chỉ trả bản mô tả rút gọn 1.000 ký tự và ảnh đầu tiên để hạn chế payload.
- Tồn kho nguồn lưu riêng trong snapshot. Không tạo stockQty, lô OPENING hay INBOUND. Biến thể dùng tồn cha được đánh dấu để không cộng trùng. Nếu website không quản lý số lượng, hiển thị chưa có số lượng.
- Không lấy giá vốn từ giá bán. Giá vốn thiếu tiếp tục theo schema hiện hành (mặc định 0), có cảnh báo tại preview; chưa đổi nghiệp vụ lợi nhuận/báo cáo. Giá bán thiếu cũng có cảnh báo trước khi người dùng xác nhận tạo giá mặc định 0.
- Định danh bằng tổ chức + kết nối + external ID, nên nhập lại sản phẩm thiếu SKU không tạo trùng. Advisory lock bảo vệ hai phiên cùng nhập một nguồn; sản phẩm, liên kết nguồn, audit và kết quả dòng commit cùng transaction.
- Mã trùng sản phẩm nội bộ chưa liên kết nguồn sẽ báo lỗi, không tự ghép theo mã/tên. Cập nhật chỉ áp dụng sản phẩm đã liên kết và các trường được chọn. Mặc định bỏ qua bản đã nhập; muốn cập nhật snapshot/giá cần chọn chế độ cập nhật và trường thích hợp.
- Chưa cập nhật ngược website, chưa đồng bộ tự động theo lịch, chưa đọc đơn hàng hoặc đồng bộ kho hai chiều. Trạng thái nội bộ quản lý riêng với trạng thái xuất bản website.

## Bảo vệ và giới hạn

- Mọi endpoint kiểm tra `order.write` thực, kể cả guard chung ở shadow mode; truy vấn có organizationId. FK ghép ngăn tham chiếu kết nối/sản phẩm khác tổ chức.
- Khóa mã hóa AES-256-GCM bằng `ENCRYPTION_KEY` hiện có; không trả credential qua API danh sách/chi tiết kết nối, không ghi khóa vào URL hoặc lỗi. Khóa phải có ít nhất 16 ký tự và không phải placeholder. Không đổi khóa mã hóa khi còn credential cần sử dụng.
- HTTP chỉ GET tới endpoint server dựng sẵn; HTTPS/443, DNS/IP công khai được ghim khi kết nối, không theo redirect hay link phân trang từ server. Chặn IP nội bộ/metadata, giới hạn phản hồi 4MB và tối đa 12 giây/request. Dùng URL canonical, gồm www nếu website yêu cầu.
- Đọc danh mục tối đa 2.000 mục/30 giây. Thu thập chi tiết tối đa 45 giây, 100 sản phẩm cha, 2.000 dòng biến thể, 8MB snapshot/phiên và 150KB snapshot/sản phẩm. Vượt giới hạn hoặc đọc thiếu biến thể sẽ không tạo phiên thiếu dữ liệu; chọn phạm vi nhỏ hơn.
- Rate limit theo tổ chức và một tác vụ thu thập/tổ chức/process. Đây là giới hạn theo process, chưa phải khóa/rate limit phân tán trên nhiều API replica.

## Migration và vận hành

Migration mới: `20261121150000_sales_woocommerce_import`. Thêm bảng kết nối/liên kết nguồn, trường nguồn cho phiên/dòng và unique phục vụ FK ghép; không sửa số liệu kho hiện có. Cần migration `20261121130000_sales_product_imports` đã có trước đó.

Đã generate Prisma Client, build shared/database/API và kiểm thử trên QA riêng. Ngày 21/11/2026 đã áp riêng migration WooCommerce và cập nhật API/Web Docker local tại `http://localhost:8080`; không deploy production. Nginx đã kiểm tra cấu hình và reload; worker, PostgreSQL và Redis giữ nguyên.

Backup trước cập nhật: `tmp/local-woocommerce-release-20261121/database-before.dump` (đã kiểm tra bằng pg_restore --list). Image quay lui: `aibeego-api:before-woocommerce-20261121` và `aibeego-web:before-woocommerce-20261121`. Manifest, checksum migration, kết quả kiểm tra và ảnh giao diện lưu cùng thư mục. Đồng bộ marker phiên bản builder trong public bind mount với image Web mới.

Kiểm tra bản local đang chạy bằng Edge headless: nút **Nhập nhanh sản phẩm**, tab **Kết nối WooCommerce**, các ô URL/Consumer Key/Consumer Secret đều hiển thị; API kết nối trả 200 với tài khoản hợp lệ, không xác thực trả 401; Excel/CSV và tải mẫu vẫn hoạt động. Chỉ kiểm tra đọc giao diện/API, không lưu khóa hoặc nhập sản phẩm thật. Đối chiếu trước/sau: 14 sản phẩm, tổng tồn 617, 15 lô, 31 movement, 0 phiên nhập — không thay đổi.

## Kiểm chứng

### Sửa nhận diện URL kết nối — 21/11/2026

- Khi dán link danh mục/sản phẩm, kết nối thử đọc REST discovery của WordPress (`Link: rel="https://api.w.org/"` hoặc thẻ link trong HTML) để xác định đúng thư mục website. Hỗ trợ WordPress cài trong thư mục con; khi không có discovery, giữ URL người dùng nhập.
- Discovery không gửi khóa, không theo redirect và chỉ nhận API root cùng origin. Request có khóa tiếp tục HTTPS/IP pinning, không theo redirect và không chuyển khóa vào query string.
- Sau kết nối, ô URL cập nhật thành website gốc; link ban đầu được giữ ở ô danh mục để người dùng bấm tìm danh mục.
- Phân biệt lỗi HTTP 401/403/404/429 và redirect bằng thông báo cụ thể; không lấy lỗi 404 đường dẫn để kết luận khóa API sai. Không trả nội dung lỗi thô của website hoặc credential.
- Thay đổi này không cần migration mới. Kiểm thử bao gồm discovery qua header/HTML, thư mục con, chặn gợi ý khác origin/redirect và kết nối từ link danh mục qua giao diện thật.
- Đã cập nhật API/Web Docker local và reload Nginx. Kiểm tra discovery bằng API container đang chạy với website thực tế: nhận đúng URL gốc, không dùng credential cho phép thử này. Giao diện mới/API danh sách kết nối và Excel/CSV đều hoạt động; số liệu sản phẩm/kho giữ nguyên. Khóa website khách hàng chưa được dùng trong kiểm thử tự động; người dùng cần bấm kết nối lại để xác nhận quyền thực tế. Bằng chứng, ảnh và manifest ở `tmp/local-woocommerce-urlfix-20261121/`. Image quay lui: `aibeego-api:before-woo-urlfix-20261121`, `aibeego-web:before-woo-urlfix-20261121`.

- `scripts/prepare-sales-woocommerce-qa.cjs`: dựng schema trước tính năng trong database QA cố định, rồi chạy migration mới. Prisma migrate diff từ QA tới schema hiện tại không có chênh lệch.
- `scripts/test-sales-woocommerce.cjs`: controller, DTO, tenant/permission guards, importer, PostgreSQL và Redis thật; xác thực người dùng và phản hồi WooCommerce dùng fixture. Kiểm tra khóa mã hóa, không lộ secret, link danh mục, phân trang, biến thể/tồn cha, chống trùng thiếu SKU giữa các phiên đồng thời, cập nhật chọn trường, rollback/retry và giao diện desktop/mobile. Kiểm tra transport HTTPS bằng socket giả để xác minh IP pinning, không theo redirect, GET-only, giới hạn size/timeout; SSRF private-IP dùng validator thật.
- Hồi quy `scripts/test-sales-products.cjs` và `scripts/test-sales-product-import.cjs`: đạt. Chỉ đổi selector tên nút nhập trong test Excel/CSV để khớp nhãn mới.
- Typecheck toàn web còn 132 lỗi đã có ngoài các tệp tính năng; không có lỗi ở component/type/trang sản phẩm thay đổi. Full API build đạt.
- Chưa có URL/khóa website khách hàng nên chưa kiểm thử với WooCommerce thật, plugin tùy biến hoặc ảnh bị chặn hotlink.

Chạy QA nối tiếp trên PostgreSQL/Redis dùng dữ liệu giả, không chạy đồng thời vì các suite dùng chung database QA và reset fixture. Không trỏ script QA vào database ứng dụng.

Tài liệu API đối chiếu: [Authentication](https://developer.woocommerce.com/docs/apis/rest-api/authentication/), [Products](https://developer.woocommerce.com/docs/apis/rest-api/v3/products/), [Current currency](https://developer.woocommerce.com/docs/apis/rest-api/v3/data/).
