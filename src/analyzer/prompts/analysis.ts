/**
 * Claude analysis prompt template for contract analysis
 */

export interface AnalysisPromptParams {
  packageId: string;
  moduleName: string;
  sourceCode: string;
  network?: string;
}

/**
 * Build the analysis prompt for Claude
 */
export function buildAnalysisPrompt(params: AnalysisPromptParams): string {
  const { packageId, moduleName, sourceCode, network = 'mainnet' } = params;

  return `You are a Sui Move smart contract analyst. Analyze the following contract and return JSON.

## Contract Info
- Package ID: ${packageId}
- Module: ${moduleName}
- Network: ${network}

## Source Code
\`\`\`move
${sourceCode}
\`\`\`

## Analysis Tasks

1. **Purpose & Category**: What does this contract do? Identify the main purpose (DEX, NFT, lending, staking, gaming, etc.)
2. **Functions**: Classify each function as admin, user, query, or internal. Identify entry points.
3. **Types**: Identify capabilities (AdminCap, etc.), shared objects, and owned objects.
4. **Generic Semantics**: Infer what T0, T1, etc. represent (e.g., Base Asset, Quote Asset for DEX).
5. **Error Codes**: Extract all \`const E*: u64 = N\` and explain their meaning.
6. **Security**: Identify risks, admin privileges, and potential issues.

## Required JSON Output Format

Return ONLY valid JSON (no markdown code blocks, no explanations):

{
  "purpose": {
    "summary": "Brief description of what this contract does",
    "category": "dex|nft|defi|gaming|social|utility|governance|oracle|bridge|unknown",
    "protocols": ["list of related protocols or standards"]
  },
  "functions": [
    {
      "name": "function_name",
      "purpose": "What this function does",
      "category": "admin|user|query|internal",
      "risk": "high|medium|low",
      "genericUsage": {"T0": "input|output|both"}
    }
  ],
  "types": [
    {
      "name": "TypeName",
      "purpose": "What this type represents",
      "isCapability": true,
      "isSharedObject": false,
      "fields": [{"name": "field_name", "purpose": "field purpose"}]
    }
  ],
  "generics": {
    "T0": {
      "name": "Base Asset",
      "description": "The base asset in trading pairs",
      "commonTypes": ["SUI", "USDC"]
    },
    "T1": {
      "name": "Quote Asset",
      "description": "The quote asset in trading pairs",
      "commonTypes": ["USDT"]
    }
  },
  "errorCodes": [
    {
      "name": "EInsufficientBalance",
      "code": 1,
      "description": "Account balance is insufficient",
      "possibleCauses": ["Balance lower than amount", "Gas not reserved"],
      "solutions": ["Check balance", "Reserve gas"],
      "category": "permission|validation|state|math|other"
    }
  ],
  "security": {
    "riskLevel": "high|medium|low",
    "concerns": ["list of security concerns"],
    "adminFunctions": ["list of admin-only functions"]
  },
  "suggestedName": "suggested-package-name"
}

IMPORTANT:
- Return ONLY valid JSON, no markdown formatting
- All string values must be properly escaped
- Use null for missing optional fields
- If unsure, use "unknown" category and low confidence indicators
`;
}

/**
 * Parse Claude's JSON response
 */
export function parseAnalysisResponse(response: string): unknown {
  // Try to extract JSON from response
  let jsonStr = response.trim();

  // Remove markdown code blocks if present
  if (jsonStr.startsWith('```')) {
    const lines = jsonStr.split('\n');
    const startIdx = lines[0].includes('json') ? 1 : 1;
    const endIdx = lines.findIndex((l, i) => i > 0 && l.trim() === '```');
    if (endIdx > startIdx) {
      jsonStr = lines.slice(startIdx, endIdx).join('\n');
    }
  }

  // Parse JSON
  try {
    return JSON.parse(jsonStr);
  } catch {
    // Try to find JSON object in response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('Failed to parse analysis response as JSON');
  }
}

/**
 * Validate parsed analysis response
 */
export function validateAnalysisResponse(parsed: unknown): boolean {
  if (!parsed || typeof parsed !== 'object') return false;

  const obj = parsed as Record<string, unknown>;

  // Check required fields
  if (!obj.purpose || typeof obj.purpose !== 'object') return false;
  if (!Array.isArray(obj.functions)) return false;
  if (!Array.isArray(obj.types)) return false;

  return true;
}
