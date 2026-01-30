/**
 * Security Audit Scene Template
 * Focus: Permission model, asset flows, risk classification, vulnerability checklist
 */

export const AUDIT_SCENE_TEMPLATE = `---
name: {{packageName}}
description: "{{description}}"
scene: audit
---

# {{snakeToTitle moduleName}} - Security Analysis

## Executive Summary

| Metric | Value |
|--------|-------|
| Package ID | \`{{packageId}}\` |
| Module | \`{{moduleName}}\` |
| Network | {{network}} |
| Total Functions | {{totalFunctions}} |
| Entry Functions | {{entryFunctionCount}} |
| High-Risk Functions | {{highRiskCount}} |

## Permission Model

### Access Control Matrix

| Function | Visibility | Entry | Risk | Who Can Call |
|----------|------------|-------|------|--------------|
{{#each entryFunctions}}
| \`{{name}}\` | {{visibility}} | ✓ | {{riskBadge semantic.risk}} | {{#if (isAdminFunction semantic.category)}}Admin Only{{else}}Any User{{/if}} |
{{/each}}
{{#each publicFunctions}}
| \`{{name}}\` | {{visibility}} | - | {{riskBadge semantic.risk}} | Via PTB |
{{/each}}

### Capability Objects

{{#each structs}}
{{#if (isCapability name)}}
#### {{name}}
**Type:** Capability Object
**Purpose:** Controls access to privileged operations

{{#if (length fields)}}
| Field | Type | Security Relevance |
|-------|------|-------------------|
{{#each fields}}
| \`{{name}}\` | \`{{tsType}}\` | {{description}} |
{{/each}}
{{/if}}

{{/if}}
{{/each}}

## Asset Flow Analysis

### Token Handling Functions

{{#each entryFunctions}}
{{#if (handlesCoin parameters)}}
#### {{name}}

{{semantic.description}}

**Coin Parameters:**
{{#each (filterCoinParams parameters)}}
- \`{{name}}\`: \`{{tsType}}\` - {{description}}
{{/each}}

{{#if (length returns)}}
**Coin Returns:**
{{#each (filterCoinReturns returns)}}
- \`{{tsType}}\` - {{description}}
{{/each}}
{{/if}}

⚠️ **Audit Points:**
- Verify amount calculations
- Check for overflow/underflow
- Validate recipient addresses

---

{{/if}}
{{/each}}

### Asset Entry Points

\`\`\`
User Assets → [{{moduleName}}] → Protocol
{{#each entryFunctions}}
{{#if (handlesCoin parameters)}}
  └─ {{name}}: {{#each (filterCoinParams parameters)}}{{tsType}}{{#unless @last}}, {{/unless}}{{/each}}
{{/if}}
{{/each}}
\`\`\`

### Asset Exit Points

\`\`\`
Protocol → [{{moduleName}}] → User Assets
{{#each entryFunctions}}
{{#if (returnsCoin returns)}}
  └─ {{name}}: returns {{#each (filterCoinReturns returns)}}{{tsType}}{{#unless @last}}, {{/unless}}{{/each}}
{{/if}}
{{/each}}
\`\`\`

## Risk Classification

### 🔴 Critical Risk Functions

{{#each (filterByRisk entryFunctions "critical")}}
#### {{name}}

{{semantic.description}}

**Risk Factors:**
{{#each semantic.warnings}}
- {{this}}
{{/each}}

**Recommendations:**
- Add access control if not present
- Implement rate limiting
- Add event logging for monitoring

---

{{/each}}
{{#unless (length (filterByRisk entryFunctions "critical"))}}
No critical risk functions identified.
{{/unless}}

### 🟠 High Risk Functions

{{#each (filterByRisk entryFunctions "high")}}
#### {{name}}

{{semantic.description}}

**Risk Factors:**
{{#each semantic.warnings}}
- {{this}}
{{/each}}

---

{{/each}}
{{#unless (length (filterByRisk entryFunctions "high"))}}
No high risk functions identified.
{{/unless}}

### 🟡 Medium Risk Functions

{{#each (filterByRisk entryFunctions "medium")}}
- \`{{name}}\`: {{semantic.description}}
{{/each}}
{{#unless (length (filterByRisk entryFunctions "medium"))}}
No medium risk functions identified.
{{/unless}}

### 🟢 Low Risk Functions

{{#each (filterByRisk entryFunctions "low")}}
- \`{{name}}\`: {{semantic.description}}
{{/each}}

## Vulnerability Checklist

### Common Move Vulnerabilities

| Check | Status | Notes |
|-------|--------|-------|
| Integer Overflow | {{#if (usesArithmetic entryFunctions)}}⚠️ Review{{else}}✅ N/A{{/if}} | Check all arithmetic operations |
| Reentrancy | ✅ Sui Prevents | Sui's object model prevents classic reentrancy |
| Access Control | {{#if (hasAdminFunctions entryFunctions)}}⚠️ Review{{else}}✅ N/A{{/if}} | Verify capability checks |
| Flash Loan Attack | {{#if (hasCategory category "dex")}}⚠️ Review{{else}}✅ N/A{{/if}} | Check price manipulation vectors |
| Timestamp Dependence | {{#if (usesClock entryFunctions)}}⚠️ Review{{else}}✅ N/A{{/if}} | Verify clock usage |
| Unchecked External Calls | ⚠️ Review | Verify all external package calls |

### Sui-Specific Checks

| Check | Status | Notes |
|-------|--------|-------|
| Object Ownership | ⚠️ Review | Verify correct ownership model |
| Shared Object Contention | {{#if (hasSharedObjects structs)}}⚠️ Review{{else}}✅ N/A{{/if}} | Check for DoS vectors |
| Dynamic Fields | {{#if (usesDynamicFields entryFunctions)}}⚠️ Review{{else}}✅ N/A{{/if}} | Verify key collision handling |
| Hot Potato | ⚠️ Review | Check for proper consumption |
| Witness Pattern | ⚠️ Review | Verify one-time witness usage |

## Admin Functions

{{#each entryFunctions}}
{{#if (isAdminFunction semantic.category)}}
### {{name}}

{{semantic.description}}

**Parameters:**
{{#each (filterUserParams parameters)}}
- \`{{name}}\`: \`{{tsType}}\`
{{/each}}

**Security Concerns:**
- Requires capability: {{#if (requiresCapability parameters)}}Yes{{else}}⚠️ No capability check detected{{/if}}
- Can modify state: {{#if (modifiesState parameters)}}Yes{{else}}No{{/if}}

---

{{/if}}
{{/each}}
{{#unless (hasAdminFunctions entryFunctions)}}
No admin functions detected in this module.
{{/unless}}

## Upgrade Analysis

| Aspect | Assessment |
|--------|------------|
| Package ID | \`{{packageId}}\` |
| Upgrade Policy | {{#if (isImmutable packageId)}}Immutable{{else}}⚠️ Potentially Upgradable{{/if}} |
| State Migration | Review required if upgrades are possible |

## Recommendations

### Immediate Actions
{{#each (filterByRisk entryFunctions "critical")}}
1. Review \`{{name}}\` for access control
{{/each}}

### Short-term Improvements
{{#each (filterByRisk entryFunctions "high")}}
- Add monitoring for \`{{name}}\`
{{/each}}

### Best Practices
- Implement comprehensive event logging
- Add rate limiting for sensitive operations
- Consider time-locks for admin operations
- Set up monitoring for unusual activity

{{#if (length events)}}
## Event Monitoring

Events that should be monitored:

{{#each events}}
### {{name}}
{{description}}

| Field | Type | Monitor For |
|-------|------|-------------|
{{#each fields}}
| \`{{name}}\` | \`{{tsType}}\` | Unusual values |
{{/each}}

{{/each}}
{{/if}}

{{#if sourceCode}}
## Source Code

Disassembled Move bytecode for manual review:

\`\`\`move
{{{sourceCode}}}
\`\`\`

{{/if}}
---

*Generated by auto-sui-skills v{{generatorVersion}} | Scene: Security Audit | {{generatedAt}}*

**Disclaimer:** This is an automated analysis and should be supplemented with manual review by security professionals.
`;
