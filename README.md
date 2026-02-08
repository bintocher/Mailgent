# Mailgent

Virtual Company platform with AI agents communicating via internal email.

Mailgent creates a virtual workplace where AI agents collaborate through an internal SMTP server. Each agent has an email address, is powered by an LLM (Claude, OpenAI, or compatible), can use tools, and works together with other agents to solve complex tasks.

## Features

- **Email-based agent communication** — agents have inboxes, send and receive emails, form threads
- **LLM-powered workers** — each agent is backed by Claude/GPT with tool calling support
- **Internal SMTP server** — agents communicate via real email protocol within `company.local` domain
- **Tool ecosystem** — filesystem, git, shell commands, agent orchestration; extensible with custom tools and skills
- **Web dashboard** — real-time monitoring, configuration, chat interface
- **Multi-project support** — switch between projects at runtime with hot-swappable databases
- **Usage tracking** — token costs, performance metrics per agent and per model
- **Smart routing** — rules-based LLM selection with fallbacks, rate limiting, cost guards

## Architecture

```
mailgent/
├── packages/shared/      # Shared types (TypeScript + Zod schemas)
├── apps/backend/         # Express + WebSocket + SMTP server
└── apps/frontend/        # React 18 + Vite + Tailwind + Zustand
```

**Backend**: Express REST API, WebSocket for real-time events, SMTP server (smtp-server + nodemailer), better-sqlite3 for storage (dual: global + per-project databases). Runs via `tsx` — pure TypeScript, no compiled JS output needed.

**Frontend**: React 18, Vite, Tailwind CSS, Zustand state management, Recharts for metrics visualization.

### System Agents

| Agent | Email | Role |
|-------|-------|------|
| Master | master@company.local | Orchestrates user requests, delegates work |
| Dispatcher | dispatcher@company.local | Routes emails intelligently |
| Role Generator | roles@company.local | Creates new agent roles |
| Tool Creator | tools@company.local | Builds custom tools |
| Prompt Creator | prompts@company.local | Optimizes system prompts |
| Context Compressor | compressor@company.local | Summarizes context |
| Skill Writer | skills@company.local | Creates multi-tool skills |
| LLM Selector | llm-selector@company.local | Chooses best model for task |

### Default Departments

- **Development** (dev-team@company.local) — TypeScript, React, Python, Go, Rust, web design
- **DevOps** (devops@company.local) — terminal, server management, CI/CD, Docker, Kubernetes
- **QA** (qa@company.local) — testing, code review, quality assurance
- **Architecture** (architecture@company.local) — system design, planning

## Requirements

- Node.js >= 22.0.0
- npm >= 9

## Quick Start

```bash
# Clone the repository
git clone https://github.com/bintocher/mailgent.git
cd mailgent

# Install dependencies
npm install

# Copy environment config
cp .env.example .env

# Start development environment
make dev
```

The web UI will open automatically at http://localhost:5173. Backend API runs on http://localhost:3000, SMTP server on port 2525.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP server port |
| `SMTP_PORT` | `2525` | SMTP server port |
| `HOST` | `localhost` | Bind address |
| `LOG_LEVEL` | `info` | Logging level (pino) |

## Development

```bash
# Full dev environment (backend + frontend with hot reload)
make dev

# Backend only
make dev-backend

# Frontend only
make dev-frontend

# TypeScript type checking
make check

# Clean build artifacts
make clean
```

### Build Order

Shared package must be built first — other workspaces depend on its types.

```bash
npm run build:shared    # 1. Build shared types
npm run build:backend   # 2. Compile backend (tsc)
npm run build:frontend  # 3. Build frontend (Vite)
```

Or all at once:

```bash
make build
```

### Production

```bash
make build
make start
# or
npm run build && npm start
```

## Database

Mailgent uses two SQLite databases (better-sqlite3 with WAL mode):

- **Global** (`~/.mailgent/global.db`) — LLM providers, API keys, routing rules, global settings
- **Project** (`<workdir>/.mailgent/project.db`) — agents, emails, tools, skills, chat history, metrics

Databases are created and migrated automatically on first run.

## API

All REST endpoints are under `/api`:

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `/api/agents` | GET, POST, PUT, DELETE | Agent management |
| `/api/emails` | GET, DELETE | Email inbox |
| `/api/tools` | GET, POST, PUT, DELETE | Tool management |
| `/api/skills` | GET, POST, PUT, DELETE | Skill management |
| `/api/groups` | GET, POST, PUT, DELETE | Agent groups |
| `/api/settings` | GET, PUT | Global & project settings |
| `/api/providers` | GET, POST, PUT, DELETE | LLM provider config |
| `/api/chat` | GET, POST | Chat with Master agent |
| `/api/metrics` | GET | Usage & performance metrics |
| `/api/project/open` | POST | Switch project at runtime |
| `/system/freeze` | POST | Pause all agent processing |
| `/system/resume` | POST | Resume agent processing |
| `/system/stop-all` | POST | Stop all running agents |

WebSocket endpoint: `/ws` — real-time events for agent activity, emails, chat streaming, metrics updates.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 22+ |
| Language | TypeScript 5.5 (strict) |
| Backend | Express 4, ws (WebSocket), tsx |
| Email | smtp-server, nodemailer, mailparser |
| Database | better-sqlite3 (SQLite, WAL mode) |
| LLM | @anthropic-ai/sdk, openai |
| Frontend | React 18, Vite 6, Tailwind CSS 3 |
| State | Zustand 5 |
| Validation | Zod 3 |
| Git | simple-git |
| Logging | pino + pino-pretty |

## License

[MIT](LICENSE) — Stanislav Chernov ([@bintocher](https://github.com/bintocher))
