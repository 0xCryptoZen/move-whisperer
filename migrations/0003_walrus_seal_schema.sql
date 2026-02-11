-- MoveWhisperer Database Schema
-- Migration: 0003_walrus_seal_schema
-- Description: Add Walrus storage and Seal access control fields for skill marketplace

-- Add Walrus/Seal related columns to skills table
ALTER TABLE skills ADD COLUMN blob_id TEXT;
ALTER TABLE skills ADD COLUMN on_chain_id TEXT;
ALTER TABLE skills ADD COLUMN price_mist INTEGER DEFAULT 0;
ALTER TABLE skills ADD COLUMN creator_address TEXT;
ALTER TABLE skills ADD COLUMN is_encrypted INTEGER DEFAULT 0;

-- Index for on-chain lookups
CREATE INDEX IF NOT EXISTS idx_skills_on_chain ON skills(on_chain_id);
CREATE INDEX IF NOT EXISTS idx_skills_creator ON skills(creator_address);
CREATE INDEX IF NOT EXISTS idx_skills_price ON skills(price_mist);

-- Purchase records table
CREATE TABLE IF NOT EXISTS purchases (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    access_cap_id TEXT NOT NULL,         -- Sui AccessCap object ID
    tx_digest TEXT NOT NULL,             -- Purchase transaction digest
    price_mist INTEGER NOT NULL,         -- Price at time of purchase
    purchased_at INTEGER NOT NULL,
    UNIQUE(user_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_purchases_user ON purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_skill ON purchases(skill_id);
CREATE INDEX IF NOT EXISTS idx_purchases_time ON purchases(purchased_at DESC);

-- Creator earnings tracking table
CREATE TABLE IF NOT EXISTS earnings (
    id TEXT PRIMARY KEY,
    creator_address TEXT NOT NULL,
    skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    buyer_address TEXT,
    amount_mist INTEGER NOT NULL,
    tx_digest TEXT NOT NULL,
    earned_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_earnings_creator ON earnings(creator_address);
CREATE INDEX IF NOT EXISTS idx_earnings_skill ON earnings(skill_id);
CREATE INDEX IF NOT EXISTS idx_earnings_time ON earnings(earned_at DESC);
