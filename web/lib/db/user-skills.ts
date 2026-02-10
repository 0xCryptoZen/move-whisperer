/**
 * User Skills - Personal skill storage (max 10 per user)
 */

export interface UserSkill {
  id: string;
  userId: string;
  title: string;
  packageId: string;
  moduleName: string | null;
  network: string;
  scene: string;
  skillMd: string;
  metadata: Record<string, unknown> | null;
  createdAt: number;
  updatedAt: number;
}

export const MAX_USER_SKILLS = 10;

function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  return `${timestamp}${random}`;
}

export async function listUserSkills(db: D1Database, userId: string): Promise<UserSkill[]> {
  const { results } = await db.prepare(
    'SELECT * FROM user_skills WHERE user_id = ? ORDER BY created_at DESC'
  ).bind(userId).all();

  return results.map(rowToUserSkill);
}

export async function getUserSkillById(db: D1Database, id: string, userId: string): Promise<UserSkill | null> {
  const row = await db.prepare(
    'SELECT * FROM user_skills WHERE id = ? AND user_id = ?'
  ).bind(id, userId).first();

  if (!row) return null;
  return rowToUserSkill(row);
}

export async function countUserSkills(db: D1Database, userId: string): Promise<number> {
  const row = await db.prepare(
    'SELECT COUNT(*) as count FROM user_skills WHERE user_id = ?'
  ).bind(userId).first();

  return (row?.count as number) || 0;
}

export async function saveUserSkill(db: D1Database, data: {
  userId: string;
  title: string;
  packageId: string;
  moduleName?: string | null;
  network: string;
  scene: string;
  skillMd: string;
  metadata?: Record<string, unknown> | null;
}): Promise<UserSkill> {
  const id = generateId();
  const now = Date.now();

  await db.prepare(
    `INSERT INTO user_skills (id, user_id, title, package_id, module_name, network, scene, skill_md, metadata, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, data.userId, data.title, data.packageId,
    data.moduleName ?? null, data.network, data.scene,
    data.skillMd, data.metadata ? JSON.stringify(data.metadata) : null,
    now, now
  ).run();

  return {
    id,
    userId: data.userId,
    title: data.title,
    packageId: data.packageId,
    moduleName: data.moduleName ?? null,
    network: data.network,
    scene: data.scene,
    skillMd: data.skillMd,
    metadata: data.metadata ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function updateUserSkill(db: D1Database, id: string, userId: string, data: {
  title?: string;
  skillMd?: string;
}): Promise<boolean> {
  const sets: string[] = [];
  const values: unknown[] = [];

  if (data.title !== undefined) {
    sets.push('title = ?');
    values.push(data.title);
  }
  if (data.skillMd !== undefined) {
    sets.push('skill_md = ?');
    values.push(data.skillMd);
  }

  if (sets.length === 0) return false;

  sets.push('updated_at = ?');
  values.push(Date.now());
  values.push(id, userId);

  const result = await db.prepare(
    `UPDATE user_skills SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`
  ).bind(...values).run();

  return result.meta.changes > 0;
}

export async function deleteUserSkill(db: D1Database, id: string, userId: string): Promise<boolean> {
  const result = await db.prepare(
    'DELETE FROM user_skills WHERE id = ? AND user_id = ?'
  ).bind(id, userId).run();

  return result.meta.changes > 0;
}

function rowToUserSkill(row: Record<string, unknown>): UserSkill {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    title: row.title as string,
    packageId: row.package_id as string,
    moduleName: row.module_name as string | null,
    network: row.network as string,
    scene: row.scene as string,
    skillMd: row.skill_md as string,
    metadata: row.metadata ? JSON.parse(row.metadata as string) : null,
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}
