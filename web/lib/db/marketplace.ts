interface SkillFilters {
  scene?: string;
  network?: string;
  search?: string;
  pricing?: 'all' | 'free' | 'paid';
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
  // Walrus + Seal fields
  blob_id: string | null;
  on_chain_id: string | null;
  price_mist: number;
  creator_address: string | null;
  is_encrypted: number;
  // Direct publish
  skill_content: string | null;
}

interface PurchaseRow {
  id: string;
  user_id: string;
  skill_id: string;
  access_cap_id: string;
  tx_digest: string;
  price_mist: number;
  purchased_at: number;
}

interface EarningRow {
  id: string;
  creator_address: string;
  skill_id: string;
  buyer_address: string | null;
  amount_mist: number;
  tx_digest: string;
  earned_at: number;
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
  if (filters.pricing === 'free') {
    conditions.push('(price_mist IS NULL OR price_mist = 0)');
  } else if (filters.pricing === 'paid') {
    conditions.push('price_mist > 0');
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

  const skills = results.map(row => mapSkillRow(row));

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

function mapSkillRow(row: SkillRow) {
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
    // Walrus + Seal fields
    blobId: row.blob_id,
    onChainId: row.on_chain_id,
    priceMist: row.price_mist ?? 0,
    creatorAddress: row.creator_address,
    isEncrypted: row.is_encrypted === 1,
    skillContent: row.skill_content,
    isDirectUpload: row.github_url?.startsWith('direct://') ?? false,
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
  // Walrus + Seal fields
  blobId?: string | null;
  onChainId?: string | null;
  priceMist?: number;
  creatorAddress?: string | null;
  isEncrypted?: boolean;
}) {
  const id = generateId();
  const now = Date.now();

  await db.prepare(
    `INSERT INTO skills (id, github_url, owner_id, title, description, package_id, network, scene, repo_owner, repo_name, file_path, blob_id, on_chain_id, price_mist, creator_address, is_encrypted, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, data.githubUrl, data.ownerId ?? null,
    data.title, data.description ?? null, data.packageId ?? null,
    data.network ?? 'mainnet', data.scene ?? 'sdk',
    data.repoOwner, data.repoName, data.filePath,
    data.blobId ?? null, data.onChainId ?? null,
    data.priceMist ?? 0, data.creatorAddress ?? null,
    data.isEncrypted ? 1 : 0,
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
    blobId: data.blobId ?? null,
    onChainId: data.onChainId ?? null,
    priceMist: data.priceMist ?? 0,
    creatorAddress: data.creatorAddress ?? null,
    isEncrypted: data.isEncrypted ?? false,
  };
}

export async function getSkillById(db: D1Database, id: string) {
  const row = await db.prepare('SELECT * FROM skills WHERE id = ?').bind(id).first<SkillRow>();
  if (!row) return null;
  return mapSkillRow(row);
}

export async function getSkillByOnChainId(db: D1Database, onChainId: string) {
  const row = await db.prepare('SELECT * FROM skills WHERE on_chain_id = ?').bind(onChainId).first<SkillRow>();
  if (!row) return null;
  return mapSkillRow(row);
}

// ====== Purchases ======

export async function createPurchase(db: D1Database, data: {
  userId: string;
  skillId: string;
  accessCapId: string;
  txDigest: string;
  priceMist: number;
}) {
  const id = generateId();
  const now = Date.now();

  await db.prepare(
    `INSERT INTO purchases (id, user_id, skill_id, access_cap_id, tx_digest, price_mist, purchased_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, data.userId, data.skillId, data.accessCapId, data.txDigest, data.priceMist, now).run();

  return { id, ...data, purchasedAt: now };
}

export async function getUserPurchases(db: D1Database, userId: string) {
  const { results } = await db.prepare(
    `SELECT p.*, s.title as skill_title, s.scene as skill_scene, s.blob_id, s.on_chain_id, s.is_encrypted
     FROM purchases p JOIN skills s ON p.skill_id = s.id
     WHERE p.user_id = ? ORDER BY p.purchased_at DESC`
  ).bind(userId).all<PurchaseRow & { skill_title: string; skill_scene: string; blob_id: string; on_chain_id: string; is_encrypted: number }>();

  return results.map(row => ({
    id: row.id,
    skillId: row.skill_id,
    accessCapId: row.access_cap_id,
    txDigest: row.tx_digest,
    priceMist: row.price_mist,
    purchasedAt: row.purchased_at,
    skillTitle: row.skill_title,
    skillScene: row.skill_scene,
    blobId: row.blob_id,
    onChainId: row.on_chain_id,
    isEncrypted: row.is_encrypted === 1,
  }));
}

export async function checkPurchase(db: D1Database, userId: string, skillId: string) {
  const row = await db.prepare(
    'SELECT id FROM purchases WHERE user_id = ? AND skill_id = ?'
  ).bind(userId, skillId).first();
  return !!row;
}

// ====== Earnings ======

export async function recordEarning(db: D1Database, data: {
  creatorAddress: string;
  skillId: string;
  buyerAddress?: string;
  amountMist: number;
  txDigest: string;
}) {
  const id = generateId();
  const now = Date.now();

  await db.prepare(
    `INSERT INTO earnings (id, creator_address, skill_id, buyer_address, amount_mist, tx_digest, earned_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, data.creatorAddress, data.skillId, data.buyerAddress ?? null, data.amountMist, data.txDigest, now).run();

  return { id, ...data, earnedAt: now };
}

export async function getCreatorEarnings(db: D1Database, creatorAddress: string) {
  const { results } = await db.prepare(
    `SELECT e.*, s.title as skill_title
     FROM earnings e JOIN skills s ON e.skill_id = s.id
     WHERE e.creator_address = ? ORDER BY e.earned_at DESC`
  ).bind(creatorAddress).all<EarningRow & { skill_title: string }>();

  const totalResult = await db.prepare(
    'SELECT COALESCE(SUM(amount_mist), 0) as total FROM earnings WHERE creator_address = ?'
  ).bind(creatorAddress).first<{ total: number }>();

  return {
    earnings: results.map(row => ({
      id: row.id,
      skillId: row.skill_id,
      skillTitle: row.skill_title,
      buyerAddress: row.buyer_address,
      amountMist: row.amount_mist,
      txDigest: row.tx_digest,
      earnedAt: row.earned_at,
    })),
    totalMist: totalResult?.total ?? 0,
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

// ====== Direct Publish (from user saved skills) ======

export async function publishUserSkill(db: D1Database, data: {
  userSkillId: string;
  ownerId: string;
  title: string;
  description?: string;
  packageId?: string | null;
  moduleName?: string | null;
  scene?: string;
  network?: string;
  skillContent: string;
}) {
  const id = generateId();
  const now = Date.now();
  const directUrl = `direct://${data.ownerId}/${data.userSkillId}`;

  await db.prepare(
    `INSERT INTO skills (id, github_url, owner_id, title, description, package_id, module_name, network, scene, repo_owner, repo_name, file_path, skill_content, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, directUrl, data.ownerId,
    data.title, data.description ?? null, data.packageId ?? null,
    data.moduleName ?? null,
    data.network ?? 'mainnet', data.scene ?? 'sdk',
    'direct', 'upload', 'SKILL.md',
    data.skillContent, now, now
  ).run();

  return {
    id,
    title: data.title,
    description: data.description ?? null,
    githubUrl: directUrl,
    packageId: data.packageId ?? null,
    scene: data.scene ?? 'sdk',
    network: data.network ?? 'mainnet',
    starsCount: 0,
    downloadsCount: 0,
    repoOwner: 'direct',
    repoName: 'upload',
    createdAt: now,
    isFromAwesome: false,
    isDirectUpload: true,
  };
}

export async function checkDuplicateUrl(db: D1Database, githubUrl: string): Promise<boolean> {
  const row = await db.prepare('SELECT id FROM skills WHERE github_url = ?').bind(githubUrl).first();
  return !!row;
}
