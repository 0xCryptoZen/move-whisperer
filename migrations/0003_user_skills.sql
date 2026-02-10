-- User Saved Skills
-- Migration: 0003_user_skills
-- Description: Personal skill storage for authenticated users (max 10 per user)

CREATE TABLE IF NOT EXISTS user_skills (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Skill info
  title TEXT NOT NULL,                -- Display name (packageName or user-chosen)
  package_id TEXT NOT NULL,
  module_name TEXT,
  network TEXT NOT NULL,              -- 'mainnet' | 'testnet' | 'devnet'
  scene TEXT NOT NULL,                -- 'sdk' | 'learn' | 'audit' | 'frontend' | 'bot' | 'docs' | 'custom'

  -- Content
  skill_md TEXT NOT NULL,             -- Full SKILL.md content
  metadata TEXT,                      -- JSON: { modules, generatedAt, generatorVersion, ... }

  -- Timestamps
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_skills_user ON user_skills(user_id);
CREATE INDEX IF NOT EXISTS idx_user_skills_created ON user_skills(created_at DESC);
