---
name: sui-skill-generator
description: "Generate professional SKILL.md files for any Sui Move contract"
---

# Sui Skill Generator

## Overview

This is a meta-skill that enables you to analyze Sui blockchain contracts and generate specialized SKILL.md files. When a user asks to understand, document, or integrate a Sui contract, use this skill to fetch the contract data and generate appropriate documentation.

## When to Use

Trigger this skill when the user says:
- "Help me analyze this contract 0x..."
- "Generate a skill for Cetus/DeepBook/[protocol name]"
- "I want to understand how [protocol] works"
- "Create documentation for 0x..."
- "How do I integrate with 0x..."

## Available Scenes

Generate different documentation based on user needs:

| Scene | Use When | Focus Areas |
|-------|----------|-------------|
| `sdk` | User wants to integrate/call the contract | Function signatures, code examples, PTB patterns |
| `learn` | User wants to understand the protocol | Architecture, concepts, state transitions |
| `audit` | User is reviewing security | Permission model, risks, vulnerability checklist |
| `frontend` | User is building a UI | User flows, data queries, event handling |
| `bot` | User is building automation | Entry functions, gas optimization, monitoring |
| `docs` | User wants comprehensive docs | API reference, terminology, FAQ |

## Workflow

### Step 1: Fetch Contract Data

Use Sui RPC to get the normalized module:

```bash
curl -X POST https://fullnode.mainnet.sui.io:443 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "sui_getNormalizedMoveModule",
    "params": ["PACKAGE_ID", "MODULE_NAME"]
  }'
```

Or to list all modules in a package:

```bash
curl -X POST https://fullnode.mainnet.sui.io:443 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "sui_getNormalizedMoveModulesByPackage",
    "params": ["PACKAGE_ID"]
  }'
```

### Step 2: Parse Response

Extract from the response:
- `exposedFunctions`: Map of function names to their definitions
  - `isEntry`: Whether it can be called directly
  - `visibility`: "Public", "Private", or "Friend"
  - `parameters`: Array of parameter types
  - `return`: Array of return types
  - `typeParameters`: Generic type constraints
- `structs`: Map of struct definitions
  - `abilities`: ["copy", "drop", "store", "key"]
  - `fields`: Array of field definitions
  - `typeParameters`: Generic parameters

### Step 3: Generate Based on Scene

#### SDK Scene Template

```markdown
# {Module Name} - SDK Integration Guide

## Quick Start
[30-second example to call the contract]

## Contract Info
[Package ID, Module, Network table]

## Function Reference
### Entry Functions
[For each entry function: name, parameters, returns, code example]

### Public Functions (Composable)
[For each public function: signature, usage]

## PTB Patterns
[How to combine operations]

## Error Handling
[Common errors and solutions]
```

#### Learn Scene Template

```markdown
# {Module Name} - Protocol Deep Dive

## Overview
[One-liner explanation]

## Architecture
[Mermaid diagram of components]

## Core Concepts
[For each struct: purpose, abilities, fields]

## State Transitions
[How operations change state]

## Design Patterns
[Patterns used in the code]
```

#### Audit Scene Template

```markdown
# {Module Name} - Security Analysis

## Executive Summary
[Key metrics table]

## Permission Model
[Who can call what]

## Asset Flow
[How tokens move in/out]

## Risk Classification
[High/Medium/Low risk functions]

## Vulnerability Checklist
[Common checks and status]
```

#### Frontend Scene Template

```markdown
# {Module Name} - Frontend Integration

## User Operations
[Actions users can take]

## Data Fetching
[How to query state]

## Event Listening
[Events to subscribe to]

## UX Best Practices
[Loading states, errors, confirmations]
```

#### Bot Scene Template

```markdown
# {Module Name} - Trading Bot Guide

## Entry Functions for Automation
[Functions suitable for bots]

## Gas Optimization
[Tips to reduce costs]

## Batch Operations
[PTB patterns for efficiency]

## Monitoring
[State polling and events]
```

#### Docs Scene Template

```markdown
# {Module Name} Documentation

## API Reference
[All functions with signatures]

## Type Definitions
[All structs with fields]

## Terminology
[Glossary of terms]

## FAQ
[Common questions]
```

## Type Mapping

Map Sui Move types to TypeScript:

| Move Type | TypeScript |
|-----------|------------|
| `bool` | `boolean` |
| `u8`, `u16`, `u32` | `number` |
| `u64`, `u128`, `u256` | `bigint \| string` |
| `address` | `string` |
| `vector<T>` | `T[]` |
| `0x1::string::String` | `string` |
| `0x2::object::ID` | `string` |
| `0x2::coin::Coin<T>` | `string` (object ID) |
| `&T` / `&mut T` | `string` (object ID) |

## Risk Assessment

Classify function risk by:

| Indicator | Risk Level |
|-----------|------------|
| Name contains "admin", "owner", "emergency" | High |
| Handles Coin types | Medium-High |
| Has &mut parameters | Medium |
| View-only (no state changes) | Low |

## Example Generation

For a package `0xdee9::clob_v2`:

1. User asks: "Help me integrate DeepBook"
2. Determine scene: SDK (integration = SDK scene)
3. Fetch: `sui_getNormalizedMoveModule("0xdee9", "clob_v2")`
4. Parse functions and structs
5. Generate SDK-focused SKILL.md with:
   - Quick start code example
   - Function reference table
   - Order placement patterns
   - Error handling

## Networks

| Network | RPC URL |
|---------|---------|
| Mainnet | https://fullnode.mainnet.sui.io |
| Testnet | https://fullnode.testnet.sui.io |
| Devnet | https://fullnode.devnet.sui.io |

## Tips

1. **Infer Purpose**: Use function names to guess what they do
   - `swap_*`, `exchange_*` → DEX operations
   - `mint_*`, `create_*` → Creation operations
   - `burn_*`, `destroy_*` → Destruction operations
   - `transfer_*`, `send_*` → Transfer operations

2. **Identify Key Objects**: Look for structs with `key` ability - these are on-chain objects

3. **Find Entry Points**: Entry functions are the main user-facing operations

4. **Track Dependencies**: Note which external packages are used (0x1, 0x2, etc.)

## Output Format

Always output as a complete SKILL.md file with:
- YAML frontmatter (name, description)
- Proper Markdown formatting
- Code blocks with syntax highlighting
- Tables for structured data
- Clear section headers

---

*This meta-skill enables Claude to become an expert on any Sui contract.*
