# Kế hoạch bật tự cấp SSL cho tên miền khách (Caddy edge)

Trạng thái: **CHỜ DUYỆT — chưa chạy lệnh nào trên máy chủ.**

## 1. Hiện trạng (đã kiểm tra, chỉ đọc)

- Máy chủ có **một IP công khai: 116.118.45.72**. Nginx do FastPanel quản lý, bind **đúng IP này** ở cổng 80/443 (17 vhost :80, 14 vhost :443, thêm QUIC :443).
- `/etc/nginx/conf.d/parking.conf` là `default_server` với chứng chỉ tự ký `parking.crt` → đó là chứng chỉ lỗi bạn thấy ở `test.aibeego.com`.
- API nghe `127.0.0.1:4000`, Web nghe `0.0.0.0:3000`. Docker đã cài, **chưa có Caddy**.
- Phần định tuyến tên miền khách (`LANDING_CUSTOM_DOMAIN_V1`) chỉ có trong `docker/nginx/nginx.local.conf` (cho Docker), **không có trên nginx FastPanel của máy này**. Vì vậy chỉ cấp chứng chỉ thôi là chưa đủ: edge cũng phải tự định tuyến host → trang. `Caddyfile` trong thư mục này làm cả hai việc.
- API đã có sẵn `GET /api/v1/landing-pages/public/domains/allow-certificate` và `/domains/resolve`.

## 2. Vì sao cần IP thứ hai (khuyến nghị)

Nginx bind cụ thể `116.118.45.72:80/443`, nên Caddy có thể bind **một IP khác** trên cùng máy mà **không đụng vào bất kỳ site FastPanel nào**. FastPanel hay tự sinh lại file vhost, nên đổi cổng nginx là cách dễ vỡ và có thể làm 13 site khác gián đoạn. Cách an toàn: xin Vietnix thêm một IP công khai (IP phụ) gắn vào máy chủ, gọi là `EDGE_IP`.

Nếu không thể có IP thứ hai, xem mục 8 (phương án thay thế, rủi ro cao hơn).

## 3. Trình tự thực hiện

Mỗi bước có kiểm tra. Nếu kiểm tra không đạt thì **dừng và hoàn tác**, không làm tiếp.

### Bước 0 — Chuẩn bị (không ảnh hưởng gì)
1. Xin Vietnix IP phụ, gắn vào interface của máy chủ. Ghi lại là `EDGE_IP`.
2. Kiểm tra IP đã gắn và cổng còn trống:
   ```bash
   ip -4 addr | grep EDGE_IP
   ss -ltn | grep -E "EDGE_IP:(80|443)"   # phải không có dòng nào
   ```
3. Kiểm tra từ máy khác: cổng 80/443 vào `EDGE_IP` không bị tường lửa chặn (cần cho Let's Encrypt).

### Bước 1 — DNS cho điểm vào edge
Tạo bản ghi: `lp-edge.aibeego.com  A  EDGE_IP` (TTL 300).
Kiểm tra: `dig +short A lp-edge.aibeego.com` trả về `EDGE_IP`.

### Bước 2 — Cấu hình API
Đặt `LANDING_PAGE_CNAME_TARGET=lp-edge.aibeego.com` (và giữ `LANDING_PAGE_TLS_MODE=external`) trong file env của API, rồi khởi động lại API theo cách bạn vẫn dùng (PM2: `ecosystem.config.cjs`). Sau bước này trang Domain sẽ hướng dẫn khách CNAME về `lp-edge.aibeego.com` thay vì `aibeego.com`.
Kiểm tra: trang Domain hiện giá trị CNAME `lp-edge.aibeego.com`.

### Bước 3 — Chạy Caddy edge
```bash
cd /var/www/marketingaut_usr/data/www/marketingautoaz.com/deploy/aibeego-vps/caddy-edge
cat > .env <<'EOF'
EDGE_IP=<điền EDGE_IP>
ACME_EMAIL=<email của bạn>
EOF
docker run --rm -v "$PWD/Caddyfile:/etc/caddy/Caddyfile:ro" -e EDGE_IP=<EDGE_IP> -e ACME_EMAIL=<email> caddy:2.8-alpine caddy validate --config /etc/caddy/Caddyfile
docker compose --env-file .env up -d
docker logs --tail 50 lp-caddy-edge
```
Kiểm tra: `validate` báo hợp lệ; `ss -ltn | grep EDGE_IP` thấy :80 và :443; nginx cũ vẫn chạy (`curl -sI https://aibeego.com` vẫn 200).

### Bước 4 — Thử riêng, chưa đổi DNS thật
```bash
# Tên miền chưa được phép phải bị từ chối, KHÔNG được cấp chứng chỉ
curl -skI --resolve not-registered.example:443:EDGE_IP https://not-registered.example/ | head -3
```
Kiểm tra: không nhận chứng chỉ Let's Encrypt; log Caddy ghi `on-demand TLS ... denied`.

### Bước 5 — Chuyển `test.aibeego.com` sang edge
1. Trên Vietnix: đổi bản ghi **A của `test`** từ `116.118.45.72` thành `EDGE_IP` (giữ nguyên TXT `_aibeego-verify.test`). Hoặc xóa A và thêm `test CNAME lp-edge.aibeego.com`.
2. Chờ DNS cập nhật, rồi trên trang Domain bấm **Kiểm tra kết nối** (trang phải ở trạng thái đã xuất bản).
3. Kiểm tra:
   ```bash
   curl -sI https://test.aibeego.com/ | head -8      # HTTP 200, có header x-lp-page-id, chứng chỉ Let's Encrypt
   echo | openssl s_client -connect test.aibeego.com:443 -servername test.aibeego.com 2>/dev/null | openssl x509 -noout -issuer -dates
   ```

## 4. Việc KHÔNG đụng tới
Nginx/FastPanel, `parking.conf`, 13 site còn lại, cổng 80/443 trên `116.118.45.72`.

## 5. Hoàn tác (đưa về nguyên trạng)
```bash
# Dừng edge
cd /var/www/marketingaut_usr/data/www/marketingautoaz.com/deploy/aibeego-vps/caddy-edge
docker compose down                 # giữ volume chứng chỉ; thêm -v nếu muốn xóa hẳn
```
- DNS: trả bản ghi A của `test` về `116.118.45.72`; xóa `lp-edge` nếu không dùng.
- API: bỏ `LANDING_PAGE_CNAME_TARGET`, khởi động lại API.
- Nginx không bị thay đổi nên không cần hoàn tác.

## 6. Rủi ro cần biết
- **Rate limit Let's Encrypt:** 50 chứng chỉ/tuần/tên miền gốc đăng ký. Tên miền khách khác nhau nên ít gặp; `test.aibeego.com` tính vào `aibeego.com`.
- **Cổng 80 phải tới được Caddy** để xác thực HTTP-01 (kiểm tra ở bước 0).
- **Header chống giả mạo:** Caddyfile xóa `X-Lp-Public-Key`/`X-Lp-Page-Id` do client gửi trước khi hỏi API. Cần kiểm tra thực tế ở bước 5 rằng client không giả mạo được (gửi thử `curl -H 'X-Lp-Public-Key: x'`).
- `Caddyfile` này mới được kiểm tra bằng đọc code, **chưa chạy thật**. `caddy validate` ở bước 3 là cổng kiểm tra đầu tiên.
- Giữ nguyên volume `caddy_data`; mất nó sẽ phải cấp lại toàn bộ chứng chỉ.

## 7. Cần quyết định trước khi chạy
1. Có xin được IP phụ từ Vietnix không? (cần `EDGE_IP`)
2. Email nhận thông báo Let's Encrypt.
3. File env của API nằm ở đâu và khởi động lại bằng cách nào (PM2/Docker).

## 8. Phương án thay thế nếu không có IP phụ (không khuyến nghị)
Chuyển toàn bộ nginx http sang cổng nội bộ và để Caddy chiếm 80/443 trên `116.118.45.72` (Caddy `reverse_proxy` các site FastPanel về nginx). FastPanel sinh lại vhost với `listen 116.118.45.72:443`, nên mỗi lần FastPanel ghi lại file vhost, cấu hình có thể bị ghi đè và 13 site khác sập. Chỉ làm nếu bạn chấp nhận rủi ro và có cửa sổ bảo trì; cần kế hoạch riêng.
