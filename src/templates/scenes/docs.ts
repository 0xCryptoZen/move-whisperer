/**
 * Documentation Generation Scene Template
 * Focus: API reference, terminology, FAQ, usage examples
 */

export const DOCS_SCENE_TEMPLATE = `---
name: {{packageName}}
description: "{{description}}"
scene: docs
---

# {{snakeToTitle moduleName}} Documentation

## Overview

{{overview}}

**Contract Details:**

| Property | Value |
|----------|-------|
| Package ID | \`{{packageId}}\` |
| Module | \`{{moduleName}}\` |
| Network | {{network}} |
| Category | {{category}} |

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Module Index](#module-index)
3. [API Reference](#api-reference)
   - [Entry Functions](#entry-functions)
   - [Public Functions](#public-functions)
4. [Type Definitions](#type-definitions)
{{#if (length events)}}
5. [Events](#events)
{{/if}}
6. [Terminology](#terminology)
7. [Examples](#examples)
8. [FAQ](#faq)

---

## Quick Start

### Prerequisites

- Node.js 18+
- Sui CLI (optional, for local testing)
- A Sui wallet with SUI for gas

### Installation

\`\`\`bash
npm install @mysten/sui
\`\`\`

### Basic Usage

\`\`\`typescript
import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';

// Initialize client
const client = new SuiClient({ url: '{{rpcUrl}}' });

// Create transaction
const tx = new Transaction();

{{#if primaryFunction}}
// Example: Call {{primaryFunction.name}}
tx.moveCall({
  target: \`{{packageId}}::{{moduleName}}::{{primaryFunction.name}}\`,
  arguments: [
{{#each primaryFunction.exampleArgs}}
    {{{this}}},
{{/each}}
  ],
});
{{/if}}

// Execute
const result = await client.signAndExecuteTransaction({
  transaction: tx,
  signer: yourKeypair,
});

console.log('Transaction digest:', result.digest);
\`\`\`

---

## Module Index

### Functions Overview

| Function | Type | Description |
|----------|------|-------------|
{{#each entryFunctions}}
| [\`{{name}}\`](#{{lowercase name}}) | Entry | {{truncate semantic.description 50}} |
{{/each}}
{{#each publicFunctions}}
| [\`{{name}}\`](#{{lowercase name}}-1) | Public | {{truncate semantic.description 50}} |
{{/each}}

### Types Overview

| Type | Abilities | Description |
|------|-----------|-------------|
{{#each structs}}
| [\`{{name}}\`](#{{lowercase name}}-type) | {{join abilities ", "}} | {{#if isEvent}}Event{{else}}Struct{{/if}} |
{{/each}}

---

## API Reference

### Entry Functions

Entry functions can be called directly in a transaction.

{{#each entryFunctions}}
<a id="{{lowercase name}}"></a>
#### \`{{name}}\`

{{semantic.description}}

**Signature:**
\`\`\`move
public entry fun {{name}}{{#if (length typeParameters)}}<{{#each typeParameters}}{{name}}{{#unless @last}}, {{/unless}}{{/each}}>{{/if}}(
{{#each parameters}}
    {{name}}: {{formatMoveType moveType}},
{{/each}}
)
\`\`\`

{{#if (length typeParameters)}}
**Type Parameters:**

| Name | Constraints | Description |
|------|-------------|-------------|
{{#each typeParameters}}
| \`{{name}}\` | {{#if (length constraints)}}{{join constraints ", "}}{{else}}None{{/if}} | Type parameter |
{{/each}}
{{/if}}

{{#if (length (filterUserParams parameters))}}
**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
{{#each (filterUserParams parameters)}}
| \`{{name}}\` | \`{{tsType}}\` | {{#if isOptional}}No{{else}}Yes{{/if}} | {{description}} |
{{/each}}
{{/if}}

{{#if (length returns)}}
**Returns:**

| Type | Description |
|------|-------------|
{{#each returns}}
| \`{{tsType}}\` | {{description}} |
{{/each}}
{{/if}}

{{#if (isHighRisk semantic.risk)}}
**⚠️ Warning:** {{riskBadge semantic.risk}}
{{#each semantic.warnings}}
- {{this}}
{{/each}}
{{/if}}

**Example:**
\`\`\`typescript
const tx = new Transaction();

tx.moveCall({
  target: \`{{../packageId}}::{{../moduleName}}::{{name}}\`,
{{#if (length typeParameters)}}
  typeArguments: [
{{#each typeParameters}}
    '0x2::sui::SUI',
{{/each}}
  ],
{{/if}}
  arguments: [
{{#each (filterUserParams parameters)}}
{{#if isSystemObject}}
    tx.object('{{defaultValue}}'),
{{else if objectIdRequired}}
    tx.object('0x...'), // {{name}}
{{else}}
    tx.pure.{{mapToPureType tsType}}(/* {{name}} */),
{{/if}}
{{/each}}
  ],
});
\`\`\`

---

{{/each}}

{{#if (length publicFunctions)}}
### Public Functions

Public functions can be composed in PTBs but cannot be called directly.

{{#each publicFunctions}}
<a id="{{lowercase name}}-1"></a>
#### \`{{name}}\`

{{semantic.description}}

**Signature:**
\`\`\`move
public fun {{name}}{{#if (length typeParameters)}}<{{#each typeParameters}}{{name}}{{#unless @last}}, {{/unless}}{{/each}}>{{/if}}(
{{#each parameters}}
    {{name}}: {{formatMoveType moveType}},
{{/each}}
){{#if (length returns)}} : ({{#each returns}}{{formatMoveType moveType}}{{#unless @last}}, {{/unless}}{{/each}}){{/if}}
\`\`\`

{{#if (length (filterUserParams parameters))}}
**Parameters:**

| Name | Type | Description |
|------|------|-------------|
{{#each (filterUserParams parameters)}}
| \`{{name}}\` | \`{{tsType}}\` | {{description}} |
{{/each}}
{{/if}}

{{#if (length returns)}}
**Returns:**

| Type | Description |
|------|-------------|
{{#each returns}}
| \`{{tsType}}\` | {{description}} |
{{/each}}
{{/if}}

---

{{/each}}
{{/if}}

---

## Type Definitions

{{#each structs}}
<a id="{{lowercase name}}-type"></a>
### \`{{name}}\`

{{#if isEvent}}
📢 **Event Type**
{{/if}}

**Abilities:** {{#if (length abilities)}}\`{{join abilities ", "}}\`{{else}}None{{/if}}

{{#if (length typeParameters)}}
**Type Parameters:**
{{#each typeParameters}}
- \`{{name}}\`{{#if (length constraints)}}: {{join constraints ", "}}{{/if}}
{{/each}}
{{/if}}

{{#if (length fields)}}
**Fields:**

| Field | Type | Description |
|-------|------|-------------|
{{#each fields}}
| \`{{name}}\` | \`{{tsType}}\` | {{description}} |
{{/each}}
{{/if}}

**TypeScript Interface:**
\`\`\`typescript
interface {{snakeToPascal name}}{{#if (length typeParameters)}}<{{#each typeParameters}}{{name}}{{#unless @last}}, {{/unless}}{{/each}}>{{/if}} {
{{#each fields}}
  {{snakeToCamel name}}: {{tsType}};
{{/each}}
}
\`\`\`

---

{{/each}}

{{#if (length events)}}
## Events

Events emitted by this module:

{{#each events}}
### \`{{name}}\`

{{description}}

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
{{#each fields}}
| \`{{name}}\` | \`{{tsType}}\` | {{description}} |
{{/each}}

**Query Events:**
\`\`\`typescript
const events = await client.queryEvents({
  query: {
    MoveEventType: \`{{../packageId}}::{{../moduleName}}::{{name}}\`,
  },
});
\`\`\`

---

{{/each}}
{{/if}}

## Terminology

| Term | Definition |
|------|------------|
| Package ID | Unique identifier for the deployed Move package |
| Module | A single Move module within a package |
| Entry Function | A function that can be directly called in a transaction |
| Public Function | A function that can be composed in PTBs |
| PTB | Programmable Transaction Block - Sui's composable transaction format |
| Object ID | Unique identifier for an on-chain object |
{{#each structs}}
{{#unless isEvent}}
| {{name}} | {{#if (length fields)}}{{(first fields).description}}{{else}}A struct type in this module{{/if}} |
{{/unless}}
{{/each}}

---

## Examples

### Example 1: Basic Transaction

\`\`\`typescript
import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

async function basicExample() {
  // Setup
  const client = new SuiClient({ url: '{{rpcUrl}}' });
  const keypair = Ed25519Keypair.fromSecretKey(/* your key */);

  // Build transaction
  const tx = new Transaction();

{{#with (first entryFunctions)}}
  tx.moveCall({
    target: \`{{../packageId}}::{{../moduleName}}::{{name}}\`,
    arguments: [
      // Add your arguments here
    ],
  });
{{/with}}

  // Execute
  const result = await client.signAndExecuteTransaction({
    transaction: tx,
    signer: keypair,
    options: {
      showEffects: true,
      showEvents: true,
    },
  });

  console.log('Success:', result.effects?.status.status === 'success');
  console.log('Digest:', result.digest);
}
\`\`\`

### Example 2: Query Objects

\`\`\`typescript
async function queryExample() {
  const client = new SuiClient({ url: '{{rpcUrl}}' });

  // Get objects owned by an address
  const objects = await client.getOwnedObjects({
    owner: '0x...',
    filter: {
      StructType: \`{{packageId}}::{{moduleName}}::{{#with (first structs)}}{{name}}{{/with}}\`,
    },
    options: {
      showContent: true,
    },
  });

  console.log('Found objects:', objects.data.length);
}
\`\`\`

### Example 3: Subscribe to Events

\`\`\`typescript
{{#if (length events)}}
async function subscribeExample() {
  const client = new SuiClient({ url: '{{rpcUrl}}' });

  const unsubscribe = await client.subscribeEvent({
    filter: {
      MoveEventType: \`{{packageId}}::{{moduleName}}::{{#with (first events)}}{{name}}{{/with}}\`,
    },
    onMessage: (event) => {
      console.log('Event received:', event);
    },
  });

  // Later: unsubscribe();
}
{{else}}
// No events defined in this module
{{/if}}
\`\`\`

---

## FAQ

### General Questions

**Q: What network is this contract on?**
A: This contract is deployed on {{network}}. The RPC URL is \`{{rpcUrl}}\`.

**Q: How do I get the package ID?**
A: The package ID is \`{{packageId}}\`. Use this in your \`moveCall\` targets.

**Q: What SDK should I use?**
A: Use \`@mysten/sui\` (the official Sui TypeScript SDK).

### Technical Questions

**Q: How do I handle errors?**
A: Check \`result.effects?.status\` after execution. If \`status === 'failure'\`, the error message is in \`status.error\`.

**Q: How much gas do I need?**
A: Most operations require 1-10 million MIST. Complex operations may need up to 100 million. Use \`tx.setGasBudget()\` to set a specific budget.

**Q: Can I batch multiple operations?**
A: Yes! Use Sui's PTB (Programmable Transaction Block) to combine multiple operations in a single transaction.

### Troubleshooting

**Q: I get "ObjectNotFound" error**
A: The object ID you're using doesn't exist or has been deleted. Verify the ID and refresh your data.

**Q: I get "InsufficientGas" error**
A: Your account doesn't have enough SUI for gas. Get some SUI from a faucet (testnet) or buy SUI (mainnet).

**Q: I get "TypeArgumentError" error**
A: You're using incorrect type arguments. Make sure you're passing valid type strings like \`'0x2::sui::SUI'\`.

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| Current | {{generatedAt}} | Generated documentation |

{{#if sourceCode}}
---

## Appendix: Source Code

Disassembled Move bytecode:

\`\`\`move
{{{sourceCode}}}
\`\`\`
{{/if}}

---

*Generated by auto-sui-skills v{{generatorVersion}} | Scene: Documentation | {{generatedAt}}*
`;
