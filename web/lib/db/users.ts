import type { User, AuthIdentity } from '@/lib/auth/types';

function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  return `${timestamp}${random}`;
}

export async function getUserById(db: D1Database, id: string): Promise<User | null> {
  const row = await db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  if (!row) return null;
  return rowToUser(row);
}

export async function getUserByWallet(db: D1Database, walletAddress: string): Promise<User | null> {
  const row = await db.prepare(
    `SELECT u.* FROM users u
     JOIN auth_identities ai ON ai.user_id = u.id
     WHERE ai.wallet_address = ? AND ai.provider = 'sui_wallet'`
  ).bind(walletAddress).first();
  if (!row) return null;
  return rowToUser(row);
}

export async function createUser(db: D1Database, data: {
  displayName: string | null;
  avatarUrl?: string | null;
  email?: string | null;
}): Promise<User> {
  const id = generateId();
  const now = Date.now();

  await db.prepare(
    `INSERT INTO users (id, created_at, updated_at, display_name, avatar_url, email, last_login_at, login_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
  ).bind(id, now, now, data.displayName, data.avatarUrl ?? null, data.email ?? null, now).run();

  return {
    id,
    displayName: data.displayName,
    avatarUrl: data.avatarUrl ?? null,
    email: data.email ?? null,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
    loginCount: 1,
  };
}

export async function updateUserLogin(db: D1Database, userId: string): Promise<void> {
  const now = Date.now();
  await db.prepare(
    `UPDATE users SET last_login_at = ?, login_count = login_count + 1, updated_at = ? WHERE id = ?`
  ).bind(now, now, userId).run();
}

export async function createAuthIdentity(db: D1Database, data: {
  userId: string;
  provider: string;
  providerId: string;
  walletAddress: string;
  signatureAlgorithm: string;
  providerData?: Record<string, unknown>;
}): Promise<AuthIdentity> {
  const id = generateId();
  const now = Date.now();

  await db.prepare(
    `INSERT INTO auth_identities (id, user_id, provider, provider_id, provider_data, wallet_address, signature_algorithm, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, data.userId, data.provider, data.providerId,
    data.providerData ? JSON.stringify(data.providerData) : null,
    data.walletAddress, data.signatureAlgorithm, now, now
  ).run();

  return {
    id,
    userId: data.userId,
    provider: data.provider as AuthIdentity['provider'],
    providerId: data.providerId,
    providerData: data.providerData ?? null,
    walletAddress: data.walletAddress,
    signatureAlgorithm: data.signatureAlgorithm,
    createdAt: now,
    updatedAt: now,
  };
}

export async function getIdentitiesByUser(db: D1Database, userId: string): Promise<AuthIdentity[]> {
  const { results } = await db.prepare(
    'SELECT * FROM auth_identities WHERE user_id = ?'
  ).bind(userId).all();

  return results.map(rowToIdentity);
}

function rowToUser(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    displayName: row.display_name as string | null,
    avatarUrl: row.avatar_url as string | null,
    email: row.email as string | null,
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
    lastLoginAt: row.last_login_at as number | null,
    loginCount: row.login_count as number,
  };
}

function rowToIdentity(row: Record<string, unknown>): AuthIdentity {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    provider: row.provider as AuthIdentity['provider'],
    providerId: row.provider_id as string,
    providerData: row.provider_data ? JSON.parse(row.provider_data as string) : null,
    walletAddress: row.wallet_address as string | null,
    signatureAlgorithm: row.signature_algorithm as string | null,
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}
