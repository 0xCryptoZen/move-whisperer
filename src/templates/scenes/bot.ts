/**
 * Trading Bot Scene Template
 * Focus: Entry functions, gas optimization, batch operations, monitoring
 */

export const BOT_SCENE_TEMPLATE = `---
name: {{packageName}}
description: "{{description}}"
scene: bot
---

# {{snakeToTitle moduleName}} - Trading Bot Guide

## Quick Reference

| Property | Value |
|----------|-------|
| Package ID | \`{{packageId}}\` |
| Module | \`{{moduleName}}\` |
| Network | {{network}} |
| Category | {{category}} |

## Entry Functions for Automation

### Priority Functions

| Function | Purpose | Gas Est. | Frequency |
|----------|---------|----------|-----------|
{{#each entryFunctions}}
| \`{{name}}\` | {{truncate semantic.description 40}} | {{gasEstimate semantic.category}} | {{frequencyEstimate semantic.category}} |
{{/each}}

### Function Details

{{#each entryFunctions}}
#### {{name}}

{{semantic.description}}

{{#if (isHighRisk semantic.risk)}}
> ⚠️ **{{riskBadge semantic.risk}}** - {{#each semantic.warnings}}{{this}} {{/each}}
{{/if}}

**Parameters:**
{{#each (filterUserParams parameters)}}
- \`{{name}}\`: \`{{tsType}}\` {{#if isOptional}}(optional){{/if}}
{{/each}}

**Bot Integration:**
\`\`\`typescript
async function {{snakeToCamel name}}Bot(
  client: SuiClient,
  signer: Keypair,
{{#each (filterUserParams parameters)}}
  {{snakeToCamel name}}: {{tsType}},
{{/each}}
) {
  const tx = new Transaction();

  tx.moveCall({
    target: \`{{../packageId}}::{{../moduleName}}::{{name}}\`,
{{#if (length typeParameters)}}
    typeArguments: [/* type args */],
{{/if}}
    arguments: [
{{#each (filterUserParams parameters)}}
{{#if isSystemObject}}
      tx.object('{{defaultValue}}'),
{{else if objectIdRequired}}
      tx.object({{snakeToCamel name}}),
{{else}}
      tx.pure.{{mapToPureType tsType}}({{snakeToCamel name}}),
{{/if}}
{{/each}}
    ],
  });

  // Set gas budget
  tx.setGasBudget(10_000_000);

  const result = await client.signAndExecuteTransaction({
    transaction: tx,
    signer,
    options: {
      showEffects: true,
      showEvents: true,
    },
  });

  return {
    success: result.effects?.status.status === 'success',
    digest: result.digest,
    gasUsed: result.effects?.gasUsed,
{{#if (length returns)}}
    created: result.effects?.created,
{{/if}}
  };
}
\`\`\`

---

{{/each}}

## Gas Optimization

### Gas Estimates by Operation

| Operation Type | Estimated Gas | Optimization Tips |
|---------------|---------------|-------------------|
{{#each entryFunctions}}
| {{name}} | {{gasEstimate semantic.category}} MIST | {{gasOptimizationTip semantic.category}} |
{{/each}}

### PTB Gas Savings

Combine multiple operations in a single transaction:

\`\`\`typescript
// Instead of multiple transactions:
// tx1: operation A
// tx2: operation B
// tx3: operation C

// Use single PTB:
const tx = new Transaction();

// Operation A
const resultA = tx.moveCall({
  target: \`{{packageId}}::{{moduleName}}::function_a\`,
  arguments: [/* ... */],
});

// Operation B (uses result from A)
tx.moveCall({
  target: \`{{packageId}}::{{moduleName}}::function_b\`,
  arguments: [resultA, /* ... */],
});

// Operation C
tx.moveCall({
  target: \`{{packageId}}::{{moduleName}}::function_c\`,
  arguments: [/* ... */],
});

// Single execution = ~40% gas savings
await client.signAndExecuteTransaction({ transaction: tx, signer });
\`\`\`

### Gas Budget Strategy

\`\`\`typescript
// Dynamic gas budget based on operation
function calculateGasBudget(operationType: string): number {
  const GAS_BUDGETS = {
    simple: 5_000_000,
    standard: 10_000_000,
    complex: 50_000_000,
    batch: 100_000_000,
  };
  return GAS_BUDGETS[operationType] || GAS_BUDGETS.standard;
}
\`\`\`

## Batch Operations

### Batch Execution Pattern

\`\`\`typescript
async function batchExecute<T>(
  client: SuiClient,
  signer: Keypair,
  operations: Array<{
    build: (tx: Transaction) => void;
    onSuccess?: (result: any) => void;
  }>,
  maxPerBatch = 10,
) {
  const results = [];

  for (let i = 0; i < operations.length; i += maxPerBatch) {
    const batch = operations.slice(i, i + maxPerBatch);
    const tx = new Transaction();

    batch.forEach(op => op.build(tx));

    try {
      const result = await client.signAndExecuteTransaction({
        transaction: tx,
        signer,
        options: { showEffects: true, showEvents: true },
      });

      results.push({ success: true, result });
      batch.forEach((op, idx) => op.onSuccess?.(result));
    } catch (error) {
      results.push({ success: false, error });
    }

    // Rate limiting
    await sleep(100);
  }

  return results;
}
\`\`\`

### Parallel Execution (Independent Operations)

\`\`\`typescript
async function parallelExecute(
  client: SuiClient,
  signer: Keypair,
  transactions: Transaction[],
  concurrency = 3,
) {
  const semaphore = new Semaphore(concurrency);

  return Promise.all(
    transactions.map(async (tx) => {
      await semaphore.acquire();
      try {
        return await client.signAndExecuteTransaction({
          transaction: tx,
          signer,
        });
      } finally {
        semaphore.release();
      }
    })
  );
}
\`\`\`

## State Monitoring

### Poll for State Changes

\`\`\`typescript
class StateMonitor {
  private client: SuiClient;
  private pollInterval: number;
  private running = false;

  constructor(client: SuiClient, pollIntervalMs = 1000) {
    this.client = client;
    this.pollInterval = pollIntervalMs;
  }

  async start(
    objectId: string,
    onChange: (state: any, prev: any) => void,
  ) {
    this.running = true;
    let prevState = null;

    while (this.running) {
      try {
        const object = await this.client.getObject({
          id: objectId,
          options: { showContent: true },
        });

        const currentState = object.data?.content?.fields;

        if (prevState && JSON.stringify(prevState) !== JSON.stringify(currentState)) {
          onChange(currentState, prevState);
        }

        prevState = currentState;
      } catch (error) {
        console.error('Monitor error:', error);
      }

      await sleep(this.pollInterval);
    }
  }

  stop() {
    this.running = false;
  }
}
\`\`\`

### Event-Based Monitoring

\`\`\`typescript
async function subscribeToEvents(
  client: SuiClient,
  onEvent: (event: any) => void,
) {
{{#if (length events)}}
{{#with (first events)}}
  const unsubscribe = await client.subscribeEvent({
    filter: {
      MoveEventType: \`{{../../packageId}}::{{../../moduleName}}::{{name}}\`,
    },
    onMessage: (event) => {
      onEvent(event.parsedJson);
    },
  });

  return unsubscribe;
{{/with}}
{{else}}
  // No events in this module - use polling instead
  console.log('No events available, using polling');
  return () => {};
{{/if}}
}
\`\`\`

## Price/Data Fetching

{{#if (hasCategory category "dex")}}
### DEX Price Queries

\`\`\`typescript
async function getPoolPrice(
  client: SuiClient,
  poolId: string,
): Promise<{ priceAtoB: number; priceBtoA: number }> {
  const pool = await client.getObject({
    id: poolId,
    options: { showContent: true },
  });

  const fields = pool.data?.content?.fields;
  // Extract and calculate price from pool state
  // Implementation depends on specific DEX design

  return {
    priceAtoB: 0, // Calculate from reserves
    priceBtoA: 0,
  };
}
\`\`\`
{{/if}}

### Generic State Query

\`\`\`typescript
async function queryModuleState(
  client: SuiClient,
  objectId: string,
) {
  const object = await client.getObject({
    id: objectId,
    options: {
      showContent: true,
      showType: true,
    },
  });

  return object.data?.content?.fields;
}
\`\`\`

## Risk Controls

### Slippage Protection

\`\`\`typescript
function calculateMinOutput(
  expectedOutput: bigint,
  slippageBps: number = 50, // 0.5% default
): bigint {
  return expectedOutput - (expectedOutput * BigInt(slippageBps)) / 10000n;
}
\`\`\`

### Position Limits

\`\`\`typescript
interface RiskLimits {
  maxPositionSize: bigint;
  maxDailyVolume: bigint;
  maxOpenPositions: number;
}

class RiskManager {
  private limits: RiskLimits;
  private dailyVolume = 0n;
  private openPositions = 0;

  constructor(limits: RiskLimits) {
    this.limits = limits;
  }

  canExecute(size: bigint): boolean {
    if (size > this.limits.maxPositionSize) return false;
    if (this.dailyVolume + size > this.limits.maxDailyVolume) return false;
    if (this.openPositions >= this.limits.maxOpenPositions) return false;
    return true;
  }

  recordTrade(size: bigint) {
    this.dailyVolume += size;
    this.openPositions++;
  }
}
\`\`\`

### Circuit Breaker

\`\`\`typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailure = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private threshold: number = 5,
    private resetTimeout: number = 60000,
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailure > this.resetTimeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure() {
    this.failures++;
    this.lastFailure = Date.now();
    if (this.failures >= this.threshold) {
      this.state = 'open';
    }
  }
}
\`\`\`

## Monitoring Metrics

### Key Metrics to Track

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| Gas Usage | Average gas per tx | > 50M MIST |
| Success Rate | % successful txs | < 95% |
| Latency | Time to confirmation | > 5s |
| Error Rate | Errors per minute | > 5 |
| Position Value | Total value at risk | > limit |

### Logging Pattern

\`\`\`typescript
interface TxLog {
  timestamp: number;
  function: string;
  digest: string;
  success: boolean;
  gasUsed: number;
  latencyMs: number;
  error?: string;
}

function logTransaction(log: TxLog) {
  console.log(JSON.stringify({
    ...log,
    timestamp: new Date(log.timestamp).toISOString(),
  }));
}
\`\`\`

## Utilities

\`\`\`typescript
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

class Semaphore {
  private permits: number;
  private waiting: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire() {
    if (this.permits > 0) {
      this.permits--;
      return;
    }
    await new Promise<void>(r => this.waiting.push(r));
  }

  release() {
    const next = this.waiting.shift();
    if (next) {
      next();
    } else {
      this.permits++;
    }
  }
}
\`\`\`

---

*Generated by MoveWhisperer v{{generatorVersion}} | Scene: Trading Bot | {{generatedAt}}*
`;
