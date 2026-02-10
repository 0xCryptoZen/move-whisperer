/**
 * Source-level diff for comparing Move source code
 * Uses jsdiff library for text comparison
 */

import * as Diff from 'diff';
import type { SourceDiff, DiffHunk, DiffLine, DiffOptions } from './types.js';

const DEFAULT_CONTEXT_LINES = 3;

export class SourceDiffer {
  private contextLines: number;
  private ignoreWhitespace: boolean;

  constructor(options: DiffOptions = {}) {
    this.contextLines = options.contextLines ?? DEFAULT_CONTEXT_LINES;
    this.ignoreWhitespace = options.ignoreWhitespace ?? false;
  }

  /**
   * Compare two source code strings and produce a diff
   */
  diffModule(
    beforeSource: string,
    afterSource: string,
    moduleName: string,
    fromVersion: number,
    toVersion: number
  ): SourceDiff {
    const existsInOld = beforeSource.length > 0;
    const existsInNew = afterSource.length > 0;

    // Handle edge cases
    if (!existsInOld && !existsInNew) {
      return this.createEmptyDiff(moduleName, fromVersion, toVersion, false, false);
    }

    if (!existsInOld) {
      // Entirely new module
      return this.createAddedDiff(afterSource, moduleName, fromVersion, toVersion);
    }

    if (!existsInNew) {
      // Module removed
      return this.createRemovedDiff(beforeSource, moduleName, fromVersion, toVersion);
    }

    // Normalize line endings
    const normalizedBefore = this.normalizeSource(beforeSource);
    const normalizedAfter = this.normalizeSource(afterSource);

    // Create diff
    const diffResult = this.ignoreWhitespace
      ? Diff.diffTrimmedLines(normalizedBefore, normalizedAfter)
      : Diff.diffLines(normalizedBefore, normalizedAfter);

    // Convert to our format
    const hunks = this.convertToHunks(diffResult);
    const stats = this.calculateStats(hunks);

    return {
      moduleName,
      fromVersion,
      toVersion,
      hunks,
      stats,
      existsInOld: true,
      existsInNew: true,
    };
  }

  /**
   * Compare sources for all modules in a package
   */
  diffPackage(
    beforeSources: Record<string, string>,
    afterSources: Record<string, string>,
    fromVersion: number,
    toVersion: number,
    options?: { modules?: string[] }
  ): Record<string, SourceDiff> {
    const result: Record<string, SourceDiff> = {};

    const allModules = new Set([
      ...Object.keys(beforeSources),
      ...Object.keys(afterSources),
    ]);

    const modulesToCompare = options?.modules
      ? new Set(options.modules)
      : allModules;

    for (const moduleName of allModules) {
      if (!modulesToCompare.has(moduleName)) {
        continue;
      }

      const before = beforeSources[moduleName] ?? '';
      const after = afterSources[moduleName] ?? '';

      result[moduleName] = this.diffModule(
        before,
        after,
        moduleName,
        fromVersion,
        toVersion
      );
    }

    return result;
  }

  /**
   * Format diff as unified diff string
   */
  formatUnifiedDiff(diff: SourceDiff, beforeName?: string, afterName?: string): string {
    const oldName = beforeName ?? `a/${diff.moduleName}.move`;
    const newName = afterName ?? `b/${diff.moduleName}.move`;

    const lines: string[] = [];
    lines.push(`--- ${oldName}`);
    lines.push(`+++ ${newName}`);

    for (const hunk of diff.hunks) {
      // Hunk header
      lines.push(
        `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`
      );

      // Hunk content
      for (const line of hunk.lines) {
        const prefix =
          line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' ';
        lines.push(`${prefix}${line.content}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Format diff as colored terminal output
   */
  formatColoredDiff(diff: SourceDiff): string {
    const lines: string[] = [];
    const RED = '\x1b[31m';
    const GREEN = '\x1b[32m';
    const CYAN = '\x1b[36m';
    const RESET = '\x1b[0m';

    lines.push(`${CYAN}=== ${diff.moduleName} ===${RESET}`);
    lines.push(
      `${CYAN}Version ${diff.fromVersion} → ${diff.toVersion}${RESET}`
    );
    lines.push('');

    if (diff.hunks.length === 0) {
      lines.push('(no changes)');
      return lines.join('\n');
    }

    for (const hunk of diff.hunks) {
      lines.push(
        `${CYAN}@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@${RESET}`
      );

      for (const line of hunk.lines) {
        if (line.type === 'add') {
          lines.push(`${GREEN}+${line.content}${RESET}`);
        } else if (line.type === 'remove') {
          lines.push(`${RED}-${line.content}${RESET}`);
        } else {
          lines.push(` ${line.content}`);
        }
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Get a summary of the diff
   */
  getSummary(diff: SourceDiff): string {
    if (!diff.existsInOld && diff.existsInNew) {
      return `[+] New module: ${diff.moduleName} (+${diff.stats.linesAdded} lines)`;
    }
    if (diff.existsInOld && !diff.existsInNew) {
      return `[-] Removed module: ${diff.moduleName} (-${diff.stats.linesRemoved} lines)`;
    }
    if (diff.stats.linesChanged === 0) {
      return `[ ] No changes: ${diff.moduleName}`;
    }
    return `[~] Modified: ${diff.moduleName} (+${diff.stats.linesAdded}/-${diff.stats.linesRemoved})`;
  }

  /**
   * Convert jsdiff output to our hunk format
   */
  private convertToHunks(diffResult: Diff.Change[]): DiffHunk[] {
    const hunks: DiffHunk[] = [];
    let currentHunk: DiffHunk | null = null;
    let oldLine = 1;
    let newLine = 1;

    for (const change of diffResult) {
      const lines = change.value.split('\n');
      // Remove trailing empty line if present (from split)
      if (lines.length > 0 && lines[lines.length - 1] === '') {
        lines.pop();
      }

      if (change.added || change.removed) {
        // Start a new hunk if needed
        if (!currentHunk) {
          currentHunk = {
            oldStart: oldLine,
            oldLines: 0,
            newStart: newLine,
            newLines: 0,
            lines: [],
          };
        }

        for (const lineContent of lines) {
          const diffLine: DiffLine = {
            type: change.added ? 'add' : 'remove',
            content: lineContent,
            lineNumber: {},
          };

          if (change.added) {
            diffLine.lineNumber.new = newLine++;
            currentHunk.newLines++;
          } else {
            diffLine.lineNumber.old = oldLine++;
            currentHunk.oldLines++;
          }

          currentHunk.lines.push(diffLine);
        }
      } else {
        // Context lines
        // If we have a current hunk, add context and possibly close it
        if (currentHunk) {
          // Add up to contextLines of trailing context
          const contextToAdd = Math.min(lines.length, this.contextLines);
          for (let i = 0; i < contextToAdd; i++) {
            currentHunk.lines.push({
              type: 'context',
              content: lines[i],
              lineNumber: { old: oldLine + i, new: newLine + i },
            });
            currentHunk.oldLines++;
            currentHunk.newLines++;
          }

          // If there are more context lines than we need, close the hunk
          if (lines.length > this.contextLines * 2) {
            hunks.push(currentHunk);
            currentHunk = null;

            // Skip to near the end for leading context of next hunk
            oldLine += lines.length;
            newLine += lines.length;
          } else {
            // Add remaining context lines
            for (let i = contextToAdd; i < lines.length; i++) {
              currentHunk.lines.push({
                type: 'context',
                content: lines[i],
                lineNumber: { old: oldLine + i, new: newLine + i },
              });
              currentHunk.oldLines++;
              currentHunk.newLines++;
            }
            oldLine += lines.length;
            newLine += lines.length;
          }
        } else {
          // No current hunk, just advance line numbers
          oldLine += lines.length;
          newLine += lines.length;
        }
      }
    }

    // Close any remaining hunk
    if (currentHunk) {
      hunks.push(currentHunk);
    }

    return hunks;
  }

  /**
   * Calculate diff statistics
   */
  private calculateStats(hunks: DiffHunk[]): SourceDiff['stats'] {
    let linesAdded = 0;
    let linesRemoved = 0;

    for (const hunk of hunks) {
      for (const line of hunk.lines) {
        if (line.type === 'add') linesAdded++;
        if (line.type === 'remove') linesRemoved++;
      }
    }

    return {
      linesAdded,
      linesRemoved,
      linesChanged: linesAdded + linesRemoved,
    };
  }

  /**
   * Create an empty diff
   */
  private createEmptyDiff(
    moduleName: string,
    fromVersion: number,
    toVersion: number,
    existsInOld: boolean,
    existsInNew: boolean
  ): SourceDiff {
    return {
      moduleName,
      fromVersion,
      toVersion,
      hunks: [],
      stats: { linesAdded: 0, linesRemoved: 0, linesChanged: 0 },
      existsInOld,
      existsInNew,
    };
  }

  /**
   * Create diff for entirely new module
   */
  private createAddedDiff(
    source: string,
    moduleName: string,
    fromVersion: number,
    toVersion: number
  ): SourceDiff {
    const lines = source.split('\n');
    const diffLines: DiffLine[] = lines.map((content, i) => ({
      type: 'add' as const,
      content,
      lineNumber: { new: i + 1 },
    }));

    return {
      moduleName,
      fromVersion,
      toVersion,
      hunks: [
        {
          oldStart: 0,
          oldLines: 0,
          newStart: 1,
          newLines: lines.length,
          lines: diffLines,
        },
      ],
      stats: {
        linesAdded: lines.length,
        linesRemoved: 0,
        linesChanged: lines.length,
      },
      existsInOld: false,
      existsInNew: true,
    };
  }

  /**
   * Create diff for removed module
   */
  private createRemovedDiff(
    source: string,
    moduleName: string,
    fromVersion: number,
    toVersion: number
  ): SourceDiff {
    const lines = source.split('\n');
    const diffLines: DiffLine[] = lines.map((content, i) => ({
      type: 'remove' as const,
      content,
      lineNumber: { old: i + 1 },
    }));

    return {
      moduleName,
      fromVersion,
      toVersion,
      hunks: [
        {
          oldStart: 1,
          oldLines: lines.length,
          newStart: 0,
          newLines: 0,
          lines: diffLines,
        },
      ],
      stats: {
        linesAdded: 0,
        linesRemoved: lines.length,
        linesChanged: lines.length,
      },
      existsInOld: true,
      existsInNew: false,
    };
  }

  /**
   * Normalize source code (line endings, trailing whitespace)
   */
  private normalizeSource(source: string): string {
    return source
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\r/g, '\n')
      .replace(/\s+$/gm, ''); // Trim trailing whitespace from each line
  }
}

/**
 * Create a new SourceDiffer
 */
export function createSourceDiffer(options?: DiffOptions): SourceDiffer {
  return new SourceDiffer(options);
}
