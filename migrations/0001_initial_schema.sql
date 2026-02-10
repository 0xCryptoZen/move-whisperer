-- MoveWhisperer Database Schema
-- Migration: 0001_initial_schema
-- Description: Initial database schema for users, auth, sessions, and skill history

-- Users table: Unified user identity
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,                    -- ULID for sortable, unique IDs
  created_at INTEGER NOT NULL,            -- Unix timestamp (ms)
  updated_at INTEGER NOT NULL,            -- Unix timestamp (ms)

  -- Profile (nullable, filled from auth providers)
  display_name TEXT,
  avatar_url TEXT,
  email TEXT UNIQUE,

  -- Auth metadata
  last_login_at INTEGER,
  login_count INTEGER DEFAULT 0
);

-- Auth identities: Links external providers to users (1 user can have multiple)
CREATE TABLE IF NOT EXISTS auth_identities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,                 -- 'github' | 'sui_wallet'
  provider_id TEXT NOT NULL,              -- GitHub user ID or Sui wallet address

  -- Provider-specific data (JSON)
  provider_data TEXT,                     -- GitHub profile, wallet metadata

  -- For Sui wallets
  wallet_address TEXT,                    -- 0x... address (normalized)
  signature_algorithm TEXT,               -- 'ed25519' | 'secp256k1' | 'secp256r1'

  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,

  UNIQUE(provider, provider_id)
);

CREATE INDEX IF NOT EXISTS idx_auth_identities_user ON auth_identities(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_identities_provider ON auth_identities(provider, provider_id);
CREATE INDEX IF NOT EXISTS idx_auth_identities_wallet ON auth_identities(wallet_address);

-- User sessions: Active JWT sessions (for revocation support)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,                    -- JWT jti claim
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Session metadata
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  last_active_at INTEGER NOT NULL,

  -- Device/client info
  user_agent TEXT,
  ip_address TEXT,

  -- Revocation
  revoked_at INTEGER,
  revoked_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- Skill generation history
CREATE TABLE IF NOT EXISTS skill_generations (
  id TEXT PRIMARY KEY,                    -- ULID
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,  -- NULL for anonymous

  -- Package info
  package_id TEXT NOT NULL,
  module_name TEXT,
  network TEXT NOT NULL,                  -- 'mainnet' | 'testnet' | 'devnet'
  package_version INTEGER,

  -- Generation config
  scene TEXT NOT NULL,                    -- 'sdk' | 'learn' | 'audit' | 'frontend' | 'bot' | 'docs' | 'custom' | 'transaction'
  custom_scene_config TEXT,               -- JSON for custom scenes

  -- For TX-based skills
  transaction_digest TEXT,                -- TX hash if generated from transaction

  -- Analysis results (JSON)
  analysis_result TEXT,
  user_feedback TEXT,

  -- Generated output
  skill_md TEXT NOT NULL,
  package_name TEXT NOT NULL,

  -- Metadata
  created_at INTEGER NOT NULL,
  source_code_hash TEXT,                  -- SHA256 of source for deduplication
  generation_time_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_generations_user ON skill_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_generations_package ON skill_generations(package_id);
CREATE INDEX IF NOT EXISTS idx_generations_created ON skill_generations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generations_network ON skill_generations(network);
CREATE INDEX IF NOT EXISTS idx_generations_tx ON skill_generations(transaction_digest);

-- API keys for programmatic access
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  key_hash TEXT NOT NULL UNIQUE,          -- SHA256 of the API key
  name TEXT NOT NULL,

  -- Permissions (JSON array)
  scopes TEXT NOT NULL DEFAULT '["read"]',

  -- Metadata
  created_at INTEGER NOT NULL,
  last_used_at INTEGER,
  expires_at INTEGER,
  revoked_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
