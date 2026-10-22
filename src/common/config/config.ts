// Typed access to env vars through ConfigService: config.get('port'), etc.
// Add every new env var here AND in validate-env.ts AND in .env.example.
export const envs = () => ({
  port: process.env.PORT,
  allowedOrigins: process.env.ALLOWED_ORIGINS,
  dbType: process.env.DB_TYPE,
  dbHost: process.env.DB_HOST,
  dbPassword: process.env.DB_PASSWORD,
  dbPort: process.env.DB_PORT,
  dbUsername: process.env.DB_USERNAME,
  dbName: process.env.DB,
  redisUrl: process.env.REDIS_URL,
  observeAppKey: process.env.OBSERVE_APP_KEY,
  observeAppSecret: process.env.OBSERVE_APP_SECRET,

  // Auth (Auth & Authorization Security Requirements AR-06, AR-09, AR-10, AR-14)
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET,
  accessTokenTtlMinutes: Number(process.env.ACCESS_TOKEN_TTL_MINUTES ?? 15),
  refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 7),
  cookieSecure: (process.env.COOKIE_SECURE ?? 'true') === 'true',
  cookieSameSite: (process.env.COOKIE_SAMESITE ?? 'lax') as
    | 'lax'
    | 'strict'
    | 'none',
  cookieDomain: process.env.COOKIE_DOMAIN || undefined,
  trustProxy: process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) : 0,

  // First administrator, created on startup while none exists (main.ts)
  adminEmail: process.env.ADMIN_EMAIL || undefined,
  adminPassword: process.env.ADMIN_PASSWORD || undefined,
  adminFullName: process.env.ADMIN_FULL_NAME || undefined,
});
