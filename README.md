# MoveWhisperer

Generate Claude SKILL.md files from Sui Move smart contracts. Analyze on-chain packages and produce ready-to-use AI skill documentation across 6 scene modes.

**Live:** [skills.sui.tools](https://skills.sui.tools)

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [CLI Usage](#cli-usage)
- [Web UI](#web-ui)
- [Local Server](#local-server)
- [Marketplace](#marketplace)
- [Smart Contract](#smart-contract)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Development](#development)
- [Tech Stack](#tech-stack)
- [License](#license)

## Features

- **Skill Generation** - Analyze any Sui Move contract and generate a comprehensive SKILL.md for Claude
- **6 Scene Modes** - SDK, Learn, Audit, Frontend, Bot, Docs (see [Scene Modes](#scene-modes))
- **Move Decompilation** - Decompile on-chain bytecode using [Revela](https://github.com/verichains/revela) for source-unavailable packages
- **Skill Marketplace** - Discover, publish, buy, and sell AI skills on-chain
- **Walrus + Seal** - Decentralized storage with access-controlled encryption for paid skills
- **Playground** - Interactive chat powered by Claude with injected SKILL.md context
- **Transaction Analyzer** - Inspect and understand Sui transactions
- **Security Audit** - AI-powered Move contract security analysis based on real audit reports
- **Version History** - Compare contract versions and track upgrades

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| **Node.js** | >= 20.0.0 | Required |
| **pnpm** | >= 8 | Package manager (`npm install -g pnpm`) |
| **Sui CLI** | Latest | Optional, for on-chain operations ([Install](https://docs.sui.io/guides/developer/getting-started/sui-install)) |
| **Claude Code** | Latest | Optional, for AI-powered features ([Install](https://claude.ai/code)) |
| **Rust toolchain** | Latest | Optional, only if building Revela from source |

## Installation

### 1. Clone and install dependencies

```bash
git clone https://github.com/bond/auto-sui-skill.git
cd auto-sui-skill
pnpm install
```

### 2. Build the CLI

```bash
pnpm run build
```

### 3. Install Revela decompiler (optional)

Revela enables decompilation of on-chain Move bytecode into readable source code.

**One-click install:**

```bash
pnpm run install:revela
```

**Manual install (if the script fails):**

```bash
# Ubuntu/Debian prerequisites
sudo apt install build-essential pkg-config libssl-dev libclang-dev cmake

# macOS prerequisites
brew install openssl cmake

# Build from source
git clone https://github.com/verichains/revela
cd revela/external-crates/move
cargo build --release -p move-decompiler

# Copy to PATH
cp target/release/move-decompiler ~/.cargo/bin/
```

### 4. Set up the Web UI

```bash
cd web
pnpm install
cp .env.example .env  # or create .env manually (see Environment Variables)
```

## Quick Start

```bash
# Generate a SKILL.md from a Sui package
pnpm run cli generate 0x2 --network mainnet --scene sdk

# Preview without saving
pnpm run cli preview 0xdee9 --network mainnet

# Start the Web UI
cd web && pnpm dev          # http://localhost:3000

# Start the local bridge server
pnpm run serve              # http://localhost:3456
```

## CLI Usage

The CLI provides 7 commands for interacting with Sui Move contracts:

### `generate` - Generate SKILL.md

```bash
pnpm run cli generate <package-id> [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `-n, --network <network>` | Sui network (`mainnet`, `testnet`, `devnet`) | `mainnet` |
| `-s, --scene <scene>` | Scene mode (see below) | `sdk` |
| `-o, --output <dir>` | Output directory | `./skills/` |
| `-l, --lang <lang>` | Language (`en`, `zh`) | `en` |
| `--modules <names>` | Filter specific modules (comma-separated) | all |
| `--analyze-deps` | Include dependency analysis | `false` |
| `--include-diagram` | Add architecture diagrams | `false` |
| `--no-scripts` | Skip script generation | - |
| `--no-examples` | Skip code examples | - |
| `-v, --verbose` | Verbose logging | `false` |

**Examples:**

```bash
# Generate SDK skill for Cetus DEX
pnpm run cli generate 0x1eabed72c53feb467b37d3d6e10e88c5d66d5e4a86d6e3e0b0a7d1e8c9f2a3b \
  --network mainnet --scene sdk --lang en

# Generate audit skill for a testnet contract
pnpm run cli generate 0xabc123... --network testnet --scene audit

# Generate with dependency analysis and diagrams
pnpm run cli generate 0x2 --analyze-deps --include-diagram --scene learn
```

### `preview` - Preview without saving

```bash
pnpm run cli preview <package-id> --network mainnet
```

### `list` - List package modules

```bash
pnpm run cli list <package-id> --network mainnet
```

### `source` - Download Move source code

```bash
pnpm run cli source <package-id> [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `-n, --network` | Sui network | `mainnet` |
| `-m, --module` | Specific module | all |
| `-o, --output` | Output file | stdout |
| `-f, --format` | Output format (`console`, `file`, `json`) | `console` |

### `history` - Package version history

```bash
pnpm run cli history <package-id> [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `-n, --network` | Sui network | `mainnet` |
| `-f, --format` | Output format (`table`, `json`, `markdown`) | `table` |
| `-c, --compare` | Compare two versions (e.g., `1,2`) | - |
| `-m, --module` | Filter module | all |
| `-d, --diff-type` | Diff type | - |
| `--decompile` | Decompile before comparing | `false` |

### `tx` - Analyze a transaction

```bash
pnpm run cli tx <digest> --network mainnet
```

### `serve` - Start the local bridge server

```bash
pnpm run cli serve --port 3456 --open
```

## Scene Modes

Each scene mode tailors the generated SKILL.md for a specific use case:

| Scene | Focus | Best For |
|-------|-------|----------|
| `sdk` | Function signatures, TypeScript examples, PTB patterns | Developers building on the contract |
| `learn` | Architecture diagrams, concepts, state transitions | Understanding protocol design |
| `audit` | Permissions, risks, vulnerability checklist | Security review and assessment |
| `frontend` | User flows, data queries, event listening, UX | Frontend developers building dApps |
| `bot` | Gas optimization, batch operations, monitoring | Automated trading and MEV |
| `docs` | API reference, module index, type definitions | Technical documentation |

## Web UI

The web interface at [skills.sui.tools](https://skills.sui.tools) provides:

### Pages

| Page | URL | Description |
|------|-----|-------------|
| **Generate** | `/generate` | Interactive skill generation wizard |
| **Marketplace** | `/marketplace` | Browse, search, and purchase skills |
| **Skill Detail** | `/marketplace/[id]` | View skill details, preview, and purchase |
| **Submit Skill** | `/marketplace/submit` | Publish a new skill to the marketplace |
| **Playground** | `/playground` | Chat with Claude using injected skill context |
| **Transaction Explorer** | `/tx` | Analyze Sui transactions with AI |
| **Security Audit** | `/audit` | AI-powered Move contract security audit |
| **Version History** | `/history` | Track and compare package upgrades |

### Authentication

Users authenticate via **Sui wallet signature** (zkLogin or standard wallets). The flow:

1. Connect wallet (Sui Wallet, Suiet, Martian, etc.)
2. Sign a personal message containing a server-generated nonce
3. Server verifies the signature and issues a JWT session cookie

## Local Server

The local bridge server (`pnpm run serve`) connects the web UI to local CLI tools and enables features that require local execution:

- **Port:** 3456 (configurable via `PORT` env)
- **Endpoints:**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Server status and available CLI tools |
| `/api/decompile` | POST | Decompile Sui package bytecode using Revela |
| `/api/claude` | POST | Execute Claude Code CLI commands |
| `/api/skill-audit` | POST | Run AI security audit with SKILL.md injection |
| `/api/terminal` | POST | Execute terminal commands |
| `/ws` | WS | WebSocket for streaming output |

The web UI auto-detects the local server at `http://127.0.0.1:3456` and enables enhanced features (decompilation, Claude-powered audit, etc.) when connected.

## Marketplace

The Skill Marketplace enables buying and selling AI skills for Sui Move contracts.

### Publishing Methods

1. **GitHub URL** - Link to a SKILL.md in a public repository
2. **Direct Upload** - Upload from your saved skills

### Pricing

- **Free** - Anyone can download and use
- **Paid** - Set a price in SUI; content is encrypted and stored on Walrus

### On-Chain Architecture

Paid skills use three Sui ecosystem components:

| Component | Role |
|-----------|------|
| **Skill Marketplace Contract** | On-chain SkillRecord, AccessCap NFTs, purchase logic |
| **Walrus** | Decentralized blob storage for skill content |
| **Seal** | Threshold encryption; only AccessCap holders can decrypt |

### Purchase Flow

1. Buyer calls `purchase_skill()` on-chain, paying the listed SUI price
2. An `AccessCap` NFT is minted to the buyer's wallet
3. Buyer's browser downloads the encrypted blob from Walrus
4. Browser creates a Seal session key and signs it with the wallet
5. Seal key servers verify the AccessCap via `seal_approve_v2` and release decryption keys
6. Content is decrypted client-side

## Smart Contract

The marketplace smart contract is at `contracts/skill_marketplace/`.

### Key Functions

| Function | Description |
|----------|-------------|
| `publish_skill` | Create a new SkillRecord (shared object) |
| `purchase_skill` | Buy access; mints AccessCap NFT |
| `claim_free_skill` | Claim a free skill's AccessCap |
| `seal_approve_v2` | Seal access policy for paid skills |
| `seal_approve_free_v2` | Seal access policy for free skills |
| `update_price` | Creator updates skill price |
| `update_blob` | Creator updates blob reference |
| `withdraw_revenue` | Creator withdraws accumulated SUI |

### Building and Testing

```bash
cd contracts/skill_marketplace

# Run tests
sui move test

# Build
sui move build

# Publish to testnet
sui client publish --gas-budget 100000000
```

### Published Contract

| Field | Value |
|-------|-------|
| Network | Mainnet |
| Package ID | `0x8753bf39265f8e209f0a3c643c3dcec32348216cd3354e0aacae988ae54869a2` |
| UpgradeCap | `0xbd7d8911d293ecdcefefc6d03dda1504cb935e99216617a45ada16f9f72b512f` |

## Environment Variables

### Web UI (`web/.env`)

> **Important:** `NEXT_PUBLIC_*` variables must be in `web/.env` for build-time inlining. They are NOT available from `wrangler.toml` at runtime in the client bundle.

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_APP_URL` | Application URL | Yes |
| `NEXT_PUBLIC_MARKETPLACE_PACKAGE_ID` | Original (v1) marketplace contract package ID | Yes |
| `NEXT_PUBLIC_MARKETPLACE_V2_PACKAGE_ID` | Upgraded (v2) package ID (for seal_approve_v2, etc.) | No (defaults to v1) |
| `NEXT_PUBLIC_MARKETPLACE_NETWORK` | Network for marketplace (`mainnet` or `testnet`) | Yes |
| `NEXT_PUBLIC_SEAL_API_KEY` | API key for Seal key servers (Ruby Nodes) | No |
| `NEXT_PUBLIC_WALRUS_AGGREGATOR_URL` | Custom Walrus aggregator URL | No |
| `JWT_SECRET` | Secret for signing JWT session tokens | Yes (server-side) |
| `JWT_ISSUER` | JWT issuer claim | No (default: `move-whisperer`) |
| `JWT_AUDIENCE` | JWT audience claim | No (default: `web`) |
| `SESSION_MAX_AGE` | Session TTL in seconds | No (default: `2592000`) |

### Local Server

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | HTTP server port | `3456` |

## Deployment

The web UI deploys to **Cloudflare Pages** with a **D1** database.

### Database Setup

```bash
# Create D1 database
wrangler d1 create move-whisperer-db

# Run migrations
pnpm run cf:migrate

# Or run migrations against remote
wrangler d1 migrations apply move-whisperer-db --remote
```

### Deploy

```bash
# Full deploy (Vercel build + Cloudflare Pages adapter + Wrangler deploy)
cd web
npx vercel@37.0.0 build && \
npx @cloudflare/next-on-pages --skip-build && \
npx wrangler pages deploy .vercel/output/static --project-name=move-whisperer
```

> **Note:** Use Vercel CLI v37.0.0. Versions 50+ have a ProxyAgent bug that breaks the build.

### Secrets

```bash
# Set JWT secret for production
wrangler pages secret put JWT_SECRET --project-name=move-whisperer
```

## Architecture

```
User Input (CLI / Web UI)
        |
        v
  MainGenerator (src/core/generator.ts)
   |-- AbiFetcher -----> Sui RPC (fetch ABI + bytecode)
   |-- ModuleAnalyzer --> Semantic analysis (functions, structs, dependencies)
   |-- SkillGenerator --> Handlebars templates (6 scene modes)
   |-- ScriptGenerator -> TypeScript code examples
   '-- FileWriter -----> SKILL.md + script files

Web UI (Next.js on Cloudflare Pages)
   |-- Wallet Auth -----> Sui wallet signature + JWT
   |-- Marketplace -----> D1 database + on-chain SkillRecords
   |-- Paid Skills -----> Walrus (storage) + Seal (encryption)
   '-- Local Server ----> Bridge to CLI tools (port 3456)
```

## Project Structure

```
src/
  cli/            Commander.js CLI with 7 commands
  core/           Main generator orchestration
  fetcher/        Sui RPC client with ABI caching
  analyzer/       Function semantics and dependency detection
  generator/      SKILL.md and script generation
  templates/      Handlebars scene templates (sdk, learn, audit, etc.)
  decompiler/     Move bytecode decompilation via Revela
  mapper/         Move type -> TypeScript type mapping
  server/         HTTP + WebSocket bridge server
    routes/       API route handlers (decompile, chat, claude, skill-audit, etc.)
    security/     Request validation with Zod schemas

web/
  app/
    generate/     Skill generation wizard
    marketplace/  Browse, detail, submit skills
    playground/   Interactive Claude chat with skill context
    tx/           Transaction explorer
    audit/        Security audit view
    history/      Package version history
    api/          Next.js API routes (auth, marketplace CRUD, generation, etc.)
  lib/
    auth/         Wallet-based JWT authentication
    db/           Cloudflare D1 database layer
    contracts/    Sui smart contract transaction builders
    walrus/       Walrus client for decentralized storage
    seal/         Seal client for threshold encryption
    stores/       Zustand state management stores
  hooks/          React hooks (useLocalServer, useSkillMarketplace, etc.)
  components/     Shared UI components

contracts/
  skill_marketplace/   Sui Move smart contract (SkillRecord, AccessCap, etc.)

migrations/            Cloudflare D1 schema migrations (5 files)
```

## Development

```bash
# Build CLI
pnpm run build

# Watch mode
pnpm run dev

# Run tests
pnpm run test           # Watch mode
pnpm run test:run       # Single run

# Lint and format
pnpm run lint
pnpm run format

# Web UI development
cd web && pnpm dev      # http://localhost:3000

# Local Cloudflare Pages dev (with D1 bindings)
pnpm run cf:dev

# Move contract tests
cd contracts/skill_marketplace && sui move test
```

### Sui RPC Endpoints

| Network | URL |
|---------|-----|
| Mainnet | `https://fullnode.mainnet.sui.io:443` |
| Testnet | `https://fullnode.testnet.sui.io:443` |
| Devnet | `https://fullnode.devnet.sui.io:443` |

## Tech Stack

**Core:** TypeScript, Commander.js, Handlebars, Zod, `@mysten/sui`

**Web:** Next.js 14, React 18, Tailwind CSS, Zustand, Radix UI, `@mysten/dapp-kit`

**Blockchain:** `@mysten/sui`, `@mysten/seal`, `@mysten/walrus`

**Infra:** Cloudflare Pages + D1 + KV, Walrus (decentralized storage), Seal (threshold encryption)

**Testing:** Vitest, Sui Move Test

## License

MIT
