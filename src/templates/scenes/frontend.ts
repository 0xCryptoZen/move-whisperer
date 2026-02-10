/**
 * Frontend Development Scene Template
 * Focus: User flows, data queries, event listening, UX recommendations
 */

export const FRONTEND_SCENE_TEMPLATE = `---
name: {{packageName}}
description: "{{description}}"
scene: frontend
---

# {{snakeToTitle moduleName}} - Frontend Integration Guide

## User Journey Overview

\`\`\`mermaid
flowchart LR
    A[Connect Wallet] --> B{Has Objects?}
    B -->|Yes| C[View State]
    B -->|No| D[Create/Acquire]
    C --> E[Perform Actions]
    D --> E
    E --> F[View Results]
    F --> C
\`\`\`

## Contract Info

| Property | Value |
|----------|-------|
| Package ID | \`{{packageId}}\` |
| Module | \`{{moduleName}}\` |
| Network | {{network}} |

## User States & Actions

| User State | Data to Show | Available Actions |
|------------|--------------|-------------------|
| Not Connected | - | Connect Wallet |
{{#each structs}}
{{#unless isEvent}}
| Has {{name}} | {{name}} details | {{#each ../entryFunctions}}{{#if (usesType (filterUserParams parameters) ../name)}}{{name}}, {{/if}}{{/each}} |
{{/unless}}
{{/each}}
| No Objects | Empty state | {{#each entryFunctions}}{{#if (isCreateFunction semantic.category)}}{{name}}, {{/if}}{{/each}} |

## Data Fetching

### Get User's Objects

\`\`\`typescript
import { SuiClient } from '@mysten/sui/client';

const client = new SuiClient({ url: '{{rpcUrl}}' });

// Fetch all objects of a specific type
async function getUserObjects(address: string) {
  const objects = await client.getOwnedObjects({
    owner: address,
    filter: {
      StructType: \`{{packageId}}::{{moduleName}}::YourType\`,
    },
    options: {
      showContent: true,
      showType: true,
    },
  });

  return objects.data.map(obj => ({
    id: obj.data?.objectId,
    ...obj.data?.content?.fields,
  }));
}
\`\`\`

### Query Object Details

\`\`\`typescript
async function getObjectDetails(objectId: string) {
  const object = await client.getObject({
    id: objectId,
    options: {
      showContent: true,
      showOwner: true,
    },
  });

  return object.data?.content?.fields;
}
\`\`\`

### Fetch Dynamic Fields

\`\`\`typescript
async function getDynamicFields(parentId: string) {
  const fields = await client.getDynamicFields({
    parentId,
  });

  // Fetch each field's content
  const contents = await Promise.all(
    fields.data.map(async (field) => {
      const obj = await client.getObject({
        id: field.objectId,
        options: { showContent: true },
      });
      return {
        name: field.name,
        value: obj.data?.content?.fields,
      };
    })
  );

  return contents;
}
\`\`\`

## User Operations

{{#each entryFunctions}}
### {{snakeToTitle name}}

{{semantic.description}}

{{#if (isHighRisk semantic.risk)}}
> ⚠️ **{{riskBadge semantic.risk}}** - Show confirmation dialog before executing
{{/if}}

**Required Inputs:**
{{#each (filterUserParams parameters)}}
- {{snakeToTitle name}}: \`{{tsType}}\` {{#if isOptional}}(optional){{/if}}
{{/each}}

**UI Components Needed:**
{{#each (filterUserParams parameters)}}
{{#if objectIdRequired}}
- Object selector for {{name}}
{{else if (eq tsType "boolean")}}
- Toggle/checkbox for {{name}}
{{else if (eq tsType "number")}}
- Number input for {{name}}
{{else if (eq tsType "bigint | string")}}
- Amount input with decimals for {{name}}
{{else}}
- Text input for {{name}}
{{/if}}
{{/each}}

**Implementation:**
\`\`\`typescript
import { Transaction } from '@mysten/sui/transactions';

async function {{snakeToCamel name}}(
{{#each (filterUserParams parameters)}}
  {{snakeToCamel name}}: {{tsType}},
{{/each}}
) {
  const tx = new Transaction();

  tx.moveCall({
    target: \`{{../packageId}}::{{../moduleName}}::{{name}}\`,
{{#if (length typeParameters)}}
    typeArguments: [/* coin types */],
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

  return tx;
}
\`\`\`

---

{{/each}}

## Event Listening

{{#if (length events)}}
### Available Events

{{#each events}}
#### {{name}}

{{description}}

**When Emitted:** After successful {{snakeToCamel name}} operation

**Fields:**
| Field | Type | UI Update |
|-------|------|-----------|
{{#each fields}}
| \`{{name}}\` | \`{{tsType}}\` | {{description}} |
{{/each}}

---

{{/each}}

### Subscribe to Events

\`\`\`typescript
// Real-time event subscription
const unsubscribe = await client.subscribeEvent({
  filter: {
    MoveEventType: \`{{packageId}}::{{moduleName}}::EventName\`,
  },
  onMessage: (event) => {
    console.log('Event received:', event);
    // Update UI state
    updateState(event.parsedJson);
  },
});

// Don't forget to unsubscribe
// unsubscribe();
\`\`\`

### Query Historical Events

\`\`\`typescript
async function getRecentEvents(limit = 50) {
  const events = await client.queryEvents({
    query: {
      MoveEventType: \`{{packageId}}::{{moduleName}}::EventName\`,
    },
    limit,
    order: 'descending',
  });

  return events.data;
}
\`\`\`
{{else}}
No events defined in this module. Consider polling for state changes.
{{/if}}

## UI State Management

\`\`\`typescript
// Example with React + Zustand
import { create } from 'zustand';

interface {{snakeToPascal moduleName}}State {
  objects: any[];
  isLoading: boolean;
  error: string | null;
  fetchObjects: (address: string) => Promise<void>;
}

const use{{snakeToPascal moduleName}}Store = create<{{snakeToPascal moduleName}}State>((set) => ({
  objects: [],
  isLoading: false,
  error: null,

  fetchObjects: async (address) => {
    set({ isLoading: true, error: null });
    try {
      const objects = await getUserObjects(address);
      set({ objects, isLoading: false });
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },
}));
\`\`\`

## UX Best Practices

### Transaction Flow

1. **Before Transaction**
   - Show loading state
   - Disable submit button
   - Display estimated gas

2. **During Transaction**
   - Show "Waiting for confirmation" with spinner
   - Optionally show transaction digest

3. **After Success**
   - Show success toast/notification
   - Update UI with new state
   - Provide transaction link to explorer

4. **On Error**
   - Parse error message for user-friendly text
   - Show retry option
   - Preserve user inputs

### Common Error Messages

| Error Code | User Message | Action |
|------------|--------------|--------|
| InsufficientGas | "Not enough SUI for gas" | Prompt to add SUI |
| ObjectNotFound | "Object no longer exists" | Refresh data |
| InvalidInput | "Please check your inputs" | Highlight invalid fields |

### Loading States

\`\`\`typescript
// Skeleton loading for object list
function ObjectListSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-20 bg-gray-200 animate-pulse rounded" />
      ))}
    </div>
  );
}
\`\`\`

## Transaction Building Helpers

\`\`\`typescript
// Helper to split coins
function splitCoin(
  tx: Transaction,
  coinObjectId: string,
  amounts: bigint[]
): TransactionArgument[] {
  const coin = tx.object(coinObjectId);
  return tx.splitCoins(coin, amounts.map(a => tx.pure.u64(a)));
}

// Helper to merge coins
function mergeCoins(
  tx: Transaction,
  destination: string,
  sources: string[]
): void {
  tx.mergeCoins(
    tx.object(destination),
    sources.map(s => tx.object(s))
  );
}
\`\`\`

## Useful Links

- [Sui dApp Kit](https://sdk.mystenlabs.com/dapp-kit) - React hooks for Sui
- [Type Definitions](references/types.md) - All struct types
{{#if (length events)}}
- [Events Reference](references/events.md) - Event details
{{/if}}

---

*Generated by MoveWhisperer v{{generatorVersion}} | Scene: Frontend Development | {{generatedAt}}*
`;
