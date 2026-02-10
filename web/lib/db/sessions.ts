import type { Session } from '@/lib/auth/types';

export async function createSession(db: D1Database, data: {
  id: string;
  userId: string;
  expiresAt: number;
  userAgent?: string | null;
  ipAddress?: string | null;
}): Promise<Session> {
  const now = Date.now();

  await db.prepare(
    `INSERT INTO sessions (id, user_id, created_at, expires_at, last_active_at, user_agent, ip_address)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    data.id, data.userId, now, data.expiresAt, now,
    data.userAgent ?? null, data.ipAddress ?? null
  ).run();

  return {
    id: data.id,
    userId: data.userId,
    createdAt: now,
    expiresAt: data.expiresAt,
    lastActiveAt: now,
    userAgent: data.userAgent ?? null,
    ipAddress: data.ipAddress ?? null,
    revokedAt: null,
    revokedReason: null,
  };
}

export async function getSession(db: D1Database, sessionId: string): Promise<Session | null> {
  const row = await db.prepare(
    'SELECT * FROM sessions WHERE id = ? AND revoked_at IS NULL AND expires_at > ?'
  ).bind(sessionId, Date.now()).first();

  if (!row) return null;
  return rowToSession(row);
}

export async function revokeSession(db: D1Database, sessionId: string, reason?: string): Promise<void> {
  const now = Date.now();
  await db.prepare(
    'UPDATE sessions SET revoked_at = ?, revoked_reason = ? WHERE id = ?'
  ).bind(now, reason ?? 'user_logout', sessionId).run();
}

export async function updateSessionActivity(db: D1Database, sessionId: string): Promise<void> {
  await db.prepare(
    'UPDATE sessions SET last_active_at = ? WHERE id = ?'
  ).bind(Date.now(), sessionId).run();
}

function rowToSession(row: Record<string, unknown>): Session {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    createdAt: row.created_at as number,
    expiresAt: row.expires_at as number,
    lastActiveAt: row.last_active_at as number,
    userAgent: row.user_agent as string | null,
    ipAddress: row.ip_address as string | null,
    revokedAt: row.revoked_at as number | null,
    revokedReason: row.revoked_reason as string | null,
  };
}
