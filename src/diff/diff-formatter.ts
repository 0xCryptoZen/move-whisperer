/**
 * Formatters for diff output
 * Supports table, JSON, and markdown formats
 */

import type {
  StructuralDiff,
  ABIChange,
  SourceDiff,
  PackageComparison,
} from './types.js';

// ANSI colors for terminal output
const COLORS = {
  RED: '\x1b[31m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  CYAN: '\x1b[36m',
  DIM: '\x1b[2m',
  BOLD: '\x1b[1m',
  RESET: '\x1b[0m',
};

export class DiffFormatter {
  private useColors: boolean;

  constructor(options: { colors?: boolean } = {}) {
    this.useColors = options.colors ?? true;
  }

  /**
   * Format structural diff as a table for terminal output
   */
  formatStructuralDiffTable(diff: StructuralDiff): string {
    const lines: string[] = [];
    const { summary, changes } = diff;

    // Header
    lines.push(this.color(COLORS.BOLD, '=== Structural Changes ==='));
    lines.push(
      `${this.color(COLORS.CYAN, 'Version')} ${diff.fromVersion} → ${diff.toVersion}`
    );
    lines.push('');

    // Summary
    lines.push(this.color(COLORS.BOLD, 'Summary:'));
    if (summary.breakingChanges) {
      lines.push(this.color(COLORS.RED, '  ⚠️  Breaking changes detected!'));
    }
    lines.push(`  Functions: ${this.formatChangeCounts(summary.functionsAdded, summary.functionsRemoved, summary.functionsModified)}`);
    lines.push(`  Structs:   ${this.formatChangeCounts(summary.structsAdded, summary.structsRemoved, summary.structsModified)}`);
    if (summary.modulesAdded > 0 || summary.modulesRemoved > 0) {
      lines.push(`  Modules:   ${this.formatChangeCounts(summary.modulesAdded, summary.modulesRemoved, 0)}`);
    }
    lines.push(`  Total:     ${summary.totalChanges} change(s)`);
    lines.push('');

    // Group changes by module
    if (Object.keys(diff.changesByModule).length > 0) {
      lines.push(this.color(COLORS.BOLD, 'Details:'));

      for (const [moduleName, moduleChanges] of Object.entries(diff.changesByModule)) {
        lines.push('');
        lines.push(this.color(COLORS.CYAN, `  Module: ${moduleName}`));

        for (const change of moduleChanges) {
          lines.push(this.formatChange(change, '    '));
        }
      }
    } else if (changes.length > 0) {
      lines.push(this.color(COLORS.BOLD, 'Changes:'));
      for (const change of changes) {
        lines.push(this.formatChange(change, '  '));
      }
    } else {
      lines.push(this.color(COLORS.DIM, '  No structural changes detected.'));
    }

    return lines.join('\n');
  }

  /**
   * Format a single change
   */
  private formatChange(change: ABIChange, indent: string): string {
    const typeIcon = change.type === 'added' ? '+' : change.type === 'removed' ? '-' : '~';
    const typeColor = change.type === 'added' ? COLORS.GREEN : change.type === 'removed' ? COLORS.RED : COLORS.YELLOW;
    const riskBadge = change.risk === 'breaking' ? this.color(COLORS.RED, ' [BREAKING]') : '';

    const prefix = this.color(typeColor, `${indent}[${typeIcon}]`);
    return `${prefix} ${change.category}: ${change.name}${riskBadge}`;
  }

  /**
   * Format change counts
   */
  private formatChangeCounts(added: number, removed: number, modified: number): string {
    const parts: string[] = [];
    if (added > 0) parts.push(this.color(COLORS.GREEN, `+${added}`));
    if (removed > 0) parts.push(this.color(COLORS.RED, `-${removed}`));
    if (modified > 0) parts.push(this.color(COLORS.YELLOW, `~${modified}`));
    return parts.length > 0 ? parts.join(' / ') : this.color(COLORS.DIM, 'no changes');
  }

  /**
   * Format structural diff as markdown
   */
  formatStructuralDiffMarkdown(diff: StructuralDiff): string {
    const lines: string[] = [];
    const { summary } = diff;

    lines.push(`## Structural Changes (v${diff.fromVersion} → v${diff.toVersion})`);
    lines.push('');

    // Summary table
    lines.push('### Summary');
    lines.push('');
    lines.push('| Category | Added | Removed | Modified |');
    lines.push('|----------|-------|---------|----------|');
    lines.push(`| Functions | ${summary.functionsAdded} | ${summary.functionsRemoved} | ${summary.functionsModified} |`);
    lines.push(`| Structs | ${summary.structsAdded} | ${summary.structsRemoved} | ${summary.structsModified} |`);
    lines.push(`| Modules | ${summary.modulesAdded} | ${summary.modulesRemoved} | - |`);
    lines.push('');

    if (summary.breakingChanges) {
      lines.push('> ⚠️ **Breaking changes detected**');
      lines.push('');
    }

    // Changes by module
    if (Object.keys(diff.changesByModule).length > 0) {
      lines.push('### Changes by Module');
      lines.push('');

      for (const [moduleName, moduleChanges] of Object.entries(diff.changesByModule)) {
        lines.push(`#### \`${moduleName}\``);
        lines.push('');

        for (const change of moduleChanges) {
          const icon = change.type === 'added' ? '➕' : change.type === 'removed' ? '➖' : '🔄';
          const risk = change.risk === 'breaking' ? ' **[BREAKING]**' : '';
          lines.push(`- ${icon} ${change.category}: \`${change.name}\`${risk}`);
          if (change.details?.changes && change.details.changes.length > 0) {
            for (const detail of change.details.changes) {
              lines.push(`  - ${detail}`);
            }
          }
        }
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  /**
   * Format source diffs summary table
   */
  formatSourceDiffSummary(diffs: Record<string, SourceDiff>): string {
    const lines: string[] = [];
    lines.push(this.color(COLORS.BOLD, '=== Source Changes ==='));
    lines.push('');

    const entries = Object.entries(diffs).sort(([a], [b]) => a.localeCompare(b));

    if (entries.length === 0) {
      lines.push(this.color(COLORS.DIM, '  No source changes.'));
      return lines.join('\n');
    }

    for (const [moduleName, diff] of entries) {
      let icon: string;
      let color: string;
      let status: string;

      if (!diff.existsInOld && diff.existsInNew) {
        icon = '+';
        color = COLORS.GREEN;
        status = `new (+${diff.stats.linesAdded} lines)`;
      } else if (diff.existsInOld && !diff.existsInNew) {
        icon = '-';
        color = COLORS.RED;
        status = `removed (-${diff.stats.linesRemoved} lines)`;
      } else if (diff.stats.linesChanged === 0) {
        icon = ' ';
        color = COLORS.DIM;
        status = 'unchanged';
      } else {
        icon = '~';
        color = COLORS.YELLOW;
        status = `+${diff.stats.linesAdded}/-${diff.stats.linesRemoved}`;
      }

      lines.push(`  ${this.color(color, `[${icon}]`)} ${moduleName}: ${status}`);
    }

    return lines.join('\n');
  }

  /**
   * Format complete comparison as JSON
   */
  formatComparisonJson(comparison: PackageComparison): string {
    return JSON.stringify(comparison, null, 2);
  }

  /**
   * Format a brief summary of changes
   */
  formatBriefSummary(structural: StructuralDiff): string {
    const { summary } = structural;
    const parts: string[] = [];

    if (summary.functionsAdded > 0) parts.push(`+${summary.functionsAdded} fn`);
    if (summary.functionsRemoved > 0) parts.push(`-${summary.functionsRemoved} fn`);
    if (summary.functionsModified > 0) parts.push(`~${summary.functionsModified} fn`);
    if (summary.structsAdded > 0) parts.push(`+${summary.structsAdded} struct`);
    if (summary.structsRemoved > 0) parts.push(`-${summary.structsRemoved} struct`);
    if (summary.structsModified > 0) parts.push(`~${summary.structsModified} struct`);

    if (parts.length === 0) {
      return 'No changes';
    }

    let result = parts.join(', ');
    if (summary.breakingChanges) {
      result += this.color(COLORS.RED, ' (breaking)');
    }

    return result;
  }

  /**
   * Apply color to text (if colors are enabled)
   */
  private color(colorCode: string, text: string): string {
    if (!this.useColors) {
      return text;
    }
    return `${colorCode}${text}${COLORS.RESET}`;
  }
}

/**
 * Create a new DiffFormatter
 */
export function createDiffFormatter(options?: { colors?: boolean }): DiffFormatter {
  return new DiffFormatter(options);
}
