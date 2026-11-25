# [FLOW-001] Khởi động Hạ tầng Docker & Kết nối Microservices

> **Tầng nghiệp vụ**: TẦNG 0: HẠ TẦNG & KHỞI TẠO NỀN TẢNG (INFRASTRUCTURE & SYSTEM SEED)  
> **Thứ tự thực thi**: 1 / 58  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Hoàn thành điều kiện tiên quyết trước khi kích hoạt luồng này.

---

## NỘI DUNG CHI TIẾT LUỒNG NGHIỆP VỤ

* **Điều kiện tiên quyết**: Môi trường máy chủ/local cài đặt sẵn Docker, Docker Compose, Node.js 20, pnpm.
* **Tác nhân**: DevOps / System Admin / Local Harness.
* **Chi tiết luồng**:
  1. `docker compose up -d` kích hoạt 6 container cốt lõi:
     - `marketingspa-postgres` (PostgreSQL 16) lưu trữ quan hệ thực thể.
     - `marketingspa-redis` (Redis 7) làm broker hàng đợi và cache phiên.
     - `marketingspa-api` (NestJS REST API & WebSockets cổng 4000).
     - `marketingspa-worker` (BullMQ Background Worker xử lý gửi email, đồng bộ ads, sync tồn kho).
     - `marketingspa-web` (Next.js 15 Standalone cổng 3000).
     - `marketingspa-nginx` (Reverse Proxy cổng 8080 điều phối toàn bộ traffic).
  2. Nginx kiểm tra sức khỏe upstream (health-check) và mở cổng công khai `8080`.
* **Đầu vào**: File `docker-compose.yml`, `docker-compose.local.yml`, biến môi trường `.env`.
* **Đầu ra**: Hạ tầng sẵn sàng tiếp nhận request qua `http://localhost:8080`.
* **Mở khóa**: FLOW-002.

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG (NAVIGATION)

*Đây là luồng khởi đầu hệ thống* | [📋 **Mục lục 58 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-002 - Khởi tạo Database Schema & Seed Dữ liệu Gốc](./FLOW-002-khoi-tao-database-schema-seed-du-lieu-goc.md)
