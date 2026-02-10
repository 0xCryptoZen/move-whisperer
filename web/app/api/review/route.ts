import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

interface UserFeedback {
  purpose?: {
    confirmed: boolean;
    correction?: string;
    category?: string;
  };
  generics?: {
    confirmed: boolean;
    corrections?: Record<string, { name: string; description: string; commonTypes: string[] }>;
  };
  adminFunctions?: {
    highlightRisks: boolean;
    addPermissionDocs: boolean;
  };
  errorCodes?: {
    generateErrorsMd: boolean;
    includeInSkillMd: boolean;
  };
  businessContext?: string;
}

interface ContractAnalysis {
  purpose: {
    summary: string;
    category: string;
    protocols: string[];
  };
  functions: Array<{
    name: string;
    purpose: string;
    category: 'admin' | 'user' | 'query' | 'internal';
    risk: 'high' | 'medium' | 'low';
    genericUsage?: Record<string, 'input' | 'output' | 'both'>;
  }>;
  types: Array<{
    name: string;
    purpose: string;
    isCapability: boolean;
    isSharedObject: boolean;
    fields: Array<{ name: string; purpose: string }>;
  }>;
  generics: {
    mapping: Record<string, { name: string; description: string; commonTypes: string[] }>;
    confidence: number;
    inferredFrom: string[];
  };
  errorCodes: Array<{
    name: string;
    code: number;
    description: string;
    possibleCauses: string[];
    solutions: string[];
    category: 'permission' | 'validation' | 'state' | 'math' | 'other';
  }>;
  security: {
    riskLevel: 'high' | 'medium' | 'low';
    concerns: string[];
    adminFunctions: string[];
  };
  suggestedName: string;
  confidence: number;
  fallbackUsed: boolean;
  analysisSource: 'claude' | 'regex' | 'hybrid';
}

interface MergedAnalysis extends ContractAnalysis {
  userFeedback: UserFeedback;
  userCorrected: boolean;
}

interface ReviewRequest {
  analysisId: string;
  analysis: ContractAnalysis;
  feedback: UserFeedback;
}

/**
 * Merge user feedback with AI analysis
 */
function mergeAnalysisWithFeedback(
  analysis: ContractAnalysis,
  feedback: UserFeedback
): MergedAnalysis {
  const merged: MergedAnalysis = {
    ...analysis,
    userFeedback: feedback,
    userCorrected: false,
  };

  // Apply purpose correction
  if (feedback.purpose && !feedback.purpose.confirmed && feedback.purpose.correction) {
    merged.purpose = {
      ...merged.purpose,
      summary: feedback.purpose.correction,
      category: feedback.purpose.category || merged.purpose.category,
    };
    merged.userCorrected = true;
  }

  // Apply generic corrections
  if (feedback.generics && !feedback.generics.confirmed && feedback.generics.corrections) {
    for (const [key, value] of Object.entries(feedback.generics.corrections)) {
      if (merged.generics.mapping[key]) {
        merged.generics.mapping[key] = value;
        merged.userCorrected = true;
      }
    }
    // Update inference source
    merged.generics.inferredFrom = [...merged.generics.inferredFrom, 'user-correction'];
  }

  // Add business context to summary if provided
  if (feedback.businessContext) {
    merged.purpose.summary = `${merged.purpose.summary}\n\n**Business Context:** ${feedback.businessContext}`;
    merged.userCorrected = true;
  }

  // Adjust confidence based on user corrections
  if (merged.userCorrected) {
    merged.confidence = Math.min(merged.confidence + 0.2, 1.0);
    if (merged.analysisSource === 'regex') {
      merged.analysisSource = 'hybrid';
    }
  }

  return merged;
}

export async function POST(request: NextRequest) {
  try {
    const body: ReviewRequest = await request.json();
    const { analysisId, analysis, feedback } = body;

    if (!analysisId || !analysis || !feedback) {
      return NextResponse.json(
        { error: 'analysisId, analysis, and feedback are required' },
        { status: 400 }
      );
    }

    // Merge analysis with feedback
    const mergedAnalysis = mergeAnalysisWithFeedback(analysis, feedback);

    // Generate review ID
    const reviewId = `review-${analysisId}-${Date.now()}`;

    return NextResponse.json({
      reviewId,
      analysisId,
      mergedAnalysis,
      generationOptions: {
        generateErrorsMd: feedback.errorCodes?.generateErrorsMd ?? true,
        includeErrorsInSkillMd: feedback.errorCodes?.includeInSkillMd ?? true,
        highlightAdminRisks: feedback.adminFunctions?.highlightRisks ?? true,
        addPermissionDocs: feedback.adminFunctions?.addPermissionDocs ?? true,
      },
    });
  } catch (error) {
    console.error('[Review] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Review failed' },
      { status: 500 }
    );
  }
}
