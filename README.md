# MoveWhisperer

Generate Claude SKILL.md files from Sui Move smart contracts — 6 scene modes, on-chain marketplace, AI-powered audit.

**Live:** [move-whisperer.pages.dev](https://move-whisperer.pages.dev)

**Demo:**

[![Watch Demo](https://img.youtube.com/vi/laoO1t4kHfk/maxresdefault.jpg)](https://www.youtube.com/watch?v=laoO1t4kHfk)

## Features

- **Skill Generation** — Analyze any Sui Move contract → SKILL.md for Claude (6 scene modes)
- **Move Decompilation** — On-chain bytecode → readable source via [Revela](https://github.com/verichains/revela)
- **Skill Marketplace** — Publish, discover, buy/sell AI skills on-chain (Walrus + Seal encryption)
- **Playground** — Chat with Claude using injected SKILL.md context
- **Security Audit** — AI-powered Move contract audit via Claude CLI + move-audit skill
- **TX Analyzer** — Inspect and understand Sui transactions
- **Version History** — Compare contract versions across upgrades

## Prerequisites

| Requirement | Version | Required | Notes |
|-------------|---------|----------|-------|
| **Node.js** | >= 20 | Yes | Runtime |
| **pnpm** | >= 8 | Yes | `npm install -g pnpm` |
| **Sui CLI** | Latest | No | On-chain operations ([Install](https://docs.sui.io/guides/developer/getting-started/sui-install)) |
| **Claude Code** | Latest | No | AI audit & playground ([Install](https://claude.ai/code)) |
| **Revela** | Latest | No | Move bytecode decompiler — `pnpm run install:revela` ([Repo](https://github.com/verichains/revela)) |
| **Rust** | Latest | No | Only needed to build Revela from source |

> **Minimal setup:** Node.js + pnpm is enough for CLI generation and Web UI. Sui CLI, Claude Code, and Revela unlock additional features (on-chain ops, AI audit, decompilation).

## Quick Start

```bash
git clone https://github.com/0xCryptoZen/move-whisperer.git
cd move-whisperer
pnpm install && pnpm run build

# Generate a SKILL.md
pnpm run cli generate 0x2 --network mainnet --scene sdk

# Web UI
cd web && pnpm install && pnpm dev    # http://localhost:3000

# Bridge server (enables decompilation, Claude audit, etc.)
pnpm run serve                         # http://localhost:3456
```

## Scene Modes

| Scene | Focus |
|-------|-------|
| `sdk` | Function signatures, TypeScript examples, PTB patterns |
| `learn` | Architecture, concepts, state transitions |
| `audit` | Permissions, risks, vulnerability checklist |
| `frontend` | User flows, data queries, event listening |
| `bot` | Gas optimization, batch operations, monitoring |
| `docs` | API reference, module index, type definitions |

## CLI

```bash
pnpm run cli generate <pkg> -n mainnet -s sdk    # Generate SKILL.md
pnpm run cli preview <pkg> -n mainnet             # Preview without saving
pnpm run cli list <pkg> -n mainnet                # List modules
pnpm run cli source <pkg> -n mainnet              # Download source
pnpm run cli history <pkg> -n mainnet             # Version history
pnpm run cli tx <digest> -n mainnet               # Analyze transaction
pnpm run cli serve --port 3456                    # Start bridge server
```

Key options: `--scene`, `--network`, `--lang`, `--modules`, `--analyze-deps`, `--include-diagram`

## Marketplace

On-chain skill marketplace powered by **Sui + Walrus + Seal**:

- **Free skills** — anyone can claim
- **Paid skills** — encrypted on Walrus, buyer gets `AccessCap` NFT → Seal decrypts client-side

### Purchase Flow

1. `purchase_skill()` on-chain → `AccessCap` NFT minted
2. Download encrypted blob from Walrus
3. Seal key servers verify `AccessCap` → release decryption keys
4. Content decrypted in browser

### Contract (Mainnet)

Package: `0x8753bf39265f8e209f0a3c643c3dcec32348216cd3354e0aacae988ae54869a2`

```bash
cd contracts/skill_marketplace
sui move test    # Run tests
sui move build   # Build
```

## Bridge Server

`pnpm run serve` exposes local CLI tools to the web UI:

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Server status |
| `POST /api/decompile` | Decompile bytecode via Revela |
| `POST /api/skill-audit` | AI audit via Claude CLI + move-audit skill |
| `POST /api/claude` | Execute Claude Code CLI |
| `WS /ws` | Streaming output |

## Architecture

```
CLI / Web UI
    ↓
MainGenerator
 ├─ AbiFetcher ──→ Sui RPC
 ├─ ModuleAnalyzer ──→ Semantic analysis
 ├─ SkillGenerator ──→ Handlebars templates (6 scenes)
 └─ FileWriter ──→ SKILL.md + scripts

Web UI (Next.js / Cloudflare Pages)
 ├─ Wallet Auth (Sui signature + JWT)
 ├─ Marketplace (D1 + on-chain SkillRecords)
 ├─ Paid Skills (Walrus storage + Seal encryption)
 └─ Bridge Server (CLI tools on port 3456)
```

## Deployment

```bash
# Cloudflare Pages
cd web
npx vercel@37.0.0 build && \
npx @cloudflare/next-on-pages --skip-build && \
npx wrangler pages deploy .vercel/output/static --project-name=move-whisperer
```

> Use Vercel CLI v37. Versions 50+ have a ProxyAgent bug.

## Tech Stack

**Core:** TypeScript, Commander.js, Handlebars, Zod, `@mysten/sui`
**Web:** Next.js 14, Tailwind CSS, Zustand, `@mysten/dapp-kit`
**On-chain:** `@mysten/sui`, `@mysten/seal`, `@mysten/walrus`
**Infra:** Cloudflare Pages + D1, Walrus, Seal

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=0xCryptoZen/move-whisperer&type=Date)](https://star-history.com/#0xCryptoZen/move-whisperer&Date)

## License

[MIT](LICENSE)
