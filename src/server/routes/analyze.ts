/**
 * Contract analysis endpoint
 * Analyzes Sui Move contracts using AI (Claude) with regex fallback
 */

import { ServerResponse } from 'http';
import { createAIAnalyzer } from '../../analyzer/ai-analyzer.js';
import { executeCommand } from '../terminal.js';

interface AnalyzeContractRequest {
  packageId: string;
  moduleName: string;
  sourceCode: string;
  network?: string;
}

interface VersionChange {
  type: 'added' | 'removed' | 'modified';
  category: string;
  name: string;
  risk: string;
  description: string;
}

interface AnalyzeVersionChangesRequest {
  fromVersion: number;
  toVersion: number;
  changes: VersionChange[];
  summary: {
    functionsAdded: number;
    functionsRemoved: number;
    functionsModified: number;
    structsAdded: number;
    structsRemoved: number;
    structsModified: number;
    breakingChanges: boolean;
    totalChanges: number;
  };
  packageId?: string;
  network?: string;
}

/**
 * Handle contract analysis request
 */
export async function handleAnalyzeContract(
  body: unknown,
  res: ServerResponse,
  sendJson: (res: ServerResponse, data: unknown, status?: number) => void,
  sendError: (res: ServerResponse, message: string, status?: number) => void
) {
  const { packageId, moduleName, sourceCode, network } = body as AnalyzeContractRequest;

  if (!packageId) {
    sendError(res, 'packageId is required', 400);
    return;
  }

  if (!moduleName) {
    sendError(res, 'moduleName is required', 400);
    return;
  }

  if (!sourceCode) {
    sendError(res, 'sourceCode is required', 400);
    return;
  }

  try {
    console.log(`[Analyze] Starting analysis for ${packageId}::${moduleName}`);

    // Create analyzer with Claude enabled
    const analyzer = createAIAnalyzer({
      useClaude: true,
      timeout: 120000,
      cwd: process.cwd(),
    });

    // Perform analysis
    const analysis = await analyzer.analyzeContract(sourceCode, {
      packageId,
      moduleName,
      network,
    });

    console.log(`[Analyze] Analysis complete. Source: ${analysis.analysisSource}, Confidence: ${analysis.confidence}`);

    sendJson(res, {
      success: true,
      packageId,
      moduleName,
      analysis,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Analysis failed';
    console.error('[Analyze] Error:', message);
    sendError(res, message);
  }
}

/**
 * Handle version changes analysis request using Claude CLI
 */
export async function handleAnalyzeVersionChanges(
  body: unknown,
  res: ServerResponse,
  sendJson: (res: ServerResponse, data: unknown, status?: number) => void,
  sendError: (res: ServerResponse, message: string, status?: number) => void
) {
  const { fromVersion, toVersion, changes, summary, packageId, network } = body as AnalyzeVersionChangesRequest;

  if (!changes || changes.length === 0) {
    sendError(res, 'No changes to analyze', 400);
    return;
  }

  try {
    console.log(`[AnalyzeChanges] Analyzing ${changes.length} changes from v${fromVersion} to v${toVersion}`);

    // Build a prompt for Claude to analyze the changes
    const changesDescription = changes.map(c => {
      const prefix = c.type === 'added' ? '+' : c.type === 'removed' ? '-' : '~';
      return `${prefix} [${c.category}] ${c.name}${c.risk === 'breaking' ? ' (BREAKING)' : ''}`;
    }).join('\n');

    const prompt = `Analyze the following smart contract version changes from v${fromVersion} to v${toVersion}${packageId ? ` for package ${packageId}` : ''}${network ? ` on ${network}` : ''}.

Summary:
- Functions added: ${summary.functionsAdded}
- Functions removed: ${summary.functionsRemoved}
- Functions modified: ${summary.functionsModified}
- Structs added: ${summary.structsAdded}
- Structs removed: ${summary.structsRemoved}
- Breaking changes: ${summary.breakingChanges ? 'Yes' : 'No'}

Changes:
${changesDescription}

Please provide a concise analysis (2-4 paragraphs) covering:
1. What are the main changes and their likely purpose?
2. What are the potential impacts on existing integrations?
3. Are there any security considerations or risks?
4. Recommendations for developers upgrading to the new version.

Keep the response focused and actionable. Use plain text, no markdown headers.`;

    // Try to use Claude CLI for analysis
    const result = await executeCommand(`claude -p "${prompt.replace(/"/g, '\\"')}" --output-format text`, {
      cwd: process.cwd(),
      timeout: 60000,
    });

    if (result.success && result.stdout.trim()) {
      console.log('[AnalyzeChanges] Claude analysis complete');
      sendJson(res, {
        success: true,
        analysis: result.stdout.trim(),
        source: 'claude',
      });
    } else {
      // Fallback to a basic analysis if Claude is not available
      console.log('[AnalyzeChanges] Claude not available, using fallback');
      const fallbackAnalysis = generateFallbackAnalysis(fromVersion, toVersion, changes, summary);
      sendJson(res, {
        success: true,
        analysis: fallbackAnalysis,
        source: 'fallback',
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Analysis failed';
    console.error('[AnalyzeChanges] Error:', message);

    // Try fallback on error
    try {
      const fallbackAnalysis = generateFallbackAnalysis(fromVersion, toVersion, changes, summary);
      sendJson(res, {
        success: true,
        analysis: fallbackAnalysis,
        source: 'fallback',
      });
    } catch {
      sendError(res, message);
    }
  }
}

/**
 * Generate a basic analysis without Claude
 */
function generateFallbackAnalysis(
  fromVersion: number,
  toVersion: number,
  changes: VersionChange[],
  summary: { functionsAdded: number; functionsRemoved: number; functionsModified: number; structsAdded: number; structsRemoved: number; breakingChanges: boolean }
): string {
  const parts: string[] = [];

  // Summary
  parts.push(`This upgrade from v${fromVersion} to v${toVersion} introduces ${summary.functionsAdded + summary.structsAdded} new elements and modifies ${summary.functionsModified} existing ones.`);

  // Added items
  const added = changes.filter(c => c.type === 'added');
  if (added.length > 0) {
    const addedNames = added.slice(0, 5).map(c => c.name).join(', ');
    parts.push(`\nNew additions include: ${addedNames}${added.length > 5 ? ` and ${added.length - 5} more` : ''}.`);
  }

  // Removed items
  const removed = changes.filter(c => c.type === 'removed');
  if (removed.length > 0) {
    const removedNames = removed.slice(0, 5).map(c => c.name).join(', ');
    parts.push(`\nRemoved elements: ${removedNames}${removed.length > 5 ? ` and ${removed.length - 5} more` : ''}.`);
  }

  // Breaking changes warning
  if (summary.breakingChanges) {
    parts.push(`\n⚠️ This version contains breaking changes. Existing integrations may need to be updated. Review the removed functions and modified signatures carefully before upgrading.`);
  }

  // Recommendation
  if (summary.functionsRemoved > 0 || summary.breakingChanges) {
    parts.push(`\nRecommendation: Test thoroughly in a non-production environment before upgrading. Check for deprecated function calls in your codebase.`);
  } else {
    parts.push(`\nThis appears to be a backward-compatible upgrade. Standard testing procedures should be sufficient.`);
  }

  return parts.join('');
}
