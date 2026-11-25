import { SetMetadata, applyDecorators } from '@nestjs/common';

export const PERMISSIONS_KEY = 'required_permissions';
export const PERMISSIONS_ENFORCE_KEY = 'required_permissions_enforce';

/** Yêu cầu mọi permission trong danh sách (AND). OWNER bypass ở PermissionsGuard. */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/** Giống RequirePermissions nhưng luôn enforce (không shadow) khi HRM_PERMISSIONS_ENFORCE=false. */
export const RequirePermissionsEnforced = (...permissions: string[]) =>
  applyDecorators(SetMetadata(PERMISSIONS_KEY, permissions), SetMetadata(PERMISSIONS_ENFORCE_KEY, true));
