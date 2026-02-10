import { NextRequest, NextResponse } from 'next/server';
import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';

export const runtime = 'edge';

const NETWORK_URLS: Record<string, string> = {
  mainnet: 'https://fullnode.mainnet.sui.io',
  testnet: 'https://fullnode.testnet.sui.io',
  devnet: 'https://fullnode.devnet.sui.io',
};

type SkillScene = 'sdk' | 'learn' | 'audit' | 'frontend' | 'bot' | 'docs' | 'custom';

interface CustomSceneConfig {
  name: string;
  description: string;
  focusAreas: string[];
}

interface GenerateRequest {
  input: string;
  network: 'mainnet' | 'testnet' | 'devnet';
  scene?: SkillScene;
  customScene?: CustomSceneConfig;
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateRequest = await request.json();
    const { input, network, scene = 'sdk', customScene } = body;

    if (!input) {
      return NextResponse.json({ error: 'Input is required' }, { status: 400 });
    }

    // Parse input
    const parts = input.split('::');
    const packageId = parts[0];
    const moduleName = parts[1];

    if (!packageId.startsWith('0x')) {
      return NextResponse.json(
        { error: 'Invalid package ID format' },
        { status: 400 }
      );
    }

    // Create client
    const client = new SuiJsonRpcClient({ url: NETWORK_URLS[network], network });

    // Fetch module ABI
    let moduleData;
    let actualModuleName = moduleName;
    if (moduleName) {
      moduleData = await client.getNormalizedMoveModule({
        package: packageId,
        module: moduleName,
      });
    } else {
      // Get package to find modules
      const packageObj = await client.getObject({
        id: packageId,
        options: { showContent: true },
      });

      if (!packageObj.data || !packageObj.data.content) {
        return NextResponse.json(
          { error: 'Package not found' },
          { status: 404 }
        );
      }

      const content = packageObj.data.content;
      if (content.dataType !== 'package' || !content.disassembled) {
        return NextResponse.json(
          { error: 'Invalid package' },
          { status: 400 }
        );
      }

      const modules = Object.keys(content.disassembled);
      if (modules.length === 0) {
        return NextResponse.json(
          { error: 'No modules found in package' },
          { status: 404 }
        );
      }

      // Use first module
      actualModuleName = modules[0];
      moduleData = await client.getNormalizedMoveModule({
        package: packageId,
        module: actualModuleName,
      });
    }

    // Generate skill content based on scene
    const sceneName = scene === 'custom' && customScene?.name ? customScene.name.toLowerCase().replace(/\s+/g, '-') : scene;
    const packageName = `${formatPackageName(actualModuleName || 'module')}-${sceneName}`;
    const skillMd = generateSceneSkillMd(
      moduleData as unknown as Record<string, unknown>,
      packageId,
      network,
      scene,
      customScene
    );

    return NextResponse.json({
      skillMd,
      packageName,
      metadata: {
        packageId,
        modules: [actualModuleName || 'module'],
        network,
        scene,
      },
    });
  } catch (error) {
    console.error('Generate error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 }
    );
  }
}

function formatPackageName(name: string): string {
  return name.replace(/_/g, '-').toLowerCase();
}

function toTitleCase(str: string): string {
  return str
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function generateSceneSkillMd(
  module: Record<string, unknown>,
  packageId: string,
  network: string,
  scene: SkillScene,
  customScene?: CustomSceneConfig
): string {
  const moduleData = module as {
    name: string;
    exposedFunctions: Record<string, {
      isEntry: boolean;
      visibility: string;
      parameters: unknown[];
      return: unknown[];
    }>;
    structs: Record<string, {
      abilities: { abilities: string[] };
      fields: { name: string; type_: unknown }[];
    }>;
  };

  const moduleName = moduleData.name;
  const functions = moduleData.exposedFunctions;
  const structs = moduleData.structs;

  const entryFunctions = Object.entries(functions).filter(([_, f]) => f.isEntry);
  const publicFunctions = Object.entries(functions).filter(
    ([_, f]) => !f.isEntry && f.visibility === 'Public'
  );

  // Scene-specific generators
  switch (scene) {
    case 'sdk':
      return generateSdkSkillMd(moduleName, packageId, network, entryFunctions, publicFunctions, structs);
    case 'learn':
      return generateLearnSkillMd(moduleName, packageId, network, entryFunctions, publicFunctions, structs);
    case 'audit':
      return generateAuditSkillMd(moduleName, packageId, network, entryFunctions, publicFunctions, structs);
    case 'frontend':
      return generateFrontendSkillMd(moduleName, packageId, network, entryFunctions, publicFunctions, structs);
    case 'bot':
      return generateBotSkillMd(moduleName, packageId, network, entryFunctions, publicFunctions, structs);
    case 'docs':
      return generateDocsSkillMd(moduleName, packageId, network, entryFunctions, publicFunctions, structs);
    case 'custom':
      return generateCustomSkillMd(moduleName, packageId, network, entryFunctions, publicFunctions, structs, customScene);
    default:
      return generateSdkSkillMd(moduleName, packageId, network, entryFunctions, publicFunctions, structs);
  }
}

type FunctionEntry = [string, { isEntry: boolean; visibility: string; parameters: unknown[]; return: unknown[] }];
type StructsMap = Record<string, { abilities: { abilities: string[] }; fields: { name: string; type_: unknown }[] }>;

function generateSdkSkillMd(
  moduleName: string,
  packageId: string,
  network: string,
  entryFunctions: FunctionEntry[],
  publicFunctions: FunctionEntry[],
  structs: StructsMap
): string {
  let md = `---
name: ${formatPackageName(moduleName)}
description: "${toTitleCase(moduleName)} SDK Integration Guide"
scene: sdk
---

# ${toTitleCase(moduleName)} - SDK Integration Guide

## Quick Start

\`\`\`typescript
import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';

const client = new SuiClient({ url: 'https://fullnode.${network}.sui.io' });
const tx = new Transaction();
${entryFunctions.length > 0 ? `
// Example: ${entryFunctions[0][0]}
tx.moveCall({
  target: \`${packageId}::${moduleName}::${entryFunctions[0][0]}\`,
  arguments: [/* add arguments */],
});
` : ''}
\`\`\`

## Contract Info

| Property | Value |
|----------|-------|
| Package ID | \`${packageId}\` |
| Module | \`${moduleName}\` |
| Network | ${network} |

## Function Reference

### Entry Functions

`;

  for (const [name, func] of entryFunctions) {
    md += `#### \`${name}\`

**Parameters:** ${func.parameters.length}
**Returns:** ${func.return.length}

\`\`\`typescript
tx.moveCall({
  target: \`${packageId}::${moduleName}::${name}\`,
  arguments: [/* ${func.parameters.length} argument(s) */],
});
\`\`\`

---

`;
  }

  if (publicFunctions.length > 0) {
    md += `### Public Functions (Composable)

`;
    for (const [name, func] of publicFunctions) {
      md += `#### \`${name}\`

**Parameters:** ${func.parameters.length}
**Returns:** ${func.return.length}

---

`;
    }
  }

  md += `## Types

${Object.keys(structs).length} struct(s) defined:
${Object.keys(structs).map(s => `- \`${s}\``).join('\n')}

---

*Generated by MoveWhisperer | Scene: SDK Integration*
`;

  return md;
}

function generateLearnSkillMd(
  moduleName: string,
  packageId: string,
  network: string,
  entryFunctions: FunctionEntry[],
  publicFunctions: FunctionEntry[],
  structs: StructsMap
): string {
  return `---
name: ${formatPackageName(moduleName)}
description: "${toTitleCase(moduleName)} Protocol Learning"
scene: learn
---

# ${toTitleCase(moduleName)} - Protocol Deep Dive

## Overview

This module contains ${entryFunctions.length} entry functions and ${publicFunctions.length} public functions.

| Property | Value |
|----------|-------|
| Package ID | \`${packageId}\` |
| Module | \`${moduleName}\` |
| Network | ${network} |

## Core Concepts

### Data Structures

${Object.entries(structs).map(([name, struct]) => `
#### ${name}

**Abilities:** ${struct.abilities?.abilities?.join(', ') || 'none'}

**Fields:**
${struct.fields?.map(f => `- \`${f.name}\``).join('\n') || '(no fields)'}
`).join('\n')}

## State Transitions

The following operations modify on-chain state:

${entryFunctions.map(([name, func]) => `
### ${name}
- Parameters: ${func.parameters.length}
- Returns: ${func.return.length}
`).join('\n')}

## Design Patterns

This module demonstrates common Move patterns:
- Object ownership model
- Capability-based access control
- Event emission for tracking

---

*Generated by MoveWhisperer | Scene: Protocol Learning*
`;
}

function generateAuditSkillMd(
  moduleName: string,
  packageId: string,
  network: string,
  entryFunctions: FunctionEntry[],
  publicFunctions: FunctionEntry[],
  structs: StructsMap
): string {
  return `---
name: ${formatPackageName(moduleName)}
description: "${toTitleCase(moduleName)} Security Analysis"
scene: audit
---

# ${toTitleCase(moduleName)} - Security Analysis

## Executive Summary

| Metric | Value |
|--------|-------|
| Package ID | \`${packageId}\` |
| Module | \`${moduleName}\` |
| Network | ${network} |
| Total Functions | ${entryFunctions.length + publicFunctions.length} |
| Entry Functions | ${entryFunctions.length} |

## Permission Model

### Entry Functions

| Function | Parameters | Visibility |
|----------|------------|------------|
${entryFunctions.map(([name, func]) => `| \`${name}\` | ${func.parameters.length} | Entry |`).join('\n')}

### Public Functions

| Function | Parameters | Visibility |
|----------|------------|------------|
${publicFunctions.map(([name, func]) => `| \`${name}\` | ${func.parameters.length} | Public |`).join('\n')}

## Data Structures

${Object.entries(structs).map(([name, struct]) => `
### ${name}
- **Abilities:** ${struct.abilities?.abilities?.join(', ') || 'none'}
- **Field Count:** ${struct.fields?.length || 0}
`).join('\n')}

## Vulnerability Checklist

| Check | Status |
|-------|--------|
| Integer Overflow | Review Required |
| Access Control | Review Required |
| Reentrancy | Sui Prevents |
| Object Ownership | Review Required |

## Recommendations

1. Review all entry functions for proper access control
2. Verify object ownership patterns
3. Check for proper event emission

---

*Generated by MoveWhisperer | Scene: Security Audit*

**Disclaimer:** This is an automated analysis. Manual review by security professionals is recommended.
`;
}

function generateFrontendSkillMd(
  moduleName: string,
  packageId: string,
  network: string,
  entryFunctions: FunctionEntry[],
  publicFunctions: FunctionEntry[],
  structs: StructsMap
): string {
  return `---
name: ${formatPackageName(moduleName)}
description: "${toTitleCase(moduleName)} Frontend Integration"
scene: frontend
---

# ${toTitleCase(moduleName)} - Frontend Integration Guide

## Contract Info

| Property | Value |
|----------|-------|
| Package ID | \`${packageId}\` |
| Module | \`${moduleName}\` |
| Network | ${network} |

## User Operations

${entryFunctions.map(([name, func]) => `
### ${toTitleCase(name.replace(/_/g, ' '))}

**Parameters Required:** ${func.parameters.length}

\`\`\`typescript
const tx = new Transaction();
tx.moveCall({
  target: \`${packageId}::${moduleName}::${name}\`,
  arguments: [/* user inputs */],
});
\`\`\`
`).join('\n')}

## Data Fetching

\`\`\`typescript
// Query user's objects
const objects = await client.getOwnedObjects({
  owner: userAddress,
  filter: { StructType: \`${packageId}::${moduleName}::TypeName\` },
  options: { showContent: true },
});
\`\`\`

## UI Components Needed

${Object.keys(structs).map(s => `- ${toTitleCase(s.replace(/_/g, ' '))} display component`).join('\n')}

## Error Handling

\`\`\`typescript
try {
  const result = await client.signAndExecuteTransaction({ ... });
  // Handle success
} catch (error) {
  // Show user-friendly error message
}
\`\`\`

---

*Generated by MoveWhisperer | Scene: Frontend Development*
`;
}

function generateBotSkillMd(
  moduleName: string,
  packageId: string,
  network: string,
  entryFunctions: FunctionEntry[],
  publicFunctions: FunctionEntry[],
  structs: StructsMap
): string {
  return `---
name: ${formatPackageName(moduleName)}
description: "${toTitleCase(moduleName)} Trading Bot Guide"
scene: bot
---

# ${toTitleCase(moduleName)} - Trading Bot Guide

## Contract Info

| Property | Value |
|----------|-------|
| Package ID | \`${packageId}\` |
| Module | \`${moduleName}\` |
| Network | ${network} |

## Entry Functions for Automation

| Function | Parameters | Est. Gas |
|----------|------------|----------|
${entryFunctions.map(([name, func]) => `| \`${name}\` | ${func.parameters.length} | ~10M MIST |`).join('\n')}

## Bot Integration

${entryFunctions.slice(0, 3).map(([name, func]) => `
### ${name}

\`\`\`typescript
async function ${name}Bot(client: SuiClient, signer: Keypair) {
  const tx = new Transaction();
  tx.moveCall({
    target: \`${packageId}::${moduleName}::${name}\`,
    arguments: [/* ${func.parameters.length} args */],
  });
  tx.setGasBudget(10_000_000);

  return client.signAndExecuteTransaction({
    transaction: tx,
    signer,
    options: { showEffects: true },
  });
}
\`\`\`
`).join('\n')}

## Gas Optimization

- Batch multiple operations in single PTB
- Pre-calculate gas requirements
- Monitor gas prices during execution

## Monitoring

\`\`\`typescript
// Poll for state changes
async function monitor(client: SuiClient, objectId: string) {
  const obj = await client.getObject({
    id: objectId,
    options: { showContent: true },
  });
  return obj.data?.content?.fields;
}
\`\`\`

---

*Generated by MoveWhisperer | Scene: Trading Bot*
`;
}

function generateDocsSkillMd(
  moduleName: string,
  packageId: string,
  network: string,
  entryFunctions: FunctionEntry[],
  publicFunctions: FunctionEntry[],
  structs: StructsMap
): string {
  return `---
name: ${formatPackageName(moduleName)}
description: "${toTitleCase(moduleName)} Documentation"
scene: docs
---

# ${toTitleCase(moduleName)} Documentation

## Overview

| Property | Value |
|----------|-------|
| Package ID | \`${packageId}\` |
| Module | \`${moduleName}\` |
| Network | ${network} |

## API Reference

### Entry Functions

${entryFunctions.map(([name, func]) => `
#### \`${name}\`

**Signature:**
\`\`\`move
public entry fun ${name}(/* ${func.parameters.length} params */)
\`\`\`

**Parameters:** ${func.parameters.length}
**Returns:** ${func.return.length}

---
`).join('\n')}

### Public Functions

${publicFunctions.map(([name, func]) => `
#### \`${name}\`

**Signature:**
\`\`\`move
public fun ${name}(/* ${func.parameters.length} params */)
\`\`\`

**Parameters:** ${func.parameters.length}
**Returns:** ${func.return.length}

---
`).join('\n')}

## Type Definitions

${Object.entries(structs).map(([name, struct]) => `
### \`${name}\`

**Abilities:** ${struct.abilities?.abilities?.join(', ') || 'none'}

| Field | Type |
|-------|------|
${struct.fields?.map(f => `| \`${f.name}\` | - |`).join('\n') || '| (no fields) | - |'}
`).join('\n')}

## Terminology

| Term | Definition |
|------|------------|
| Package ID | Unique identifier for the deployed Move package |
| Module | A single Move module within a package |
| Entry Function | A function that can be directly called in a transaction |

## FAQ

**Q: How do I call these functions?**
A: Use the Sui TypeScript SDK with \`@mysten/sui\`.

**Q: What network is this on?**
A: This is deployed on ${network}.

---

*Generated by MoveWhisperer | Scene: Documentation*
`;
}

function generateCustomSkillMd(
  moduleName: string,
  packageId: string,
  network: string,
  entryFunctions: FunctionEntry[],
  publicFunctions: FunctionEntry[],
  structs: StructsMap,
  customScene?: CustomSceneConfig
): string {
  const sceneName = customScene?.name || 'Custom Analysis';
  const sceneDescription = customScene?.description || 'Custom scene documentation';
  const focusAreas = customScene?.focusAreas || [];

  return `---
name: ${formatPackageName(moduleName)}
description: "${toTitleCase(moduleName)} - ${sceneName}"
scene: custom
custom_scene_name: "${sceneName}"
---

# ${toTitleCase(moduleName)} - ${sceneName}

${sceneDescription ? `> ${sceneDescription}` : ''}

## Contract Overview

| Property | Value |
|----------|-------|
| Package ID | \`${packageId}\` |
| Module | \`${moduleName}\` |
| Network | ${network} |
| Total Functions | ${entryFunctions.length + publicFunctions.length} |
| Entry Functions | ${entryFunctions.length} |

${focusAreas.length > 0 ? `## Focus Areas

${focusAreas.map(area => `- ${area}`).join('\n')}
` : ''}

## Module Structure

### Entry Functions (${entryFunctions.length})

${entryFunctions.map(([name, func]) => `
#### \`${name}\`

**Parameters:** ${func.parameters.length}
**Returns:** ${func.return.length}

\`\`\`typescript
tx.moveCall({
  target: \`${packageId}::${moduleName}::${name}\`,
  arguments: [/* ${func.parameters.length} argument(s) */],
});
\`\`\`

---
`).join('\n')}

${publicFunctions.length > 0 ? `### Public Functions (${publicFunctions.length})

${publicFunctions.map(([name, func]) => `
#### \`${name}\`

**Parameters:** ${func.parameters.length}
**Returns:** ${func.return.length}

---
`).join('\n')}
` : ''}

## Type Definitions

${Object.entries(structs).map(([name, struct]) => `
### ${name}

**Abilities:** ${struct.abilities?.abilities?.join(', ') || 'none'}

| Field | Type |
|-------|------|
${struct.fields?.map(f => `| \`${f.name}\` | - |`).join('\n') || '| (no fields) | - |'}
`).join('\n')}

## Quick Start

\`\`\`typescript
import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';

const client = new SuiClient({ url: 'https://fullnode.${network}.sui.io' });
const tx = new Transaction();

${entryFunctions.length > 0 ? `// Example: ${entryFunctions[0][0]}
tx.moveCall({
  target: \`${packageId}::${moduleName}::${entryFunctions[0][0]}\`,
  arguments: [/* add arguments */],
});` : '// Add your transaction calls here'}

const result = await client.signAndExecuteTransaction({
  transaction: tx,
  signer: keypair,
});
\`\`\`

## Security Notes

- Always verify transaction parameters before signing
- Test transactions on testnet before using on mainnet
- Review all entry functions for proper access control

---

*Generated by MoveWhisperer | Custom Scene: ${sceneName}*
`;
}
