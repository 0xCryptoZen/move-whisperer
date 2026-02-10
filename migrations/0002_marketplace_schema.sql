-- MoveWhisperer Database Schema
-- Migration: 0002_marketplace_schema
-- Description: Skill marketplace tables for browsing, sharing, and rating skills

-- Skills table: Published skills in the marketplace
CREATE TABLE IF NOT EXISTS skills (
  id TEXT PRIMARY KEY,                    -- ULID
  github_url TEXT UNIQUE NOT NULL,        -- Full GitHub URL to SKILL.md
  owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,  -- Publisher

  -- Skill metadata
  title TEXT NOT NULL,
  description TEXT,

  -- Extracted Sui-specific metadata
  package_id TEXT,                        -- Sui package ID
  module_name TEXT,
  network TEXT DEFAULT 'mainnet',         -- mainnet | testnet | devnet
  scene TEXT DEFAULT 'sdk',               -- sdk | learn | audit | frontend | bot | docs | custom | transaction

  -- GitHub repository metadata
  repo_owner TEXT NOT NULL,               -- GitHub org/user
  repo_name TEXT NOT NULL,                -- Repository name
  file_path TEXT NOT NULL,                -- Path within repo (e.g., "SKILL.md")
  default_branch TEXT DEFAULT 'main',

  -- Validation & sync status
  is_validated INTEGER DEFAULT 0,         -- 0=pending, 1=validated, -1=failed
  validation_error TEXT,
  last_validated_at INTEGER,
  content_hash TEXT,                      -- SHA256 of content for change detection

  -- Source tracking
  is_from_awesome INTEGER DEFAULT 0,      -- 1 if synced from awesome-sui-skills

  -- Stats (denormalized for performance)
  stars_count INTEGER DEFAULT 0,
  downloads_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  synced_at INTEGER                       -- Last sync from GitHub
);

CREATE INDEX IF NOT EXISTS idx_skills_scene ON skills(scene);
CREATE INDEX IF NOT EXISTS idx_skills_network ON skills(network);
CREATE INDEX IF NOT EXISTS idx_skills_stars ON skills(stars_count DESC);
CREATE INDEX IF NOT EXISTS idx_skills_created ON skills(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_skills_package ON skills(package_id);
CREATE INDEX IF NOT EXISTS idx_skills_validated ON skills(is_validated);
CREATE INDEX IF NOT EXISTS idx_skills_owner ON skills(owner_id);

-- Stars/favorites table
CREATE TABLE IF NOT EXISTS stars (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,

  UNIQUE(user_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_stars_skill ON stars(skill_id);
CREATE INDEX IF NOT EXISTS idx_stars_user ON stars(user_id);

-- Tags for skill categorization
CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,              -- e.g., "defi", "nft", "gaming"
  description TEXT,
  color TEXT,                             -- Hex color for UI
  created_at INTEGER NOT NULL
);

-- Skill-Tag junction table (many-to-many)
CREATE TABLE IF NOT EXISTS skill_tags (
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,

  PRIMARY KEY(skill_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_skill_tags_tag ON skill_tags(tag_id);

-- awesome-sui-skills repository sync tracking
CREATE TABLE IF NOT EXISTS awesome_sync (
  id TEXT PRIMARY KEY,
  commit_sha TEXT NOT NULL,               -- Git commit SHA
  synced_at INTEGER NOT NULL,
  skills_added INTEGER DEFAULT 0,
  skills_updated INTEGER DEFAULT 0,
  skills_removed INTEGER DEFAULT 0,
  sync_duration_ms INTEGER,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_awesome_sync_time ON awesome_sync(synced_at DESC);

-- Download tracking for analytics
CREATE TABLE IF NOT EXISTS downloads (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,  -- NULL for anonymous
  downloaded_at INTEGER NOT NULL,

  -- Client info
  user_agent TEXT,
  ip_hash TEXT,                           -- Hashed IP for privacy

  -- Download type
  download_type TEXT DEFAULT 'zip'        -- 'zip' | 'raw' | 'copy'
);

CREATE INDEX IF NOT EXISTS idx_downloads_skill ON downloads(skill_id);
CREATE INDEX IF NOT EXISTS idx_downloads_time ON downloads(downloaded_at DESC);

-- Insert default tags
INSERT OR IGNORE INTO tags (id, name, description, color, created_at) VALUES
  ('tag_defi', 'defi', 'Decentralized Finance protocols', '#10b981', strftime('%s', 'now') * 1000),
  ('tag_nft', 'nft', 'NFT and digital collectibles', '#8b5cf6', strftime('%s', 'now') * 1000),
  ('tag_gaming', 'gaming', 'Gaming and metaverse projects', '#f59e0b', strftime('%s', 'now') * 1000),
  ('tag_infra', 'infrastructure', 'Core infrastructure and utilities', '#6366f1', strftime('%s', 'now') * 1000),
  ('tag_dex', 'dex', 'Decentralized exchanges', '#ec4899', strftime('%s', 'now') * 1000),
  ('tag_lending', 'lending', 'Lending and borrowing protocols', '#14b8a6', strftime('%s', 'now') * 1000),
  ('tag_bridge', 'bridge', 'Cross-chain bridges', '#f97316', strftime('%s', 'now') * 1000),
  ('tag_oracle', 'oracle', 'Price feeds and oracles', '#84cc16', strftime('%s', 'now') * 1000);
