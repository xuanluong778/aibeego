"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientIp = void 0;
const common_1 = require("@nestjs/common");
/** IP client từ request (x-forwarded-for / socket) */
exports.ClientIp = (0, common_1.createParamDecorator)((_data, ctx) => {
    const request = ctx.switchToHttp().getRequest();
    const forwarded = request.headers?.['x-forwarded-for'];
    const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    if (raw)
        return raw.split(',')[0]?.trim();
    return request.ip ?? request.socket?.remoteAddress;
});
