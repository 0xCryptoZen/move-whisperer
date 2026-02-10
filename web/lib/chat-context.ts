/**
 * Chat context builder for AI conversational contract exploration.
 * Compacts generation results into a token-efficient context for the chat API.
 */

export interface ChatContext {
  skillMd: string;
  analysisJson: string;
  sourceCodeSnippet?: string;
  packageId: string;
  network: string;
  scene: string;
  moduleName?: string;
}

interface GenerateResult {
  skillMd: string;
  packageName: string;
  metadata: { packageId: string; modules: string[]; network: string };
}

interface ContractAnalysis {
  purpose: { summary: string; category: string; protocols: string[] };
  functions: Array<{ name: string; purpose: string; category: string; risk: string }>;
  types: Array<{ name: string; purpose: string; isCapability: boolean; isSharedObject: boolean }>;
  generics: { mapping: Record<string, { name: string; description: string; commonTypes: string[] }>; confidence: number };
  errorCodes: Array<{ name: string; code: number; description: string; possibleCauses: string[]; solutions: string[]; category: string }>;
  security: { riskLevel: string; concerns: string[]; adminFunctions: string[] };
  confidence: number;
  analysisSource: string;
}

interface IntermediateArtifacts {
  sourceCode?: string;
  decompiledCode?: string;
  moduleName?: string;
  packageId?: string;
}

/**
 * Build a compact chat context from generation results.
 * Truncates large fields to keep the system prompt under ~5000 tokens.
 */
export function buildChatContext(
  result: GenerateResult,
  analysis: ContractAnalysis | null,
  artifacts: IntermediateArtifacts,
  network: string,
  scene: string,
): ChatContext {
  const compactAnalysis = analysis
    ? {
        purpose: analysis.purpose,
        functions: analysis.functions.map(f => ({
          name: f.name,
          purpose: f.purpose,
          category: f.category,
          risk: f.risk,
        })),
        types: analysis.types.map(t => ({
          name: t.name,
          purpose: t.purpose,
          isCapability: t.isCapability,
          isSharedObject: t.isSharedObject,
        })),
        generics: analysis.generics,
        errorCodes: analysis.errorCodes.slice(0, 10),
        security: analysis.security,
      }
    : {};

  return {
    skillMd: result.skillMd.slice(0, 8000),
    analysisJson: JSON.stringify(compactAnalysis),
    sourceCodeSnippet: (artifacts.decompiledCode || artifacts.sourceCode || '').slice(0, 4000) || undefined,
    packageId: result.metadata.packageId,
    network,
    scene,
    moduleName: artifacts.moduleName,
  };
}

/**
 * Build the system prompt from a chat context object.
 */
export function buildSystemPrompt(context: ChatContext): string {
  const parts: string[] = [
    'You are a Sui Move smart contract expert assistant. You have analyzed a contract and generated a skill document.',
    'Answer questions accurately based on the context below. Use code examples when helpful.',
    'Respond in the same language the user writes in.',
    '',
    '## Generated Skill (excerpt)',
    context.skillMd,
    '',
    '## Contract Analysis',
    `Package: ${context.packageId} on ${context.network}`,
    `Scene: ${context.scene}`,
  ];

  if (context.analysisJson && context.analysisJson !== '{}') {
    try {
      const analysis = JSON.parse(context.analysisJson);
      if (analysis.purpose) {
        parts.push(`Purpose: ${analysis.purpose.summary}`);
        parts.push(`Category: ${analysis.purpose.category}`);
      }
      if (analysis.functions?.length) {
        parts.push('', 'Functions:');
        for (const f of analysis.functions) {
          parts.push(`- ${f.name} (${f.category}, risk: ${f.risk}): ${f.purpose}`);
        }
      }
      if (analysis.types?.length) {
        parts.push('', 'Types:');
        for (const t of analysis.types) {
          const tags = [t.isCapability && 'capability', t.isSharedObject && 'shared'].filter(Boolean).join(', ');
          parts.push(`- ${t.name}${tags ? ` [${tags}]` : ''}: ${t.purpose}`);
        }
      }
      if (analysis.errorCodes?.length) {
        parts.push('', 'Error Codes:');
        for (const e of analysis.errorCodes) {
          parts.push(`- ${e.name} (${e.code}): ${e.description}`);
        }
      }
      if (analysis.security) {
        parts.push('', `Security Risk: ${analysis.security.riskLevel}`);
        if (analysis.security.concerns?.length) {
          parts.push(`Concerns: ${analysis.security.concerns.join('; ')}`);
        }
      }
    } catch {
      parts.push(context.analysisJson);
    }
  }

  if (context.sourceCodeSnippet) {
    parts.push('', '## Source Code (excerpt)', '```move', context.sourceCodeSnippet, '```');
  }

  return parts.join('\n');
}

/**
 * Generate suggested prompts based on analysis data.
 */
export function generateSuggestedPrompts(analysis: ContractAnalysis | null): string[] {
  const prompts: string[] = [];

  if (analysis?.functions?.length) {
    const entryFn = analysis.functions.find(f => f.category === 'user') || analysis.functions[0];
    if (entryFn) {
      prompts.push(`How do I call ${entryFn.name}?`);
    }
  }

  if (analysis?.security && analysis.security.riskLevel !== 'low') {
    prompts.push('What are the security risks?');
  }

  if (analysis?.errorCodes?.length) {
    prompts.push('Explain the error codes');
  }

  if (analysis?.generics?.mapping && Object.keys(analysis.generics.mapping).length > 0) {
    prompts.push('How do the generic type parameters work?');
  }

  // Ensure at least 3 prompts
  const defaults = [
    'Give me a usage example',
    'What are the key functions?',
    'Explain the contract architecture',
  ];
  for (const d of defaults) {
    if (prompts.length >= 4) break;
    if (!prompts.includes(d)) prompts.push(d);
  }

  return prompts.slice(0, 4);
}
