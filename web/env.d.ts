interface CloudflareEnv {
  DB: D1Database;
  CACHE: KVNamespace;
  JWT_SECRET: string;
  NEXT_PUBLIC_APP_URL: string;
  JWT_ISSUER: string;
  JWT_AUDIENCE: string;
  SESSION_MAX_AGE: string;
}

declare module '@cloudflare/next-on-pages' {
  export function getRequestContext(): {
    env: CloudflareEnv;
    ctx: ExecutionContext;
    cf: IncomingRequestCfProperties;
  };
}
