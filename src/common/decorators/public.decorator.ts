import { SetMetadata } from '@nestjs/common';

// Every route is protected by the global AuthGuard by default (deny by
// default). Put @Public() on a route or controller that must be open, such as
// login or the health check. Never put it on a route that takes an id or
// changes data unless that is truly intended.
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
