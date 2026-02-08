// System agent emails
export const SYSTEM_AGENTS = {
  MASTER: { name: 'Master', email: 'master@company.local' },
  DISPATCHER: { name: 'Dispatcher', email: 'dispatcher@company.local' },
  ROLE_GENERATOR: { name: 'Role Generator', email: 'roles@company.local' },
  TOOL_CREATOR: { name: 'Tool Creator', email: 'tools@company.local' },
  PROMPT_CREATOR: { name: 'Prompt Creator', email: 'prompts@company.local' },
  CONTEXT_COMPRESSOR: { name: 'Context Compressor', email: 'compressor@company.local' },
  SKILL_WRITER: { name: 'Skill Writer', email: 'skills@company.local' },
  LLM_SELECTOR: { name: 'LLM Selector', email: 'llm-selector@company.local' },
} as const;

// Default departments
export const DEFAULT_DEPARTMENTS = {
  DEVELOPMENT: {
    name: 'Development',
    email: 'dev-team@company.local',
    specializations: ['typescript', 'react', 'python', 'golang', 'rust', 'web-design', 'html', 'css'],
  },
  DEVOPS: {
    name: 'DevOps',
    email: 'devops@company.local',
    specializations: ['terminal', 'server-management', 'ci-cd', 'docker', 'kubernetes'],
  },
  QA: {
    name: 'QA',
    email: 'qa@company.local',
    specializations: ['testing', 'code-review', 'quality-assurance'],
  },
  ARCHITECTURE: {
    name: 'Architecture',
    email: 'architecture@company.local',
    specializations: ['system-design', 'planning', 'architecture'],
  },
} as const;

// Limits
export const LIMITS = {
  MAX_EMAIL_BODY_SIZE: 1024 * 1024, // 1MB
  MAX_ATTACHMENT_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_TOOL_EXECUTION_TIME: 30000, // 30s
  MAX_AGENT_THINK_ITERATIONS: 20,
  MAX_THREAD_DEPTH: 10,
  MAX_SUB_AGENTS: 10,
  DEFAULT_RATE_LIMIT_RPM: 60,
  DEFAULT_RATE_LIMIT_TPM: 100000,
  QUEUE_MAX_RETRIES: 3,
  QUEUE_RETRY_DELAY_MS: 5000,
  QUEUE_MAX_CONCURRENT: 5,
  QUEUE_PROCESSING_TIMEOUT_MS: 300000, // 5min
  WS_HEARTBEAT_INTERVAL_MS: 30000,
} as const;

// Email domain
export const DEFAULT_DOMAIN = 'company.local';

// API paths
export const API_PREFIX = '/api';
