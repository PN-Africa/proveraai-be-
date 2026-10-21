// Injection token for the shared Redis client.
// Usage: constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}
export const REDIS_CLIENT = Symbol('REDIS_CLIENT');
