# Rà soát Bán hàng / Kho và hướng phát triển SaaS — 21/11/2026

Đánh giá dựa trên source đang có, không phải chứng nhận kế toán hay kiểm toán toàn hệ thống. Mục tiêu phù hợp là SaaS quản lý hàng hóa, mua bán và kho cho doanh nghiệp nhỏ, có thể mở rộng sang thiết bị điện/UPS. Không nên cam kết “lợi nhuận chính xác” trước khi hoàn thiện các điểm P0 dưới đây.

## Phần đã có và nên giữ

- Sản phẩm/danh mục theo organizationId; SKU/barcode chống trùng theo tổ chức; Excel/CSV có preview, retry và transaction; WooCommerce giữ định danh nguồn, biến thể và tồn website tách biệt.
- Kho theo lô, ưu tiên FEFO, khóa sản phẩm/lô trước khi cấp phát, chặn xuất quá tồn và lô hết hạn. `inventory.service.ts` đã có đối soát stockQty với số lượng lô, hoàn kho và tham chiếu đơn hàng.
- Đơn bán có vòng đời, xuất kho, thu tiền/hoàn tiền tách trạng thái đơn; có nhà cung cấp, PO, nhận hàng, trả hàng, kiểm kê và audit. Thanh toán có khóa dòng đơn và hỗ trợ idempotencyKey.
- Có database Decimal, Redis/BullMQ, tenancy, permissions và subscription nền tảng. Đây là cơ sở tốt, nhưng chưa thay thế kiểm chứng đầy đủ mọi luồng SaaS.

## Những phần sửa trong lượt này

- Danh sách gọn với ảnh thu nhỏ, model/SKU, giá và tồn; bỏ mô tả bung ngay trong ô bảng.
- Popup nền sáng theo bố cục tham khảo WordPress: album ảnh, tên/model/SKU, giá, tồn và các tab mô tả/thông số/nguồn. Nội dung dài lấy theo yêu cầu từ endpoint chi tiết; HTML chuyển thành Markdown an toàn, không chạy script/iframe.
- Model thành trường riêng có thể sửa và nhập Excel/CSV; WooCommerce lấy model từ thuộc tính/nhãn Model rõ ràng. Migration chỉ bổ sung model và điền model đã xác định được từ nguồn cũ; không đổi SKU, tên, giá hoặc tồn.
- Nhập/Xuất kho dùng tìm kiếm phía server có phân trang, tìm tên/model/SKU/barcode; không bị giới hạn 50 sản phẩm đầu. Chọn rõ sản phẩm, hỗ trợ bàn phím, không tự chọn khi trùng model/tên. Tra cứu nhanh ưu tiên mã chính xác; kết quả không duy nhất báo cần chọn.
- Cưỡng chế quyền đọc cho danh sách/chi tiết/lookup và quyền ghi cho nhập/xuất/điều chỉnh/đối soát kho, kể cả khi guard chung chạy shadow mode. Chưa đồng nghĩa mọi endpoint khác đã được harden.

## P0 — hoàn thiện trước khi thu phí khách hàng cho báo cáo lợi nhuận

| Điểm trong source | Hệ quả | Việc nên làm |
|---|---|---|
| `reports.service.ts`: COGS dùng `SalesProduct.costPrice` hiện tại × số lượng ròng | Sửa giá vốn hôm nay làm thay đổi lợi nhuận đơn cũ; không phản ánh đúng lô thực xuất | Chốt unitCost và tổng giá vốn bất biến trên từng dòng cấp phát khi xuất; hoàn hàng đảo đúng giá vốn gốc. Dữ liệu lịch sử thiếu căn cứ phải đánh dấu ước tính |
| Giá trị tồn = số lượng vật lý × giá vốn hiện tại | Sai khi nhiều lô có giá nhập khác nhau | Tính SUM(remainingQuantity × unitCost) của từng lô; phân biệt tồn vật lý, bán được, hết hạn và hàng giữ chỗ |
| Báo cáo cộng `order.total` cho CONFIRMED/READY/SHIPPED/COMPLETED, nhưng trả hàng chỉ giảm netQty khi tính COGS | Giá trị đơn xác nhận lẫn doanh thu; trả một phần có thể giảm giá vốn mà doanh thu vẫn giữ tổng cũ | Tách giá trị đơn, doanh thu theo chính sách giao/hoàn tất, tiền đã thu, hoàn tiền và doanh thu thuần. Dùng cùng cơ sở thời gian và khấu trừ cho doanh thu/COGS |
| Nguồn thiếu giá vốn đang mặc định 0 | Lợi nhuận có thể bị phóng đại vì thiếu dữ liệu | Có trạng thái giá vốn đã xác nhận/chưa biết; báo cáo cảnh báo tỷ lệ thiếu, không gọi số đó là lợi nhuận xác thực |
| `summary()` dùng `take: 5000` không báo cắt bớt | Tổng doanh số sai khi quy mô tăng | Aggregate SQL theo toàn bộ phạm vi, nhóm theo ngày/sản phẩm hoặc read model; không cắt âm thầm |
| `resolveRange()` dùng setHours theo timezone của process; Docker local hiện UTC | “Hôm nay” không trùng ngày Việt Nam ở ranh giới ngày | Lưu timestamp UTC, đổi khoảng ngày theo timezone tổ chức (mặc định Asia/Ho_Chi_Minh), kiểm tra thời điểm 00:00/23:59 |
| `PermissionsGuard` có chế độ HRM_PERMISSIONS_ENFORCE=false; nhiều endpoint ngoài phần vừa sửa chưa assert riêng | Chỉ có decorator chưa đủ để bảo đảm phân quyền khi cấu hình shadow | Release SaaS phải cưỡng chế toàn bộ quyền bán hàng/kho/tài chính, kiểm thử đọc/ghi/xuất báo cáo theo vai trò; tách quyền xem giá vốn và lợi nhuận khỏi nhân viên bán hàng |
| Mã đơn `nextOrderCode()` đếm số đơn rồi cộng 1; manual inbound/outbound chưa có khóa idempotency bắt buộc | Hai request có thể trùng mã hoặc thao tác lặp khi retry | Bộ đếm nguyên tử theo tổ chức/ngày hoặc retry có kiểm soát; phiếu và idempotency key duy nhất theo tổ chức, ghi trạng thái/stock/audit cùng transaction |

Không nên sửa một công thức COGS rồi coi toàn bộ lịch sử đã đúng. Cần truy vết lô thực xuất, chiết khấu, phí, hàng hoàn và dữ liệu giá vốn cũ; chốt chính sách trước khi chuyển đổi.

## P1 — quy trình vận hành đủ dùng

1. Phiếu nhập/xuất/điều chỉnh/kiểm kê có trạng thái nháp → duyệt → ghi sổ. Phiếu đã ghi không xóa/sửa trực tiếp; dùng phiếu đảo/điều chỉnh có lý do.
2. Chuỗi mua hàng: nhà cung cấp → PO → nhận từng phần theo lô → công nợ phải trả → thanh toán. Chuỗi bán hàng: đơn → giữ chỗ → xuất/giao → thu tiền → trả/hoàn. Tách xuất điều chuyển, xuất hủy, xuất dùng nội bộ và xuất bán để không cộng nhầm doanh thu.
3. Nhiều kho/vị trí và chi nhánh: hiện lô hàng chưa có warehouseId riêng. Xác định kho nguồn/đích, hàng đang chuyển, tồn khả dụng sau giữ chỗ. Không cộng hai lần tồn WooCommerce và tồn app.
4. Với thiết bị điện/UPS: model, hãng, thông số cấu trúc, biến thể, serial từng thiết bị và bảo hành. Model không phải SKU, nhiều sản phẩm/biến thể có thể cùng model.
5. Dùng chung bộ chọn sản phẩm tìm kiếm cho đơn bán, PO, kiểm kê; tránh các dropdown chỉ tải trang đầu. Có barcode/QR, in phiếu, cảnh báo tồn thấp và truy vết lịch sử theo sản phẩm/lô/serial.
6. Công nợ, chiết khấu, vận chuyển, phí thanh toán và chi phí hoạt động phải có nguồn rõ. Lợi nhuận gộp và lợi nhuận sau chi phí là hai báo cáo riêng; dòng tiền không đồng nhất lợi nhuận.

## P2 — vận hành SaaS

- Tenant isolation: rà soát mọi route, raw SQL, file ảnh, export, job nền và cache; kiểm thử tổ chức A không đọc/sửa/tổng hợp dữ liệu B. DB RLS có thể bổ sung phòng vệ, không thay thế kiểm tra tại service.
- Phân quyền chủ shop, quản lý kho, thủ kho, bán hàng, tài chính; có người lập/người duyệt và lịch sử thay đổi nhạy cảm. Lưu sự kiện trước/sau, actor, chứng từ, lý do và request ID.
- Quota theo gói: sản phẩm, kho, nhân sự, dung lượng ảnh, số job đồng bộ; hàng đợi công bằng giữa khách hàng. Các phiên import dài cần worker tiếp tục được khi người dùng đóng trình duyệt.
- Ảnh: hiện dùng URL từ website, có lazy loading và fallback. Để ổn định lâu dài, cân nhắc lưu thumbnail có quota/đồng ý phù hợp, kiểm tra URL/MIME/dung lượng và bảo vệ SSRF; không mặc định tải toàn bộ ảnh gốc.
- Backup có kiểm tra restore, migration có kế hoạch quay lui, giám sát job lỗi/độ trễ/đối soát kho, cảnh báo bất thường. Rõ chính sách lưu trữ/xuất/xóa dữ liệu khi khách ngừng gói.
- Tìm kiếm lớn: chuẩn hóa không dấu/mã, index phù hợp và query plan; báo cáo aggregate/read model. Không tải toàn bộ catalog hoặc HTML dài vào danh sách.
- Trước phát hành toàn sản phẩm cần xử lý các lỗi typecheck tồn tại ngoài lượt này; Docker hiện cho phép bỏ qua lỗi TypeScript. Build thành công không thay thế kiểm thử nghiệp vụ và phân quyền.

## Nghiệm thu trước mở rộng bán SaaS

- Nhập 5, xuất 2, hoàn 1 → tồn đúng 4; mọi bước có chứng từ và lô/serial truy vết được.
- Hai người đồng thời xuất lượng cuối: chỉ request hợp lệ thành công, tồn không âm.
- Retry cùng phiếu/key không nhân đôi tồn, thu tiền hoặc hoàn tiền.
- Hai lô có giá vốn khác nhau: COGS đúng lô thực xuất; đổi giá vốn danh mục không thay đổi lợi nhuận quá khứ.
- Trả một phần: doanh thu thuần/giá vốn/lợi nhuận/công nợ đều khớp; phân biệt hoàn kho và hoàn tiền.
- Báo cáo trên 5.000 đơn vẫn khớp truy vấn đối soát; ngày Việt Nam đúng tại thời điểm giao ngày UTC.
- Nhân viên không có quyền không xem/sửa giá vốn hoặc báo cáo lợi nhuận; không có endpoint lách shadow mode.
- Tất cả kiểm thử ghi dữ liệu chạy trên QA riêng; bản local khách hàng chỉ kiểm tra đọc và giao diện khi bàn giao.

Lộ trình khuyến nghị: hoàn thiện trải nghiệm sản phẩm/tìm kiếm (lượt này) → xử lý P0 kho/giá vốn/báo cáo/quyền → vận hành thử với một nhóm khách hàng → bổ sung đa kho/serial/công nợ theo nhu cầu thật. Chưa nên đồng bộ tồn hai chiều với website trước khi chốt nguồn tồn chính và cơ chế giữ chỗ.
