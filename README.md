# MoveWhisperer

Generate Claude SKILL.md files from Sui Move smart contracts. Analyze on-chain packages and produce ready-to-use AI skill documentation across 6 scene modes.

## Quick Start

```bash
pnpm install

# CLI
pnpm run cli generate <package-id> --network mainnet --scene sdk

# Web UI
cd web && pnpm dev        # http://localhost:3000

# Local server (bridges Web UI with CLI tools)
pnpm run serve            # http://localhost:3456
```

## Architecture

```
CLI / Web UI
     ↓
MainGenerator
 ├─ AbiFetcher       → Sui RPC ABI fetch + cache
 ├─ ModuleAnalyzer   → Function semantics & dependency detection
 ├─ SkillGenerator   → Handlebars template rendering
 ├─ ScriptGenerator  → TypeScript code examples
 └─ FileWriter       → SKILL.md output
```

### Scene Modes

| Scene | Purpose |
|-------|---------|
| `sdk` | Function references, PTB patterns, code examples |
| `learn` | Architecture, concepts, design patterns |
| `audit` | Permissions, risks, vulnerability analysis |
| `frontend` | User flows, data queries, UX patterns |
| `bot` | Gas optimization, batch ops, monitoring |
| `docs` | API reference, type definitions |

## Project Structure

```
src/
├── cli/          # Commander.js CLI (generate, preview, list, source, serve)
├── fetcher/      # Sui RPC client + ABI caching
├── analyzer/     # Semantic function analysis
├── generator/    # SKILL.md + script generation
├── templates/    # Handlebars scene templates
├── decompiler/   # Move bytecode decompilation
├── mapper/       # Move → TypeScript type mapping
└── server/       # HTTP + WebSocket bridge server

web/              # Next.js UI (Cloudflare Pages)
├── app/
│   ├── generate/     # Skill generation wizard
│   ├── marketplace/  # Skill discovery & publishing
│   ├── playground/   # Interactive skill testing
│   ├── tx/           # Transaction explorer
│   └── audit/        # Security audit view
├── lib/
│   ├── auth/         # Wallet-based JWT auth
│   ├── db/           # D1 database layer
│   ├── contracts/    # Sui smart contract integration
│   ├── walrus/       # Walrus decentralized storage
│   └── seal/         # Seal encryption for paid skills
└── hooks/            # React hooks

contracts/
└── skill_marketplace/  # Sui Move smart contract for on-chain marketplace

migrations/           # Cloudflare D1 schema migrations
```

## Marketplace

The Skill Marketplace supports two publishing methods:

- **GitHub URL** - Submit a link to a SKILL.md in a public repo
- **Direct Upload** - Publish saved skills directly from your account

Paid skills use **Walrus** for decentralized storage and **Seal** for access-controlled encryption.

## Commands

```bash
pnpm run build          # Compile TypeScript
pnpm run dev            # Watch mode
pnpm run test:run       # Run tests
pnpm run lint           # ESLint
pnpm run format         # Prettier

# Web
cd web && pnpm build    # Production build
cd web && pnpm deploy   # Deploy to Cloudflare Pages

# Decompiler
pnpm run install:revela # Install Revela Move decompiler
```

## Tech Stack

**Core:** TypeScript, Commander.js, Handlebars, Zod, `@mysten/sui`

**Web:** Next.js 14, Tailwind CSS, Zustand, Radix UI, `@mysten/dapp-kit`

**Infra:** Cloudflare Pages + D1, Walrus, Seal

## License

MIT
