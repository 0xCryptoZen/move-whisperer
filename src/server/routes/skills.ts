/**
 * Skills endpoints — list and save SKILL.md files
 * for the Playground page.
 */

import { ServerResponse } from 'http';
import { readdirSync, readFileSync, mkdirSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';

const SKILLS_DIR = resolve(process.cwd(), '.claude', 'skills');

interface SkillInfo {
  name: string;
  path: string;
  preview: string;
}

/**
 * POST /api/skills — list available skills
 */
export async function handleListSkills(
  _body: unknown,
  res: ServerResponse,
  sendJson: (res: ServerResponse, data: unknown, status?: number) => void,
  sendError: (res: ServerResponse, message: string, status?: number) => void,
) {
  try {
    if (!existsSync(SKILLS_DIR)) {
      sendJson(res, { skills: [] });
      return;
    }

    const entries = readdirSync(SKILLS_DIR, { withFileTypes: true });
    const skills: SkillInfo[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const skillPath = join(SKILLS_DIR, entry.name, 'SKILL.md');
      if (!existsSync(skillPath)) continue;

      const content = readFileSync(skillPath, 'utf-8');
      skills.push({
        name: entry.name,
        path: skillPath,
        preview: content.slice(0, 200),
      });
    }

    sendJson(res, { skills });
  } catch (error) {
    sendError(res, error instanceof Error ? error.message : 'Failed to list skills');
  }
}

/**
 * POST /api/skills/save — save a skill to local project
 */
export async function handleSaveSkill(
  body: unknown,
  res: ServerResponse,
  sendJson: (res: ServerResponse, data: unknown, status?: number) => void,
  sendError: (res: ServerResponse, message: string, status?: number) => void,
) {
  const { name, content } = body as { name: string; content: string };

  if (!name || !content) {
    sendError(res, 'name and content are required', 400);
    return;
  }

  try {
    const dir = join(SKILLS_DIR, name);
    mkdirSync(dir, { recursive: true });

    const skillPath = join(dir, 'SKILL.md');
    writeFileSync(skillPath, content, 'utf-8');

    sendJson(res, { success: true, path: skillPath });
  } catch (error) {
    sendError(res, error instanceof Error ? error.message : 'Failed to save skill');
  }
}

/**
 * POST /api/skills/read — read full skill content
 */
export async function handleReadSkill(
  body: unknown,
  res: ServerResponse,
  sendJson: (res: ServerResponse, data: unknown, status?: number) => void,
  sendError: (res: ServerResponse, message: string, status?: number) => void,
) {
  const { name } = body as { name: string };

  if (!name) {
    sendError(res, 'name is required', 400);
    return;
  }

  // Prevent path traversal
  if (name.includes('..') || name.includes('/') || name.includes('\\')) {
    sendError(res, 'Invalid skill name', 400);
    return;
  }

  try {
    const skillPath = join(SKILLS_DIR, name, 'SKILL.md');
    if (!existsSync(skillPath)) {
      sendError(res, 'Skill not found', 404);
      return;
    }

    const content = readFileSync(skillPath, 'utf-8');
    sendJson(res, { name, content, path: skillPath });
  } catch (error) {
    sendError(res, error instanceof Error ? error.message : 'Failed to read skill');
  }
}
