/**
 * Validate SKILL.md from GitHub URL
 * POST /api/marketplace/validate
 */

import { NextResponse } from 'next/server';

export const runtime = 'edge';

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  metadata?: {
    title: string;
    description: string;
    scene?: string;
    network?: string;
    packageId?: string;
    tags?: string[];
  };
}

export async function POST(request: Request) {
  try {
    const { githubUrl } = await request.json() as { githubUrl?: string };

    if (!githubUrl) {
      return NextResponse.json(
        { error: 'GitHub URL is required' },
        { status: 400 }
      );
    }

    // Validate URL format
    const urlPattern = /^https:\/\/github\.com\/([\w-]+)\/([\w-]+)\/blob\/([\w-]+)\/(.+\.md)$/;
    const match = githubUrl.match(urlPattern);
    if (!match) {
      const result: ValidationResult = {
        isValid: false,
        errors: ['Invalid GitHub URL format. Must be a direct link to a .md file.'],
      };
      return NextResponse.json(result);
    }

    const [, owner, repo, branch, path] = match;

    // Convert to raw GitHub URL
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;

    // Fetch the file content
    const response = await fetch(rawUrl);
    if (!response.ok) {
      const result: ValidationResult = {
        isValid: false,
        errors: [response.status === 404
          ? 'File not found. Make sure the repository is public and the path is correct.'
          : `Failed to fetch file: ${response.status}`
        ],
      };
      return NextResponse.json(result);
    }

    const content = await response.text();

    // Parse and validate the SKILL.md content
    const validation = validateSkillContent(content, repo);

    return NextResponse.json(validation);
  } catch (error) {
    console.error('[Validate API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Validate SKILL.md content structure
 */
function validateSkillContent(content: string, repoName: string): ValidationResult {
  const errors: string[] = [];
  const metadata: ValidationResult['metadata'] = {
    title: '',
    description: '',
  };

  // Check if content is not empty
  if (!content.trim()) {
    errors.push('File is empty');
    return { isValid: false, errors };
  }

  // Check for YAML frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (frontmatterMatch) {
    const frontmatter = frontmatterMatch[1];

    // Parse YAML frontmatter (simple key: value parsing)
    const lines = frontmatter.split('\n');
    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.slice(0, colonIndex).trim().toLowerCase();
        const value = line.slice(colonIndex + 1).trim().replace(/^["']|["']$/g, '');

        switch (key) {
          case 'name':
          case 'title':
            metadata.title = value;
            break;
          case 'description':
            metadata.description = value;
            break;
          case 'scene':
            metadata.scene = value;
            break;
          case 'network':
            metadata.network = value;
            break;
          case 'package':
          case 'packageid':
          case 'package_id':
            metadata.packageId = value;
            break;
          case 'tags':
            // Handle comma-separated or array format
            metadata.tags = value.replace(/[\[\]]/g, '').split(',').map(t => t.trim());
            break;
        }
      }
    }
  }

  // Set defaults if not found
  if (!metadata.title) {
    metadata.title = `${repoName} Skill`;
  }

  // Check minimum content length
  if (content.length < 100) {
    errors.push('Content is too short. A valid SKILL.md should have substantial documentation.');
  }

  // Check for required sections (loose validation)
  const hasH1 = /^#\s+.+$/m.test(content);
  const hasCodeBlocks = /```[\s\S]*?```/.test(content);

  if (!hasH1) {
    errors.push('Missing main heading (# Title)');
  }

  if (!hasCodeBlocks) {
    errors.push('No code examples found. Good skills include code snippets.');
  }

  // Validate scene value if present
  const validScenes = ['sdk', 'learn', 'audit', 'frontend', 'bot', 'docs', 'transaction'];
  if (metadata.scene && !validScenes.includes(metadata.scene)) {
    errors.push(`Invalid scene: ${metadata.scene}. Valid scenes: ${validScenes.join(', ')}`);
  }

  // Validate network value if present
  const validNetworks = ['mainnet', 'testnet', 'devnet'];
  if (metadata.network && !validNetworks.includes(metadata.network)) {
    errors.push(`Invalid network: ${metadata.network}. Valid networks: ${validNetworks.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    metadata,
  };
}
