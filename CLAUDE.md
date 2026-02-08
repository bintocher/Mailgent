# CLAUDE.md — LLM Coding Instructions for Mailgent

This file provides instructions for LLMs (Claude, GPT, etc.) working on this codebase.

## Project Overview

Mailgent is a Virtual Company platform — a monorepo where AI agents communicate via internal SMTP email. The codebase has three workspaces:

- `packages/shared` — shared TypeScript types and Zod validators
- `apps/backend` — Express + WebSocket + SMTP server (Node.js 22+)
- `apps/frontend` — React 18 + Vite + Tailwind + Zustand

## Build & Verify

```bash
# Build shared types (MUST be first — other packages depend on it)
npm run build:shared

# Type check without emitting
npx tsc --noEmit --project apps/backend/tsconfig.json
npx tsc --noEmit --project apps/frontend/tsconfig.json

# Full build
make build

# Run dev
make dev
```

Always run `npm run build:shared` before checking backend or frontend types.

## Module Resolution Rules

### Backend (apps/backend)

- Pure **TypeScript ESM** — runs via `tsx`, `"moduleResolution": "bundler"`
- **NO `.js` extensions** in imports:
  ```typescript
  import { foo } from './bar';              // correct
  import { baz } from '../utils/helper';    // correct
  ```
- Use `import.meta.dirname` for directory path (Node.js 22+ ESM)
- Use `node:` prefix for built-in modules (`node:child_process/promises`, `node:fs/promises`)

### Frontend (apps/frontend)

- Uses **ESNext/bundler** module resolution (Vite handles it)
- NO `.js` extensions in imports
- Path alias: `@/` maps to `src/`

### Shared (packages/shared)

- Imported as `@mailgent/shared` in both backend and frontend
- Types + Zod validators + constants — no heavy runtime code
- Must be built before other packages can use it

## Key Architecture Rules

### Route Factories

All Express routes are factory functions receiving dependencies:

```typescript
export function createSomeRoutes(deps: {
  someRepo: SomeRepo;
  eventBus: EventBus;
}): Router {
  const router = Router();
  router.get('/', (req, res) => { ... });
  return router;
}
```

Never import repositories directly — always receive them as deps.

### Repository Pattern with swapDb

All repositories support hot-swapping the database for runtime project switching:

```typescript
class SomeRepo {
  private db: Database;
  swapDb(db: Database) { this.db = db; }
}
```

### EventBus

Singleton event emitter for inter-module communication:

```typescript
import { eventBus } from '../utils/event-bus';
eventBus.emit('email:received', emailData);
eventBus.on('email:stored', (email) => { ... });
```

### Zustand Store (Frontend)

State is organized into slices. The store in `apps/frontend/src/store/index.ts` is the source of truth — don't re-fetch data on mount if the store already has it.

## Database Gotchas

- Two databases: global (`~/.mailgent/global.db`) and project (`<workdir>/.mailgent/project.db`)
- Email table uses quoted column names: `"from"`, `"to"`, `"references"` (SQL reserved words)
- Settings repo `get<T>()` returns `T | undefined` — always handle the undefined case
- `emailRepo.create()` generates its own id/messageId — use `storeIncoming()` for SMTP emails

## Agent System Rules

- EventBus events: tools use DASHES (`agent:create-request`), WS handlers use UNDERSCORES (`agent:stop_request`)
- `create_sub_agent` uses request/response pattern — agent is registered before the tool returns
- Master + Dispatcher: `allowedToolCategories = ['communication', 'orchestration']`
- `routeEmail`: if sender is a registered agent and recipient unknown → DROP email (prevent loops)
- `master:email_result` uses `chat:agent_message` event to add messages to chat directly

## Common Mistakes to Avoid

1. **Don't cache working directory** — use `getCwd()` getter. Sandbox cwd changes on project switch.
2. **Don't put WORKDIR or MAILGENT_HOME in .env** — defaults in `config.ts` use `os.homedir()`.
3. **Node.js does NOT expand `~`** — use the `expandTilde()` helper from config.ts.
4. **AgentRegistry.stopAll() must call agents.clear()** — old agents persist across project switches.
5. **WebSocket stale handlers** — guard `onclose` with `if (this.ws !== ws) return;`.
6. **Don't duplicate Zod schemas** — import from `packages/shared/src/validators.ts`.
7. **Email routing** — only MailQueue routes emails. Don't duplicate in AgentManager events.
8. **Use `storeIncoming()` for SMTP emails** — `create()` generates new id/messageId, breaking threads.
9. **Master agent tools** — only communication + orchestration. No filesystem or git.

## Adding New Code

### New shared type
1. Create/edit in `packages/shared/src/types/`
2. Export from `packages/shared/src/index.ts`
3. Add Zod schema in `validators.ts` if needed for API input
4. Run `npm run build:shared`

### New backend module
1. Create in appropriate `apps/backend/src/` subdirectory
2. Receive deps via constructor/factory — don't import singletons (except EventBus and logger)
3. Register in `main.ts` if it needs initialization

### New built-in tool
1. Add in `apps/backend/src/tools/builtin/index.ts`
2. Use `getCwd()` getter for working directory
3. Use `execFile` from `node:child_process/promises` for shell commands
4. Tool is auto-registered on startup

## Constants & Limits

Defined in `packages/shared/src/constants.ts`:

- `MAX_AGENT_THINK_ITERATIONS`: 20
- `MAX_THREAD_DEPTH`: 10
- `MAX_TOOL_EXECUTION_TIME`: 30s
- `MAX_SUB_AGENTS`: 10
- `QUEUE_MAX_CONCURRENT`: 5

## File Naming

- Backend: `kebab-case.ts` (`agent-manager.ts`, `mail-store.ts`)
- Frontend pages: `PascalCase.tsx` (`ChatPage.tsx`, `AgentsPage.tsx`)
- Shared types: `kebab-case.ts` (`agent.ts`, `email.ts`)
