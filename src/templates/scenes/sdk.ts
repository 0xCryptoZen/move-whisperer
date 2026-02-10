/**
 * SDK Integration Scene Template
 * Focus: Function signatures, code examples, PTB patterns, error handling
 */

export const SDK_SCENE_TEMPLATE = `---
name: {{packageName}}
description: "{{description}}"
scene: sdk
---

# {{snakeToTitle moduleName}} - SDK Integration Guide

## Quick Start

30 seconds to your first transaction:

\`\`\`typescript
import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';

const client = new SuiClient({ url: '{{rpcUrl}}' });
const tx = new Transaction();

{{#if primaryFunction}}
// Call {{primaryFunction.name}}
tx.moveCall({
  target: \`{{packageId}}::{{moduleName}}::{{primaryFunction.name}}\`,
  arguments: [
{{#each primaryFunction.exampleArgs}}
    {{{this}}},
{{/each}}
  ],
});

// Sign and execute
const result = await client.signAndExecuteTransaction({
  transaction: tx,
  signer: keypair,
});
{{/if}}
\`\`\`

## Contract Info

| Property | Value |
|----------|-------|
| Package ID | \`{{packageId}}\` |
| Module | \`{{moduleName}}\` |
| Network | {{network}} |
| Category | {{category}} |

## Function Reference

### Entry Functions (Direct Call)

{{#each entryFunctions}}
#### \`{{name}}\`

{{semantic.description}}

{{#if (isHighRisk semantic.risk)}}
> ⚠️ **{{riskBadge semantic.risk}}** - {{#each semantic.warnings}}{{this}} {{/each}}
{{/if}}

{{#if (length (filterUserParams parameters))}}
**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
{{#each (filterUserParams parameters)}}
| \`{{name}}\` | \`{{tsType}}\` | {{#if isOptional}}Optional{{else}}Yes{{/if}} | {{description}} |
{{/each}}
{{/if}}

{{#if (length typeParameters)}}
**Type Arguments:**
{{#each typeParameters}}
- \`{{name}}\`{{#if (length constraints)}} ({{join constraints ", "}}){{/if}}
{{/each}}
{{/if}}

{{#if (length returns)}}
**Returns:**
{{#each returns}}
- \`{{tsType}}\` - {{description}}
{{/each}}
{{/if}}

**Example:**
\`\`\`typescript
tx.moveCall({
  target: \`{{../packageId}}::{{../moduleName}}::{{name}}\`,
{{#if (length typeParameters)}}
  typeArguments: [{{#each typeParameters}}'0x2::sui::SUI'{{#unless @last}}, {{/unless}}{{/each}}],
{{/if}}
  arguments: [
{{#each (filterUserParams parameters)}}
{{#if isSystemObject}}
    tx.object('{{defaultValue}}'),
{{else if objectIdRequired}}
    tx.object({{snakeToCamel name}}Id),
{{else}}
    tx.pure.{{mapToPureType tsType}}({{snakeToCamel name}}),
{{/if}}
{{/each}}
  ],
});
\`\`\`

---

{{/each}}

{{#if (length publicFunctions)}}
### Public Functions (Composable)

These functions can be used in PTB compositions:

{{#each publicFunctions}}
#### \`{{name}}\`

{{semantic.description}}

{{#if (length (filterUserParams parameters))}}
| Parameter | Type | Description |
|-----------|------|-------------|
{{#each (filterUserParams parameters)}}
| \`{{name}}\` | \`{{tsType}}\` | {{description}} |
{{/each}}
{{/if}}

{{#if (length returns)}}
**Returns:** {{#each returns}}\`{{tsType}}\`{{#unless @last}}, {{/unless}}{{/each}}
{{/if}}

---

{{/each}}
{{/if}}

## PTB Patterns

### Single Operation
\`\`\`typescript
const tx = new Transaction();
{{#with (first entryFunctions)}}
tx.moveCall({
  target: \`{{../packageId}}::{{../moduleName}}::{{name}}\`,
  arguments: [/* ... */],
});
{{/with}}
const result = await client.signAndExecuteTransaction({ transaction: tx, signer });
\`\`\`

### Chained Operations
\`\`\`typescript
const tx = new Transaction();

// Step 1: Get or create resource
const [resource] = tx.moveCall({
  target: \`{{packageId}}::{{moduleName}}::create_or_get\`,
  arguments: [/* ... */],
});

// Step 2: Use the resource
tx.moveCall({
  target: \`{{packageId}}::{{moduleName}}::use_resource\`,
  arguments: [resource, /* ... */],
});

await client.signAndExecuteTransaction({ transaction: tx, signer });
\`\`\`

## Object Acquisition

{{#if (length dependencies)}}
Common objects needed for this module:

{{#each dependencies}}
### {{moduleName}}
{{#each implications}}
- {{this}}
{{/each}}
{{/each}}
{{/if}}

\`\`\`typescript
// Query owned objects
const objects = await client.getOwnedObjects({
  owner: address,
  filter: { StructType: \`{{packageId}}::{{moduleName}}::YourType\` },
});

// Query dynamic fields
const fields = await client.getDynamicFields({
  parentId: objectId,
});
\`\`\`

## Error Handling

\`\`\`typescript
try {
  const result = await client.signAndExecuteTransaction({
    transaction: tx,
    signer,
    options: { showEffects: true },
  });

  if (result.effects?.status.status === 'failure') {
    console.error('Transaction failed:', result.effects.status.error);
  }
} catch (error) {
  if (error.message.includes('InsufficientGas')) {
    // Handle gas issues
  } else if (error.message.includes('ObjectNotFound')) {
    // Handle missing objects
  }
  throw error;
}
\`\`\`

## Security Notes

{{#each securityNotes}}
- {{this}}
{{/each}}

## Related Resources

- [Type Definitions](references/types.md)
{{#if (length events)}}
- [Events Reference](references/events.md)
{{/if}}

{{#if sourceCode}}
## Source Code Reference

<details>
<summary>View Disassembled Move Source</summary>

\`\`\`move
{{{sourceCode}}}
\`\`\`

</details>
{{/if}}

---

*Generated by MoveWhisperer v{{generatorVersion}} | Scene: SDK Integration | {{generatedAt}}*
`;
