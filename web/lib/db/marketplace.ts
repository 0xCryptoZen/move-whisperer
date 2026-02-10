interface SkillFilters {
  scene?: string;
  network?: string;
  search?: string;
  page?: number;
  limit?: number;
}

interface SkillRow {
  id: string;
  github_url: string;
  owner_id: string | null;
  title: string;
  description: string | null;
  package_id: string | null;
  module_name: string | null;
  network: string;
  scene: string;
  repo_owner: string;
  repo_name: string;
  file_path: string;
  is_validated: number;
  is_from_awesome: number;
  stars_count: number;
  downloads_count: number;
  created_at: number;
  updated_at: number;
}

function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  return `${timestamp}${random}`;
}

export async function listSkills(db: D1Database, filters: SkillFilters) {
  const conditions: string[] = ['1=1'];
  const bindings: unknown[] = [];

  if (filters.scene) {
    conditions.push('scene = ?');
    bindings.push(filters.scene);
  }
  if (filters.network) {
    conditions.push('network = ?');
    bindings.push(filters.network);
  }
  if (filters.search) {
    conditions.push('(title LIKE ? OR description LIKE ?)');
    const searchTerm = `%${filters.search}%`;
    bindings.push(searchTerm, searchTerm);
  }

  const page = filters.page || 1;
  const limit = filters.limit || 20;
  const offset = (page - 1) * limit;

  // Count total
  const countQuery = `SELECT COUNT(*) as total FROM skills WHERE ${conditions.join(' AND ')}`;
  const countResult = await db.prepare(countQuery).bind(...bindings).first<{ total: number }>();
  const total = countResult?.total ?? 0;

  // Fetch page
  const query = `SELECT * FROM skills WHERE ${conditions.join(' AND ')} ORDER BY stars_count DESC, created_at DESC LIMIT ? OFFSET ?`;
  const { results } = await db.prepare(query).bind(...bindings, limit, offset).all<SkillRow>();

  const skills = results.map(row => ({
    id: row.id,
    title: row.title,
    description: row.description,
    githubUrl: row.github_url,
    packageId: row.package_id,
    scene: row.scene,
    network: row.network,
    starsCount: row.stars_count,
    downloadsCount: row.downloads_count,
    repoOwner: row.repo_owner,
    repoName: row.repo_name,
    createdAt: row.created_at,
    isFromAwesome: row.is_from_awesome === 1,
  }));

  return {
    skills,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function createSkill(db: D1Database, data: {
  githubUrl: string;
  ownerId?: string | null;
  title: string;
  description?: string;
  packageId?: string | null;
  scene?: string;
  network?: string;
  repoOwner: string;
  repoName: string;
  filePath: string;
}) {
  const id = generateId();
  const now = Date.now();

  await db.prepare(
    `INSERT INTO skills (id, github_url, owner_id, title, description, package_id, network, scene, repo_owner, repo_name, file_path, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, data.githubUrl, data.ownerId ?? null,
    data.title, data.description ?? null, data.packageId ?? null,
    data.network ?? 'mainnet', data.scene ?? 'sdk',
    data.repoOwner, data.repoName, data.filePath,
    now, now
  ).run();

  return {
    id,
    title: data.title,
    description: data.description ?? null,
    githubUrl: data.githubUrl,
    packageId: data.packageId ?? null,
    scene: data.scene ?? 'sdk',
    network: data.network ?? 'mainnet',
    starsCount: 0,
    downloadsCount: 0,
    repoOwner: data.repoOwner,
    repoName: data.repoName,
    createdAt: now,
    isFromAwesome: false,
  };
}

export async function getSkillById(db: D1Database, id: string) {
  const row = await db.prepare('SELECT * FROM skills WHERE id = ?').bind(id).first<SkillRow>();
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    githubUrl: row.github_url,
    packageId: row.package_id,
    scene: row.scene,
    network: row.network,
    starsCount: row.stars_count,
    downloadsCount: row.downloads_count,
    repoOwner: row.repo_owner,
    repoName: row.repo_name,
    createdAt: row.created_at,
    isFromAwesome: row.is_from_awesome === 1,
  };
}

export async function toggleStar(db: D1Database, userId: string, skillId: string): Promise<boolean> {
  const existing = await db.prepare(
    'SELECT id FROM stars WHERE user_id = ? AND skill_id = ?'
  ).bind(userId, skillId).first();

  if (existing) {
    await db.batch([
      db.prepare('DELETE FROM stars WHERE user_id = ? AND skill_id = ?').bind(userId, skillId),
      db.prepare('UPDATE skills SET stars_count = stars_count - 1 WHERE id = ?').bind(skillId),
    ]);
    return false; // unstarred
  } else {
    const starId = generateId();
    await db.batch([
      db.prepare('INSERT INTO stars (id, user_id, skill_id, created_at) VALUES (?, ?, ?, ?)').bind(starId, userId, skillId, Date.now()),
      db.prepare('UPDATE skills SET stars_count = stars_count + 1 WHERE id = ?').bind(skillId),
    ]);
    return true; // starred
  }
}

export async function checkDuplicateUrl(db: D1Database, githubUrl: string): Promise<boolean> {
  const row = await db.prepare('SELECT id FROM skills WHERE github_url = ?').bind(githubUrl).first();
  return !!row;
}
