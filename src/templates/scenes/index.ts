/**
 * Scene templates loader
 */

import type { SkillScene, PredefinedScene } from '../../types/index.js';
import { SDK_SCENE_TEMPLATE } from './sdk.js';
import { LEARN_SCENE_TEMPLATE } from './learn.js';
import { AUDIT_SCENE_TEMPLATE } from './audit.js';
import { FRONTEND_SCENE_TEMPLATE } from './frontend.js';
import { BOT_SCENE_TEMPLATE } from './bot.js';
import { DOCS_SCENE_TEMPLATE } from './docs.js';
import { CUSTOM_SCENE_TEMPLATE } from './custom.js';

/**
 * Predefined scene template registry
 */
export const PREDEFINED_SCENE_TEMPLATES: Record<PredefinedScene, string> = {
  sdk: SDK_SCENE_TEMPLATE,
  learn: LEARN_SCENE_TEMPLATE,
  audit: AUDIT_SCENE_TEMPLATE,
  frontend: FRONTEND_SCENE_TEMPLATE,
  bot: BOT_SCENE_TEMPLATE,
  docs: DOCS_SCENE_TEMPLATE,
};

/**
 * Scene template registry (includes custom)
 */
export const SCENE_TEMPLATES: Record<SkillScene, string> = {
  ...PREDEFINED_SCENE_TEMPLATES,
  custom: CUSTOM_SCENE_TEMPLATE,
};

/**
 * Get template for a specific scene
 */
export function getSceneTemplate(scene: SkillScene): string {
  return SCENE_TEMPLATES[scene];
}

/**
 * Export custom template for reference
 */
export { CUSTOM_SCENE_TEMPLATE };
