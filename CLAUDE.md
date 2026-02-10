# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Package Manager

**This project uses pnpm.** Always use `pnpm` instead of `npm`, `yarn`, or `bun`.

## Build & Development Commands

```bash
# Root package
pnpm run build           # Compile TypeScript → dist/
pnpm run dev             # Watch-mode compilation
pnpm run cli <args>      # Run CLI directly (tsx)
pnpm run serve           # Start local HTTP/WebSocket server (port 3456)
pnpm run test            # Run tests (watch mode)
pnpm run test:run        # Run tests once
pnpm run lint            # ESLint check
pnpm run format          # Prettier format

# Web UI
cd web && pnpm dev       # Next.js dev server (port 3000)
cd web && pnpm run build # Production build

# Install dependencies
pnpm install             # Install all dependencies
```

## Architecture Overview

**MoveWhisperer** generates professional Claude SKILL.md files from Sui Move smart contracts. It consists of four main components:

1. **Core CLI Tool** (`src/cli/`) - Command-line interface with 5 commands: generate, preview, list, source, serve
2. **Generation Engine** (`src/core/`, `src/generator/`, `src/templates/`) - Contract analysis and skill template generation
3. **Local Server** (`src/server/`) - HTTP/WebSocket server for web UI integration and CLI tool orchestration
4. **Next.js Web UI** (`web/`) - React-based interactive interface

### Data Flow Pipeline

```
User Input (CLI/Web)
        ↓
MainGenerator (src/core/generator.ts)
        ├→ AbiFetcher (Sui RPC) - Fetch contract ABI
        ├→ ModuleAnalyzer - Analyze structure & semantics
        ├→ SkillGenerator - Render Handlebars templates
        ├→ ScriptGenerator - Generate code examples
        └→ FileWriter - Output SKILL.md + files
```

### Key Modules

| Directory | Purpose |
|-----------|---------|
| `src/fetcher/` | Sui RPC client, ABI fetching with caching |
| `src/analyzer/` | Function analysis, semantic inference, dependency detection |
| `src/generator/` | SKILL.md generation, code example generation |
| `src/templates/` | Handlebars template engine with 6 scene-specific templates |
| `src/decompiler/` | Move bytecode decompilation |
| `src/server/` | HTTP + WebSocket server, routes for health/decompile/claude |
| `src/mapper/` | Move type → TypeScript type mapping |

### 6 Scene Modes

- `sdk` - Function references, code examples, PTB patterns
- `learn` - Architecture, concepts, design patterns
- `audit` - Permissions, risks, vulnerability checks
- `frontend` - User flows, data queries, UX patterns
- `bot` - Gas optimization, batch operations, monitoring
- `docs` - API reference, type definitions

## Key Types

```typescript
type Network = 'mainnet' | 'testnet' | 'devnet';
type SkillScene = 'sdk' | 'learn' | 'audit' | 'frontend' | 'bot' | 'docs';

interface GenerationOptions {
  network: Network;
  scene: SkillScene;
  language: 'en' | 'zh';
  includeScripts: boolean;
  includeDependencies: boolean;
  moduleFilter?: string[];
}

interface AnalyzedModule {
  packageId: string;
  moduleName: string;
  functions: AnalyzedFunction[];
  structs: AnalyzedStruct[];
  sourceCode?: string;
}
```

## Local Server Integration

The local server (`pnpm run serve`) bridges the web UI with local CLI tools:

- **Port 3456** (configurable via `PORT` env)
- **Endpoints:**
  - `GET /health` - Server status and available CLI tools
  - `POST /api/decompile` - Decompile Sui package using local move-decompiler
  - `POST /api/claude` - Execute Claude Code CLI
  - `POST /api/terminal` - Run arbitrary terminal commands
  - `WS /ws` - WebSocket for streaming output

The web UI at `web/hooks/useLocalServer.ts` connects to this server for enhanced functionality like Revela decompilation.

## Code Patterns

- **Modular Structure:** Each `src/` subdirectory has an `index.ts` barrel export
- **Factory Pattern:** `createXxxGenerator()`, `createAbiFetcher()`
- **Zod Validation:** Runtime schema validation throughout
- **Handlebars Templating:** Templates in `src/templates/scenes/`
- **Error Handling:** Custom error classes in `src/core/errors.ts`, retry logic in `src/utils/retry.ts`

## Sui RPC Endpoints

```
Mainnet: https://fullnode.mainnet.sui.io:443
Testnet: https://fullnode.testnet.sui.io:443
Devnet:  https://fullnode.devnet.sui.io:443
```

## External CLI Tools

The local server integrates with external CLI tools for enhanced functionality:

### move-decompiler (Revela)

High-quality Move bytecode decompiler from Verichains.

**Prerequisites (Ubuntu/Debian):**
```bash
sudo apt install build-essential pkg-config libssl-dev libclang-dev cmake
```

**Prerequisites (macOS):**
```bash
brew install openssl cmake
```

**One-click install:**
```bash
pnpm run install:revela
```

**Manual install:**
```bash
git clone https://github.com/verichains/revela
cd revela/external-crates/move
cargo build --release -p move-decompiler
# Binary at: target/release/move-decompiler
# Copy to PATH: cp target/release/move-decompiler ~/.cargo/bin/
```

**Usage:**
```bash
# Decompile bytecode files
move-decompiler -b module1.mv module2.mv

# The CLI only accepts bytecode files, not network fetch
# Bytecode must be fetched separately via Sui RPC
```

### Other Tools

- `sui` - Sui CLI for blockchain interaction ([Install Guide](https://docs.sui.io/guides/developer/getting-started/sui-install))
- `claude` - Claude Code CLI for AI generation ([Install Guide](https://claude.ai/code))

## Key Dependencies

- `@mysten/sui` - Sui blockchain SDK
- `commander` - CLI parsing
- `handlebars` - Template engine
- `zod` - Schema validation
- `ws` - WebSocket server
- `next` (web/) - React framework
- `tailwindcss` (web/) - CSS framework
