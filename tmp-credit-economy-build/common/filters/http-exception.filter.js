"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var GlobalExceptionFilter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlobalExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
const sentry_1 = require("../../sentry");
const redact_log_util_1 = require("../utils/redact-log.util");
const database_1 = require("@marketingspa/database");
function prismaErrorCode(exception) {
    if (!exception || typeof exception !== 'object' || !('code' in exception))
        return '';
    const code = exception.code;
    return typeof code === 'string' ? code : '';
}
function isUniqueConflict(exception) {
    return exception instanceof Error && prismaErrorCode(exception) === 'P2002';
}
/** Prisma: bảng/cột không tồn tại — thường do VPS chưa chạy migrate deploy. */
function isPrismaSchemaMismatch(exception) {
    if (!(exception instanceof Error))
        return false;
    const code = prismaErrorCode(exception);
    if (['P2021', 'P2022', 'P2010', 'P2011', 'P2012'].includes(code))
        return true;
    const msg = exception.message.toLowerCase();
    return ((msg.includes('column') && msg.includes('does not exist')) ||
        (msg.includes('relation') && msg.includes('does not exist')) ||
        msg.includes('custom_field_defs') ||
        msg.includes('custom_fields'));
}
function isInfrastructureError(exception) {
    if (!(exception instanceof Error))
        return false;
    const code = prismaErrorCode(exception);
    if (code.startsWith('P') && !['P1001', 'P1002', 'P1008', 'P1011', 'P1017', 'P2024'].includes(code)) {
        return false;
    }
    const msg = exception.message.toLowerCase();
    const name = exception.name.toLowerCase();
    return (name.includes('prismaclientinitialization') ||
        name.includes('prismaclientrustpanic') ||
        msg.includes("can't reach database server") ||
        msg.includes('cannot reach database server') ||
        msg.includes('database server is not reachable') ||
        msg.includes('econnrefused') ||
        msg.includes('connection refused') ||
        msg.includes('timed out fetching a new connection from the connection pool') ||
        msg.includes('server has closed the connection') ||
        msg.includes('p1001') ||
        msg.includes('p1002') ||
        msg.includes('p1017') ||
        code === 'P1001' ||
        code === 'P1002' ||
        code === 'P1008' ||
        code === 'P1011' ||
        code === 'P1017' ||
        code === 'P2024');
}
let GlobalExceptionFilter = GlobalExceptionFilter_1 = class GlobalExceptionFilter {
    logger = new common_1.Logger(GlobalExceptionFilter_1.name);
    catch(exception, host) {
        if (exception instanceof database_1.PlanPolicyError) {
            host.switchToHttp().getResponse().status(403).json({
                statusCode: 403, code: exception.code, message: exception.message,
                ...exception.details, redirectTo: '/pricing',
            });
            return;
        }
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        let status = common_1.HttpStatus.INTERNAL_SERVER_ERROR;
        let message = 'Internal server error';
        let errors;
        let code;
        let redirectTo;
        let extra = {};
        if (exception instanceof common_1.HttpException) {
            status = exception.getStatus();
            const body = exception.getResponse();
            if (typeof body === 'string') {
                message = body;
            }
            else if (typeof body === 'object' && body !== null) {
                const obj = body;
                if (Array.isArray(obj.message)) {
                    errors = obj.message;
                    message = 'Validation failed';
                }
                else if (typeof obj.message === 'string') {
                    message = obj.message;
                }
                else if (obj.message != null) {
                    message = String(obj.message);
                }
                if (typeof obj.code === 'string')
                    code = obj.code;
                if (typeof obj.redirectTo === 'string')
                    redirectTo = obj.redirectTo;
                // Giữ field nghiệp vụ (subscriptionStatus, …) — không lộ stack/secret
                for (const key of ['subscriptionStatus', 'redirectTo', 'code']) {
                    if (obj[key] !== undefined && extra[key] === undefined) {
                        extra[key] = obj[key];
                    }
                }
            }
        }
        else if (isUniqueConflict(exception)) {
            status = common_1.HttpStatus.CONFLICT;
            message = 'Địa chỉ trang đã được dùng. Hãy thử lại.';
            this.logger.warn((0, redact_log_util_1.redactLogText)(exception instanceof Error ? exception.message : String(exception)));
        }
        else if (isPrismaSchemaMismatch(exception)) {
            status = common_1.HttpStatus.SERVICE_UNAVAILABLE;
            message =
                'Cơ sở dữ liệu chưa đồng bộ với phiên bản ứng dụng (thiếu bảng/cột). Trên VPS chạy: pnpm db:migrate:deploy — hoặc migration 20261113100000_work_management_custom_fields.';
            code = 'DB_SCHEMA_OUT_OF_DATE';
            this.logger.error((0, redact_log_util_1.redactLogText)(exception instanceof Error ? exception.message : String(exception)), exception instanceof Error ? (0, redact_log_util_1.redactLogText)(exception.stack) : undefined);
            (0, sentry_1.captureException)(exception, 'GlobalExceptionFilter');
        }
        else if (isInfrastructureError(exception)) {
            status = common_1.HttpStatus.SERVICE_UNAVAILABLE;
            message = 'Không kết nối được dữ liệu. Vui lòng thử lại sau ít phút.';
            this.logger.error((0, redact_log_util_1.redactLogText)(exception instanceof Error ? exception.message : String(exception)), exception instanceof Error ? (0, redact_log_util_1.redactLogText)(exception.stack) : undefined);
            (0, sentry_1.captureException)(exception, 'GlobalExceptionFilter');
        }
        else if (exception instanceof Error) {
            this.logger.error((0, redact_log_util_1.redactLogText)(exception.message), (0, redact_log_util_1.redactLogText)(exception.stack));
            (0, sentry_1.captureException)(exception, 'GlobalExceptionFilter');
        }
        else {
            this.logger.error('Unknown exception', (0, redact_log_util_1.redactLogText)(String(exception)));
            (0, sentry_1.captureException)(exception, 'GlobalExceptionFilter');
        }
        response.status(status).json({
            success: false,
            statusCode: status,
            message,
            errors,
            ...(code ? { code } : {}),
            ...(redirectTo ? { redirectTo } : {}),
            ...(typeof extra.subscriptionStatus === 'string'
                ? { subscriptionStatus: extra.subscriptionStatus }
                : {}),
            timestamp: new Date().toISOString(),
        });
    }
};
exports.GlobalExceptionFilter = GlobalExceptionFilter;
exports.GlobalExceptionFilter = GlobalExceptionFilter = GlobalExceptionFilter_1 = __decorate([
    (0, common_1.Catch)()
], GlobalExceptionFilter);
