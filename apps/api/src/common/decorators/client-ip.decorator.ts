import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** IP client — dùng `request.ip` (Express trust proxy), không đọc trực tiếp X-Forwarded-For. */
export const ClientIp = createParamDecorator((_data: unknown, ctx: ExecutionContext): string | undefined => {
  const request = ctx.switchToHttp().getRequest<{
    ip?: string;
    socket?: { remoteAddress?: string };
  }>();
  return request.ip ?? request.socket?.remoteAddress;
});
