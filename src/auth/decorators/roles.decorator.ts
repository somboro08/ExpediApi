import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'required_roles';

/**
 * Restrict a route to users holding at least one of the listed roles.
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
