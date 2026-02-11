-- Migration: 0004_direct_publish
-- Description: Add skill_content column for directly published skills (without GitHub URL)

ALTER TABLE skills ADD COLUMN skill_content TEXT;
