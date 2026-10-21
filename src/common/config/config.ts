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
});
