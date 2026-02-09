import { z } from 'zod';
import { emailAttachmentSchema } from './types/email';

export const agentCreateSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  type: z.enum(['system', 'worker', 'lead']),
  systemPrompt: z.string().min(1),
  description: z.string(),
  groupId: z.string().optional(),
  parentAgentId: z.string().optional(),
  modelId: z.string().optional(),
  providerId: z.string().optional(),
  toolIds: z.array(z.string()).optional(),
  skillIds: z.array(z.string()).optional(),
  maxConcurrentTasks: z.number().int().min(1).max(10).optional(),
});

export const groupCreateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string(),
  email: z.string().email(),
  leadAgentId: z.string().optional(),
  specializations: z.array(z.string()).optional(),
  maxMembers: z.number().int().min(1).max(50).optional(),
});

export const emailSendSchema = z.object({
  from: z.string().email(),
  to: z.array(z.string().email()).min(1),
  cc: z.array(z.string().email()).optional(),
  subject: z.string().min(1).max(500),
  body: z.string().min(1),
  htmlBody: z.string().optional(),
  inReplyTo: z.string().optional(),
  threadId: z.string().optional(),
  priority: z.number().int().min(0).max(100).optional(),
  attachments: z.array(emailAttachmentSchema).min(1, 'If provided, attachments must be a non-empty array').optional(),
});

export const toolCreateSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-z_][a-z0-9_]*$/),
  description: z.string().min(1),
  category: z.enum(['filesystem', 'system', 'git', 'communication', 'orchestration', 'meta']),
  parameters: z.array(z.object({
    name: z.string(),
    type: z.enum(['string', 'number', 'boolean', 'array', 'object']),
    description: z.string(),
    required: z.boolean(),
    default: z.unknown().optional(),
    enum: z.array(z.string()).optional(),
  })),
  code: z.string().optional(),
});

export const skillCreateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1),
  triggerPattern: z.string().optional(),
  instructions: z.string().min(1),
  requiredToolIds: z.array(z.string()).optional(),
});

export const providerCreateSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['openai', 'anthropic', 'openai-compatible', 'z.ai']),
  apiKey: z.string().min(1),
  baseUrl: z.string().url().optional().or(z.literal('')),
  models: z.array(z.object({
    id: z.string(),
    displayName: z.string(),
    contextWindow: z.number().int().positive(),
    costPerInputToken: z.number().min(0),
    costPerOutputToken: z.number().min(0),
    capabilities: z.array(z.string()),
    isEnabled: z.boolean().optional(),
  })).optional(),
  rateLimits: z.object({
    requestsPerMinute: z.number().int().positive(),
    tokensPerMinute: z.number().int().positive(),
  }).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const providerUpdateSchema = providerCreateSchema.partial();

export const chatSendSchema = z.object({
  sessionId: z.string().optional(),
  content: z.string().min(1),
});

export const projectSettingsSchema = z.object({
  companyName: z.string().min(1).max(100).optional(),
  domain: z.string().min(1).optional(),
  maxAgents: z.number().int().min(1).max(100).optional(),
  maxEmailsPerMinute: z.number().int().min(1).optional(),
  maxEmailDepth: z.number().int().min(1).optional(),
  gitEnabled: z.boolean().optional(),
  gitAutoCommit: z.boolean().optional(),
  defaultModelId: z.string().optional(),
  defaultProviderId: z.string().optional(),
  shellTimeout: z.number().int().min(1000).optional(),
  shellDenyList: z.array(z.string()).optional(),
  enableReviewer: z.boolean().optional(),
});

export const globalSettingsSchema = z.object({
  smtpPort: z.number().int().min(1).max(65535).optional(),
  uiTheme: z.enum(['light', 'dark', 'system']).optional(),
  logLevel: z.enum(['trace', 'debug', 'info', 'warn', 'error']).optional(),
});
