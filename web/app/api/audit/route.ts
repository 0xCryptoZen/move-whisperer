import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

interface AuditRequest {
  packageId: string;
  sourceCode: string;
  network?: string;
  version?: number;
  previousVersion?: number;
}

interface AuditResult {
  version: number;
  packageId: string;
  summary: {
    riskLevel: 'critical' | 'high' | 'medium' | 'low';
    totalFunctions: number;
    criticalRiskFunctions: number;
    highRiskFunctions: number;
    adminFunctions: number;
    capabilities: string[];
    coinHandlers: string[];
  };
  permissions: Array<{
    function: string;
    visibility: string;
    isEntry: boolean;
    risk: string;
    requiredCapabilities: string[];
  }>;
  vulnerabilities: Array<{
    type: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    description: string;
    location?: string;
    recommendation: string;
  }>;
  recommendations: string[];
  rawAnalysis?: string;
}

/**
 * Analyze source code for security issues
 */
function analyzeSourceCode(sourceCode: string, packageId: string, version: number): AuditResult {
  const functions: AuditResult['permissions'] = [];
  const vulnerabilities: AuditResult['vulnerabilities'] = [];
  const capabilities: string[] = [];
  const coinHandlers: string[] = [];

  // Extract struct definitions for capabilities
  const structPattern = /struct\s+(\w+)\s*(?:<[^>]*>)?\s*has\s+([^{]+)\{/g;
  let match;
  while ((match = structPattern.exec(sourceCode)) !== null) {
    const name = match[1];
    const abilities = match[2];
    if (/Cap$|Capability|Admin|Owner|Auth/.test(name)) {
      capabilities.push(name);
    }
    // Check for shared objects without proper access control
    if (abilities.includes('key') && abilities.includes('store')) {
      if (!/Cap|Admin|Owner/.test(name)) {
        vulnerabilities.push({
          type: 'shared-object-exposure',
          severity: 'medium',
          description: `Shared object "${name}" may be accessible without capability checks`,
          location: `struct ${name}`,
          recommendation: 'Consider adding capability-based access control',
        });
      }
    }
  }

  // Extract functions
  const funcPattern = /(public\s+)?(entry\s+)?fun\s+(\w+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)/g;
  while ((match = funcPattern.exec(sourceCode)) !== null) {
    const isPublic = !!match[1];
    const isEntry = !!match[2];
    const name = match[3];
    const params = match[4];

    if (!isPublic && !isEntry) continue;

    // Detect risk level
    let risk = 'low';
    const requiredCapabilities: string[] = [];

    // Check for capability requirements
    for (const cap of capabilities) {
      if (params.includes(cap) || params.includes(`&${cap}`) || params.includes(`&mut ${cap}`)) {
        requiredCapabilities.push(cap);
      }
    }

    // Check for coin handling
    if (/Coin<|Balance<|coin::|balance::/.test(params)) {
      coinHandlers.push(name);
      risk = 'medium';
    }

    // Detect admin/dangerous functions
    if (/^(admin|set_|update_|pause|unpause|withdraw|transfer_|burn|mint|upgrade|destroy|remove)/.test(name)) {
      risk = 'high';
      if (requiredCapabilities.length === 0 && isEntry) {
        vulnerabilities.push({
          type: 'missing-access-control',
          severity: 'critical',
          description: `Entry function "${name}" appears to be an admin function but has no capability requirement`,
          location: `fun ${name}`,
          recommendation: 'Add capability parameter to restrict access',
        });
      }
    }

    // Check for transfer operations without proper checks
    if (/transfer::public_transfer|transfer::share_object/.test(sourceCode.slice(match.index, match.index + 500))) {
      if (requiredCapabilities.length === 0 && risk !== 'high') {
        risk = 'medium';
      }
    }

    functions.push({
      function: name,
      visibility: isPublic ? 'public' : (isEntry ? 'entry' : 'private'),
      isEntry,
      risk,
      requiredCapabilities,
    });
  }

  // Check for common vulnerabilities

  // Integer overflow (pre-Move 2024)
  if (/\+\s*\d+|\*\s*\d+|-\s*\d+/.test(sourceCode) && !/checked_/.test(sourceCode)) {
    vulnerabilities.push({
      type: 'potential-overflow',
      severity: 'medium',
      description: 'Arithmetic operations detected without explicit overflow checks',
      recommendation: 'Use checked arithmetic or ensure Move version >= 2024 with automatic overflow checks',
    });
  }

  // Reentrancy via public_transfer
  if (/public_transfer.*\n.*public_transfer|transfer::public_transfer[^;]*;[^}]*transfer::public_transfer/.test(sourceCode)) {
    vulnerabilities.push({
      type: 'potential-reentrancy',
      severity: 'high',
      description: 'Multiple transfer operations in sequence may be vulnerable to reentrancy',
      recommendation: 'Review transfer order and consider checks-effects-interactions pattern',
    });
  }

  // Flash loan vulnerability
  if (/borrow.*return|loan/.test(sourceCode.toLowerCase())) {
    vulnerabilities.push({
      type: 'flash-loan-pattern',
      severity: 'medium',
      description: 'Flash loan pattern detected - ensure proper validation',
      recommendation: 'Verify flash loan return checks and price oracle manipulation resistance',
    });
  }

  // Calculate risk level
  const criticalCount = vulnerabilities.filter(v => v.severity === 'critical').length;
  const highCount = vulnerabilities.filter(v => v.severity === 'high').length;
  const highRiskFunctions = functions.filter(f => f.risk === 'high').length;

  let riskLevel: AuditResult['summary']['riskLevel'] = 'low';
  if (criticalCount > 0) riskLevel = 'critical';
  else if (highCount > 0 || highRiskFunctions > 3) riskLevel = 'high';
  else if (vulnerabilities.length > 0 || highRiskFunctions > 0) riskLevel = 'medium';

  // Generate recommendations
  const recommendations: string[] = [];
  if (capabilities.length === 0) {
    recommendations.push('Consider implementing capability-based access control for admin functions');
  }
  if (coinHandlers.length > 0 && vulnerabilities.some(v => v.type === 'missing-access-control')) {
    recommendations.push('Review coin handling functions for proper authorization');
  }
  if (vulnerabilities.some(v => v.type === 'potential-overflow')) {
    recommendations.push('Upgrade to Move 2024 or implement checked arithmetic');
  }
  if (functions.filter(f => f.isEntry).length > 10) {
    recommendations.push('Large number of entry points - consider consolidating to reduce attack surface');
  }

  return {
    version,
    packageId,
    summary: {
      riskLevel,
      totalFunctions: functions.length,
      criticalRiskFunctions: functions.filter(f => f.risk === 'critical').length,
      highRiskFunctions,
      adminFunctions: functions.filter(f => /admin|set_|update_|pause|withdraw/.test(f.function)).length,
      capabilities,
      coinHandlers,
    },
    permissions: functions,
    vulnerabilities,
    recommendations,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: AuditRequest = await request.json();
    const { packageId, sourceCode, network = 'mainnet', version = 1 } = body;

    if (!packageId || !sourceCode) {
      return NextResponse.json(
        { error: 'packageId and sourceCode are required' },
        { status: 400 }
      );
    }

    // Perform static analysis (AI analysis via local server from browser)
    const auditResult = analyzeSourceCode(sourceCode, packageId, version);

    return NextResponse.json({
      success: true,
      audit: auditResult,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Audit] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Audit failed' },
      { status: 500 }
    );
  }
}
