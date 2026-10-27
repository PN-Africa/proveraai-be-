import { AsyncLocalStorage } from 'node:async_hooks';
import type { NextFunction, Request, Response } from 'express';
import type { AuthUser } from '../decorators/current-user.decorator.js';

// The current HTTP request, reachable from any service without passing it
// down. Used by the audit log for the actor and IP address.
const storage = new AsyncLocalStorage<Request & { user?: AuthUser }>();

export const requestContextMiddleware = (req: Request, _res: Response, next: NextFunction) =>
  storage.run(req, next);

export const currentRequest = () => storage.getStore();
