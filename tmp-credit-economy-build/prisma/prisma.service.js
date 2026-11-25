"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@marketingspa/database");
// Cap pool before PrismaClient super() reads DATABASE_URL
(0, database_1.applyPrismaPoolEnv)({
    connectionLimit: Number(process.env.DATABASE_CONNECTION_LIMIT || 12) || 12,
});
let PrismaService = class PrismaService extends database_1.PrismaClient {
    async onModuleInit() {
        try {
            await this.$connect();
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`⚠️  PostgreSQL chưa kết nối được (${message}). ` +
                'Bật PostgreSQL trong Laragon hoặc chạy: docker compose -f docker-compose.dev.yml up -d');
        }
    }
    async onModuleDestroy() {
        await this.$disconnect();
    }
};
exports.PrismaService = PrismaService;
exports.PrismaService = PrismaService = __decorate([
    (0, common_1.Injectable)()
], PrismaService);
