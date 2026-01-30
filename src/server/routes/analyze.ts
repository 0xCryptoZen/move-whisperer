/**
 * Contract analysis endpoint
 * Analyzes Sui Move contracts using AI (Claude) with regex fallback
 */

import { ServerResponse } from 'http';
import { createAIAnalyzer } from '../../analyzer/ai-analyzer.js';

interface AnalyzeContractRequest {
  packageId: string;
  moduleName: string;
  sourceCode: string;
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
