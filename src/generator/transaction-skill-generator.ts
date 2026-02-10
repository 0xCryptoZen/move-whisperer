/**
 * Transaction Skill Generator
 * Generates SKILL.md from transaction analysis
 */

import Handlebars from 'handlebars';
import type {
  FetchedTransaction,
  InvolvedPackage,
} from '../fetcher/transaction-fetcher.js';
import type {
  TransactionParseResult,
} from '../analyzer/transaction-parser.js';

export interface TransactionSkillOptions {
  language: 'en' | 'zh';
  includeScripts: boolean;
  includeReplicationGuide: boolean;
}

export interface GeneratedTransactionSkill {
  content: string;
  metadata: {
    title: string;
    description: string;
    txType: string;
    packages: string[];
    functions: string[];
  };
}

const DEFAULT_OPTIONS: TransactionSkillOptions = {
  language: 'en',
  includeScripts: true,
  includeReplicationGuide: true,
};

/**
 * Generate a SKILL.md from fetched transaction and parse result
 */
export function generateTransactionSkill(
  tx: FetchedTransaction,
  parseResult: TransactionParseResult,
  options: Partial<TransactionSkillOptions> = {}
): GeneratedTransactionSkill {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Collect unique packages and functions
  const packages = parseResult.involvedPackages.map((p: InvolvedPackage) => p.packageId);
  const functions = tx.moveCalls.map(c => `${c.moduleName}::${c.functionName}`);

  // Generate title and description
  const title = generateTitle(parseResult, tx);
  const description = generateDescription(tx, opts.language);

  // Prepare template data
  const templateData = {
    title,
    description,
    digest: tx.digest,
    network: tx.network,
    type: parseResult.transactionType,
    confidence: Math.round(parseResult.typeConfidence * 100),
    status: tx.status,
    sender: tx.sender,
    gasUsed: formatGas(tx.gasUsed.totalCost),
    packages: packages.map((p: string) => ({
      id: p,
      shortId: p.slice(0, 16) + '...',
    })),
    moveCalls: tx.moveCalls.map((call, i) => ({
      index: i + 1,
      packageId: call.packageId,
      moduleName: call.moduleName,
      functionName: call.functionName,
      target: `${call.packageId}::${call.moduleName}::${call.functionName}`,
      shortTarget: `${call.moduleName}::${call.functionName}`,
      typeArguments: call.typeArguments,
      hasTypeArgs: call.typeArguments.length > 0,
      purpose: parseResult.callSequence[i]?.purpose || inferCallPurpose(call.functionName),
    })),
    balanceChanges: tx.balanceChanges.map(bc => ({
      coinType: bc.coinType,
      shortCoinType: extractCoinName(bc.coinType),
      amount: bc.amount,
      formattedAmount: formatAmount(bc.amount, bc.coinType),
      isPositive: BigInt(bc.amount) > 0n,
    })),
    objectChanges: groupObjectChanges(tx.objectChanges),
    includeScripts: opts.includeScripts,
    includeReplicationGuide: opts.includeReplicationGuide,
    language: opts.language,
    isEnglish: opts.language === 'en',
  };

  // Render template
  const template = getTransactionTemplate(opts.language);
  const compiled = Handlebars.compile(template);
  const content = compiled(templateData);

  return {
    content,
    metadata: {
      title,
      description,
      txType: parseResult.transactionType,
      packages,
      functions,
    },
  };
}

function generateTitle(parseResult: TransactionParseResult, tx: FetchedTransaction): string {
  const typeLabels: Record<string, string> = {
    swap: 'Token Swap',
    transfer: 'Token Transfer',
    mint: 'Token Mint',
    burn: 'Token Burn',
    stake: 'Staking',
    unstake: 'Unstaking',
    liquidity_add: 'Add Liquidity',
    liquidity_remove: 'Remove Liquidity',
    borrow: 'Borrow',
    repay: 'Repay',
    claim: 'Claim Rewards',
    governance: 'Governance',
    upgrade: 'Package Upgrade',
    publish: 'Package Publish',
    complex: 'Complex Transaction',
    unknown: 'Transaction',
  };

  const typeLabel = typeLabels[parseResult.transactionType] || 'Transaction';

  // Try to identify the protocol from package IDs
  const protocol = identifyProtocol(tx.moveCalls);

  if (protocol) {
    return `${protocol} ${typeLabel} Skill`;
  }

  return `${typeLabel} Skill`;
}

function generateDescription(tx: FetchedTransaction, language: 'en' | 'zh'): string {
  const callCount = tx.moveCalls.length;
  const packageCount = new Set(tx.moveCalls.map(c => c.packageId)).size;

  if (language === 'zh') {
    return `从交易 ${tx.digest.slice(0, 10)}... 生成的技能文档。包含 ${callCount} 个函数调用，涉及 ${packageCount} 个合约包。`;
  }

  return `Skill generated from transaction ${tx.digest.slice(0, 10)}... containing ${callCount} function calls across ${packageCount} package(s).`;
}

function identifyProtocol(calls: FetchedTransaction['moveCalls']): string | null {
  for (const call of calls) {
    const pkg = call.packageId.toLowerCase();

    // Known protocols
    if (pkg.startsWith('0x1eabed72c53feb73')) return 'Cetus';
    if (pkg.startsWith('0xdee9')) return 'DeepBook';
    if (pkg.startsWith('0x91bfbc386a41afcfd9b2533058d7e915a1d3829089cc268ff4333d54d6339ca1')) return 'Turbos';
    if (pkg.startsWith('0xefe8b36d5b2e43728cc323298626b83177803521d195cfb11e15b910e892fddf')) return 'Scallop';
    if (pkg.startsWith('0xa0eba10b173538c8fecca1dff298e488402cc9ff374f8a12ca7758eebe830b66')) return 'Kriya';
    if (pkg.startsWith('0x5306f64e312b581766351c07af79c72fcb1cd25147157fdc2f8ad76de9a3fb6a')) return 'Wormhole';
  }

  return null;
}

function inferCallPurpose(functionName: string): string {
  const fn = functionName.toLowerCase();

  if (fn.includes('swap')) return 'Execute token swap';
  if (fn.includes('transfer')) return 'Transfer tokens/objects';
  if (fn.includes('mint')) return 'Mint new tokens';
  if (fn.includes('burn')) return 'Burn tokens';
  if (fn.includes('stake') || fn.includes('deposit')) return 'Stake/deposit assets';
  if (fn.includes('unstake') || fn.includes('withdraw')) return 'Unstake/withdraw assets';
  if (fn.includes('borrow')) return 'Borrow assets';
  if (fn.includes('repay')) return 'Repay borrowed assets';
  if (fn.includes('claim') || fn.includes('harvest')) return 'Claim rewards';
  if (fn.includes('add_liquidity') || fn.includes('open_position')) return 'Add liquidity';
  if (fn.includes('remove_liquidity') || fn.includes('close_position')) return 'Remove liquidity';
  if (fn.includes('create') || fn.includes('new')) return 'Create new object';
  if (fn.includes('update') || fn.includes('set')) return 'Update state';
  if (fn.includes('destroy') || fn.includes('delete')) return 'Destroy object';

  return `Call ${functionName}`;
}

function formatGas(gas: string): string {
  const value = BigInt(gas);
  if (value >= 1_000_000_000n) {
    return `${(Number(value) / 1_000_000_000).toFixed(4)} SUI`;
  }
  if (value >= 1_000_000n) {
    return `${(Number(value) / 1_000_000).toFixed(2)}M MIST`;
  }
  return `${value} MIST`;
}

function formatAmount(amount: string, coinType: string): string {
  const value = BigInt(amount);
  const absValue = value < 0n ? -value : value;
  const sign = value < 0n ? '-' : '+';

  // SUI has 9 decimals
  if (coinType.includes('sui::SUI') || coinType.includes('0x2::sui::SUI')) {
    const formatted = (Number(absValue) / 1_000_000_000).toFixed(4);
    return `${sign}${formatted} SUI`;
  }

  // Most tokens have 6-9 decimals
  if (absValue >= 1_000_000_000n) {
    return `${sign}${(Number(absValue) / 1_000_000_000).toFixed(4)}`;
  }
  if (absValue >= 1_000_000n) {
    return `${sign}${(Number(absValue) / 1_000_000).toFixed(2)}`;
  }

  return `${sign}${absValue}`;
}

function extractCoinName(coinType: string): string {
  // Extract the last part of the type
  const parts = coinType.split('::');
  return parts[parts.length - 1] || coinType;
}

interface ObjectChangeLocal {
  type: string;
  objectId: string;
  objectType: string;
}

function groupObjectChanges(changes: ObjectChangeLocal[]): {
  created: ObjectChangeLocal[];
  mutated: ObjectChangeLocal[];
  deleted: ObjectChangeLocal[];
} {
  return {
    created: changes.filter(c => c.type === 'created'),
    mutated: changes.filter(c => c.type === 'mutated'),
    deleted: changes.filter(c => c.type === 'deleted'),
  };
}

function getTransactionTemplate(language: 'en' | 'zh'): string {
  if (language === 'zh') {
    return TRANSACTION_TEMPLATE_ZH;
  }
  return TRANSACTION_TEMPLATE_EN;
}

const TRANSACTION_TEMPLATE_EN = `---
name: {{title}}
description: {{description}}
scene: transaction
network: {{network}}
---

# {{title}}

{{description}}

## Transaction Overview

| Property | Value |
|----------|-------|
| **Digest** | \`{{digest}}\` |
| **Network** | {{network}} |
| **Type** | {{type}} ({{confidence}}% confidence) |
| **Status** | {{status}} |
| **Gas Used** | {{gasUsed}} |

## Involved Packages

{{#each packages}}
- \`{{id}}\`
{{/each}}

## Call Sequence

This transaction executes the following Move function calls in order:

{{#each moveCalls}}
### {{index}}. {{shortTarget}}

| Property | Value |
|----------|-------|
| **Package** | \`{{packageId}}\` |
| **Module** | {{moduleName}} |
| **Function** | {{functionName}} |
| **Purpose** | {{purpose}} |
{{#if hasTypeArgs}}
| **Type Arguments** | {{#each typeArguments}}\`{{this}}\`{{#unless @last}}, {{/unless}}{{/each}} |
{{/if}}

{{/each}}

{{#if balanceChanges.length}}
## Balance Changes

| Token | Amount |
|-------|--------|
{{#each balanceChanges}}
| {{shortCoinType}} | {{formattedAmount}} |
{{/each}}
{{/if}}

{{#if objectChanges.created.length}}
## Objects Created

{{#each objectChanges.created}}
- \`{{objectId}}\` ({{objectType}})
{{/each}}
{{/if}}

{{#if objectChanges.mutated.length}}
## Objects Mutated

{{#each objectChanges.mutated}}
- \`{{objectId}}\` ({{objectType}})
{{/each}}
{{/if}}

{{#if includeReplicationGuide}}
## How to Replicate This Transaction

To replicate this transaction pattern using the Sui TypeScript SDK:

\`\`\`typescript
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';

const client = new SuiClient({ url: getFullnodeUrl('{{network}}') });

async function replicateTransaction() {
  const tx = new Transaction();

{{#each moveCalls}}
  // Step {{index}}: {{purpose}}
  tx.moveCall({
    target: '{{target}}',
    {{#if hasTypeArgs}}
    typeArguments: [
      {{#each typeArguments}}
      '{{this}}',
      {{/each}}
    ],
    {{/if}}
    arguments: [
      // TODO: Add appropriate arguments
    ],
  });

{{/each}}
  return tx;
}
\`\`\`
{{/if}}

{{#if includeScripts}}
## Quick Reference

### Fetch Original Transaction

\`\`\`bash
sui client tx-block {{digest}} --json
\`\`\`

### Related Package ABIs

{{#each packages}}
\`\`\`bash
sui client object {{id}} --json
\`\`\`
{{/each}}
{{/if}}

## Notes

- This skill was auto-generated from an on-chain transaction
- Actual argument values and object IDs will differ when replicating
- Always test on testnet/devnet before mainnet
- Gas costs may vary based on current network conditions

---
*Generated by MoveWhisperer from transaction {{digest}}*
`;

const TRANSACTION_TEMPLATE_ZH = `---
name: {{title}}
description: {{description}}
scene: transaction
network: {{network}}
---

# {{title}}

{{description}}

## 交易概览

| 属性 | 值 |
|------|-----|
| **交易摘要** | \`{{digest}}\` |
| **网络** | {{network}} |
| **类型** | {{type}} ({{confidence}}% 置信度) |
| **状态** | {{status}} |
| **Gas消耗** | {{gasUsed}} |

## 涉及的合约包

{{#each packages}}
- \`{{id}}\`
{{/each}}

## 调用序列

此交易按顺序执行以下Move函数调用：

{{#each moveCalls}}
### {{index}}. {{shortTarget}}

| 属性 | 值 |
|------|-----|
| **包地址** | \`{{packageId}}\` |
| **模块** | {{moduleName}} |
| **函数** | {{functionName}} |
| **用途** | {{purpose}} |
{{#if hasTypeArgs}}
| **类型参数** | {{#each typeArguments}}\`{{this}}\`{{#unless @last}}, {{/unless}}{{/each}} |
{{/if}}

{{/each}}

{{#if balanceChanges.length}}
## 余额变化

| 代币 | 数量 |
|------|------|
{{#each balanceChanges}}
| {{shortCoinType}} | {{formattedAmount}} |
{{/each}}
{{/if}}

{{#if objectChanges.created.length}}
## 创建的对象

{{#each objectChanges.created}}
- \`{{objectId}}\` ({{objectType}})
{{/each}}
{{/if}}

{{#if objectChanges.mutated.length}}
## 修改的对象

{{#each objectChanges.mutated}}
- \`{{objectId}}\` ({{objectType}})
{{/each}}
{{/if}}

{{#if includeReplicationGuide}}
## 如何复制此交易

使用Sui TypeScript SDK复制此交易模式：

\`\`\`typescript
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';

const client = new SuiClient({ url: getFullnodeUrl('{{network}}') });

async function replicateTransaction() {
  const tx = new Transaction();

{{#each moveCalls}}
  // 步骤 {{index}}: {{purpose}}
  tx.moveCall({
    target: '{{target}}',
    {{#if hasTypeArgs}}
    typeArguments: [
      {{#each typeArguments}}
      '{{this}}',
      {{/each}}
    ],
    {{/if}}
    arguments: [
      // TODO: 添加适当的参数
    ],
  });

{{/each}}
  return tx;
}
\`\`\`
{{/if}}

{{#if includeScripts}}
## 快速参考

### 获取原始交易

\`\`\`bash
sui client tx-block {{digest}} --json
\`\`\`

### 相关合约ABI

{{#each packages}}
\`\`\`bash
sui client object {{id}} --json
\`\`\`
{{/each}}
{{/if}}

## 注意事项

- 此技能文档由链上交易自动生成
- 复制时实际的参数值和对象ID会有所不同
- 请务必先在测试网/开发网上测试后再用于主网
- Gas费用可能因当前网络状况而异

---
*由 MoveWhisperer 从交易 {{digest}} 生成*
`;

export default generateTransactionSkill;
