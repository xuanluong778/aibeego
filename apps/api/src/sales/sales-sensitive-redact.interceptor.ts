import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, Observable } from 'rxjs';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { redactSalesSensitive } from './sales-response-redact.util';

/** Áp lên JSON của sales (kể cả object lồng). @Res() stream không đi qua đây. */
@Injectable()
export class SalesSensitiveRedactInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const user = context.switchToHttp().getRequest<{ user?: AuthUser }>().user;
    return next.handle().pipe(
      map((data) => {
        if (!user || data == null || typeof data !== 'object') return data;
        return redactSalesSensitive(data, user);
      }),
    );
  }
}
