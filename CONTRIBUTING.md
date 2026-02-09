# Contributing to Mailgent

Thank you for your interest in contributing to Mailgent! This guide covers everything you need to get started.

## Getting Started

1. Fork the repository and clone your fork
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env`
4. Run the development environment: `make dev`

## Requirements

- Node.js >= 22.0.0
- npm >= 9

## Project Structure

```
mailgent/
├── packages/shared/          # Shared types and validators (@mailgent/shared)
│   └── src/
│       ├── types/            # TypeScript interfaces
│       ├── validators.ts     # Zod schemas
│       └── constants.ts      # System constants
├── apps/backend/             # Node.js server
│   └── src/
│       ├── main.ts           # Entry point
│       ├── config.ts         # Configuration
│       ├── db/               # Database layer (SQLite)
│       ├── agents/           # Agent system (manager, registry, runner, sandbox)
│       ├── mail/             # SMTP server, parser, store, queue
│       ├── llm/              # LLM providers (Claude, OpenAI), routing, rate limiting
│       ├── tools/            # Tool registry, executor, built-in tools
│       ├── skills/           # Skill system
│       ├── metrics/          # Usage tracking
│       ├── git/              # Git integration
│       └── server/           # Express app, routes, WebSocket
├── apps/frontend/            # React web UI
│   └── src/
│       ├── pages/            # Page components
│       ├── components/       # UI components by domain
│       ├── store/            # Zustand store (8 slices)
│       ├── api/              # HTTP and WebSocket clients
│       └── hooks/            # React hooks
```

## Development Workflow

### Build Order

Shared package must always be built first:

```bash
npm run build:shared    # Always first
npm run build:backend   # Then backend
npm run build:frontend  # Then frontend
```

`make dev` handles this automatically.

### Running Checks

```bash
make check    # TypeScript type checking (backend + frontend)
npm run lint  # ESLint
```

### Making Changes

1. Create a feature branch from `main`
2. Make your changes
3. Ensure `make check` passes
4. Commit with a clear message
5. Open a pull request

## Code Conventions

### TypeScript

- **Strict mode** is enabled across all workspaces
- The project is **pure TypeScript** — no `.js` files, no compiled output needed for development
- Backend runs via `tsx` — TypeScript executes directly, no build step for dev
- **Bundler module resolution** — NO `.js` extensions in imports anywhere:
  ```typescript
  import { something } from './module';       // correct
  import { something } from '../utils/helper'; // correct
  ```
- Use `import.meta.dirname` for directory path (Node.js 22+ ESM)
- Use `node:` prefix for built-in modules (`node:fs/promises`, `node:child_process/promises`)
- Shared types go in `packages/shared/src/types/`
- Runtime validation schemas go in `packages/shared/src/validators.ts`

### Backend Patterns

- **Routes** are factory functions that accept dependencies and return Express Routers:
  ```typescript
  export function createAgentRoutes(deps: { agentRepo: AgentRepo; ... }): Router {
    const router = Router();
    // ...
    return router;
  }
  ```
- **Repositories** use the `swapDb(db)` pattern for runtime project switching
- **EventBus** singleton for inter-module communication — prefer events over direct coupling
- **Path validation** — always use sandbox/path-guard for filesystem operations

### Frontend Patterns

- **Zustand** for state management — one slice per domain (agents, emails, chat, etc.)
- **Page names must match store slice names** — don't guess, check the store
- **Tailwind CSS** for styling — no CSS modules or styled-components
- **Lucide React** for icons

### Database

- Email table uses quoted column names: `"from"`, `"to"`, `"references"` (SQL reserved words)
- Settings repo `get()` returns `T | undefined` — handle explicitly
- Both databases use WAL mode for performance

### Common Pitfalls

- Node.js does NOT expand `~` in paths — use the `expandTilde()` helper
- Don't cache `cwd` in tool functions — use `getCwd()` getter (sandbox changes on project switch)
- AgentRegistry `stopAll()` must call `agents.clear()` or old agents persist
- Don't put `WORKDIR` or `MAILGENT_HOME` in `.env` — defaults in config.ts use `os.homedir()` correctly

## Adding New Features

### Adding a New Tool

1. Define the tool in `apps/backend/src/tools/builtin/index.ts`
2. Add a `ToolDefinition` type in `packages/shared/src/types/tool.ts` if needed
3. Use `getCwd()` getter for working directory (not a cached value)
4. Use `execFile` from `node:child_process/promises` for shell commands
5. Tools are registered automatically via the tool registry on startup

### Adding a New API Route

1. Create a route factory in `apps/backend/src/server/routes/`
2. Add Zod validation schema in `packages/shared/src/validators.ts`
3. Register the route in `apps/backend/src/server/app.ts`
4. Add corresponding frontend API call in `apps/frontend/src/api/http-client.ts`
5. Update the Zustand store slice if needed

### Adding a New Agent Type

1. Define the agent type in `packages/shared/src/types/agent.ts`
2. Add system prompt logic in the agent runner
3. Register in `packages/shared/src/constants.ts` if it's a system agent

## Pull Requests

All changes are accepted **only through Pull Requests**. Direct pushes to `main` are not allowed.

### How to submit a PR

1. Fork the repository
2. Create a feature branch from `main`:
   ```bash
   git checkout -b feature/my-feature
   ```
3. Make your changes and ensure `make check` passes
4. Commit with a clear, descriptive message:
   ```bash
   git commit -m "feat: Add support for custom email templates"
   ```
5. Push your branch:
   ```bash
   git push origin feature/my-feature
   ```
6. Open a Pull Request against `main`

### PR requirements

- **One feature or fix per PR** — keep changes focused and reviewable
- **Descriptive title** — short, clear summary of the change (under 70 characters)
- **Description** — explain what changed, why, and how to test it
- **Passing checks** — `make check` must pass without errors
- **Shared types** — update `packages/shared` if your changes affect the API contract
- **No unrelated changes** — don't sneak in formatting or refactoring outside the scope

### Commit message format

Use [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix | Usage |
|--------|-------|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `refactor:` | Code refactoring without behavior change |
| `docs:` | Documentation only |
| `chore:` | Build, deps, config changes |

## Reporting Issues

Found a bug or have a feature suggestion? Please open an [Issue](https://github.com/bintocher/Mailgent/issues) on GitHub.

Include in bug reports:
- Steps to reproduce
- Expected vs actual behavior
- Node.js version (22+) and OS
- Relevant log output

For feature requests, describe the use case and expected behavior.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
