# Sui Skill Generator - Usage Examples

## Example 1: SDK Integration Request

**User**: "Help me integrate with DeepBook's CLOB"

**Claude's Process**:
1. Identify scene: SDK (user wants to integrate)
2. Identify contract: DeepBook → `0xdee9::clob_v2`
3. Fetch module data via RPC
4. Generate SDK-focused skill

**Generated Output** (excerpt):
```markdown
# Clob V2 - SDK Integration Guide

## Quick Start

\`\`\`typescript
import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';

const client = new SuiClient({ url: 'https://fullnode.mainnet.sui.io' });
const tx = new Transaction();

// Place a limit order
tx.moveCall({
  target: '0xdee9::clob_v2::place_limit_order',
  typeArguments: [baseType, quoteType],
  arguments: [
    tx.object(poolId),
    tx.pure.u64(price),
    tx.pure.u64(quantity),
    // ... more args
  ],
});
\`\`\`

## Function Reference

| Function | Purpose | Risk |
|----------|---------|------|
| `place_limit_order` | Place a limit order | Medium |
| `cancel_order` | Cancel existing order | Low |
| `swap_exact_base_for_quote` | Market swap | Medium |
...
```

---

## Example 2: Security Audit Request

**User**: "I need to audit this DeFi contract 0x..."

**Claude's Process**:
1. Identify scene: Audit (user mentioned "audit")
2. Fetch module data
3. Analyze for security concerns
4. Generate audit-focused skill

**Generated Output** (excerpt):
```markdown
# Module Name - Security Analysis

## Executive Summary

| Metric | Value |
|--------|-------|
| Total Functions | 15 |
| Entry Functions | 8 |
| High-Risk Functions | 3 |

## Permission Model

| Function | Access | Risk |
|----------|--------|------|
| `admin_withdraw` | Admin Only | 🔴 Critical |
| `set_fee` | Admin Only | 🟠 High |
| `deposit` | Any User | 🟢 Low |

## Vulnerability Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Integer Overflow | ⚠️ Review | Multiple arithmetic ops |
| Access Control | ✅ Present | AdminCap required |
| Reentrancy | ✅ Safe | Sui prevents |
...
```

---

## Example 3: Learning Request

**User**: "Explain how Cetus AMM works"

**Claude's Process**:
1. Identify scene: Learn (user wants to understand)
2. Fetch Cetus pool module
3. Analyze architecture
4. Generate educational skill

**Generated Output** (excerpt):
```markdown
# Pool - Protocol Deep Dive

## One-Liner

Cetus implements concentrated liquidity AMM, allowing LPs to provide liquidity in specific price ranges.

## Architecture

\`\`\`mermaid
graph TB
    User((User)) -->|add_liquidity| Pool
    User -->|swap| Pool
    Pool --> Position
    Pool --> TickManager
    Position -->|stores| LiquidityInfo
\`\`\`

## Core Concepts

### Pool
The central object holding token reserves and configuration.
- **Abilities**: `key` (shared object)
- **Key Fields**:
  - `coin_a`: Reserve of token A
  - `coin_b`: Reserve of token B
  - `tick_spacing`: Minimum price granularity

### Position
Represents a liquidity provider's stake.
- **Abilities**: `key, store` (owned, transferable)
- Created when adding liquidity
- Tracks earned fees
...
```

---

## Example 4: Frontend Development Request

**User**: "I'm building a UI for this NFT marketplace"

**Claude's Process**:
1. Identify scene: Frontend
2. Fetch marketplace module
3. Focus on user flows and data fetching
4. Generate frontend-focused skill

**Generated Output** (excerpt):
```markdown
# Marketplace - Frontend Integration Guide

## User States & Actions

| State | Data to Show | Actions |
|-------|--------------|---------|
| Not Connected | Browse listings | Connect Wallet |
| Connected, No NFTs | Empty state | Buy NFT |
| Connected, Has NFTs | My NFTs grid | List, Delist |

## User Operations

### List NFT for Sale

**Required Inputs:**
- NFT Object ID (select from owned)
- Price (number input with decimals)

\`\`\`typescript
async function listNft(nftId: string, price: bigint) {
  const tx = new Transaction();
  tx.moveCall({
    target: '0x...::marketplace::list',
    arguments: [
      tx.object(nftId),
      tx.pure.u64(price),
    ],
  });
  // ... execute
}
\`\`\`

## Event Listening

\`\`\`typescript
// Subscribe to new listings
client.subscribeEvent({
  filter: { MoveEventType: '0x...::marketplace::ListingCreated' },
  onMessage: (event) => {
    // Update UI with new listing
  },
});
\`\`\`
...
```

---

## Example 5: Bot Development Request

**User**: "I want to build an arbitrage bot for this DEX"

**Claude's Process**:
1. Identify scene: Bot
2. Fetch DEX module
3. Focus on automation and efficiency
4. Generate bot-focused skill

**Generated Output** (excerpt):
```markdown
# Swap - Trading Bot Guide

## Entry Functions for Automation

| Function | Gas Est. | Frequency |
|----------|----------|-----------|
| `swap_a_to_b` | ~15M | High |
| `swap_b_to_a` | ~15M | High |
| `flash_swap` | ~25M | Medium |

## Batch Operations

\`\`\`typescript
// Combine multiple swaps in one PTB
const tx = new Transaction();

// Swap on Pool 1
const coinOut1 = tx.moveCall({
  target: '0x...::swap::swap_a_to_b',
  arguments: [pool1, coinIn, ...],
});

// Use output for Pool 2
tx.moveCall({
  target: '0x...::swap::swap_a_to_b',
  arguments: [pool2, coinOut1, ...],
});

// Single transaction = gas savings
\`\`\`

## Monitoring

\`\`\`typescript
class PriceMonitor {
  async getPrice(poolId: string): Promise<number> {
    const pool = await client.getObject({
      id: poolId,
      options: { showContent: true },
    });
    const fields = pool.data?.content?.fields;
    // Calculate price from reserves
    return reserveB / reserveA;
  }
}
\`\`\`
...
```

---

## Key Patterns

1. **Scene Detection**:
   - "integrate", "call", "use" → SDK
   - "understand", "explain", "learn" → Learn
   - "audit", "security", "review" → Audit
   - "UI", "frontend", "build app" → Frontend
   - "bot", "automate", "arbitrage" → Bot
   - "document", "API", "reference" → Docs

2. **Contract Identification**:
   - Explicit package ID: `0x...`
   - Protocol name: "Cetus", "DeepBook" → look up known IDs
   - Module specification: `0x...::module_name`

3. **Network Selection**:
   - Default: mainnet
   - User mentions "testnet" or "devnet" → use that network
