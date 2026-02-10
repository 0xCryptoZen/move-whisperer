export interface CloudflareEnv {
  DB: D1Database;
  CACHE: KVNamespace;
  JWT_SECRET: string;
  NEXT_PUBLIC_APP_URL: string;
  JWT_ISSUER: string;
  JWT_AUDIENCE: string;
  SESSION_MAX_AGE: string;
}
