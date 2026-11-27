# [FLOW-001] Khởi động Hạ tầng Docker, Cấu hình Môi trường & Microservices

> **Tầng nghiệp vụ**: TẦNG 0: HẠ TẦNG & KHỞI TẠO NỀN TẢNG (INFRASTRUCTURE & SYSTEM SEED)  
> **Thứ tự thực thi**: 1 / 62  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Chỉ kích hoạt khi các điều kiện tiên quyết đã sẵn sàng.

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT ("CÓ A")
* Máy chủ / Local cài đặt Docker, Docker Compose, cấu hình `.env` và `docker-compose.yml` / `docker-compose.local.yml`.

## 2. TÁC NHÂN THAM GIA (ACTORS)
* DevOps / System Admin / Local Harness

## 3. THÀNH PHẦN HỆ THỐNG LIÊN QUAN (CODEBASE ARCHITECTURE)
* **Docker Services**: `marketingspa-postgres` (PostgreSQL 16), `marketingspa-redis` (Redis 7), `marketingspa-api` (NestJS cổng 4000), `marketingspa-worker` (BullMQ Worker), `marketingspa-web` (Next.js 15 Standalone cổng 3000), `marketingspa-nginx` (Reverse Proxy cổng 8080 / 80-443).
* **Health API**: `GET /api/v1/health` (`health.controller.ts`).

## 4. QUY TRÌNH THỰC HIỆN CHI TIẾT (STEP-BY-STEP)
1. Khởi chạy `docker compose up -d`: PostgreSQL và Redis khởi động trước và qua health-check.
2. API (`apps/api`) và Worker khởi động, kết nối `DATABASE_URL` (PostgreSQL) và `REDIS_URL` (Redis + BullMQ queues + Socket.IO Redis Adapter).
3. Web (`apps/web`) khởi động Next.js server cổng `3000`, gọi `API_INTERNAL_URL=http://api:4000` cho SSR.
4. Nginx reverse proxy nhận traffic một origin (local `:8080`, prod `:443`), điều hướng `/api/*`, `/uploads/*`, `/socket.io/*` về `api:4000`, phần còn lại về `web:3000`.

## 5. DỮ LIỆU ĐẦU VÀO & ĐẦU RA (INPUT / OUTPUT)
* **Đầu vào (Input)**: Biến môi trường `.env` (`DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `NEXT_PUBLIC_APP_URL`, `SEPAY_*`, `OPENAI_API_KEY`...).
* **Đầu ra (Output)**: Hệ sinh thái 6 containers chạy ổn định, `/api/v1/health` trả `200 OK`.

## 6. KIỂM SOÁT NGOẠI LỆ, BẢO MẬT & TÍNH TOÀN VẸN
* Cơ chế `healthcheck` trên Postgres/Redis, `guard-web-build.cjs` ngăn build xung đột tiến trình `node.exe`, CORS + helmet + compression trên `main.ts`.

## 7. MỞ KHÓA LUỒNG TIẾP THEO ("MỚI CÓ B")
* **Kích hoạt / Mở khóa**: FLOW-002

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG

*Đây là luồng khởi đầu hệ thống* | [📋 **Mục lục 62 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-002](./FLOW-002-migration-database-schema-seed-du-lieu-he-thong-goc.md)
