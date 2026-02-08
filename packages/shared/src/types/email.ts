import { z } from 'zod';

export interface Email {
  id: string;
  messageId: string;
  from: string;
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  htmlBody?: string;
  threadId: string;
  inReplyTo?: string;
  references?: string[];
  attachments?: EmailAttachment[];
  priority: number;
  isRead: boolean;
  isProcessed: boolean;
  agentId?: string;
  projectId: string;
  createdAt: string;
}

export interface EmailAttachment {
  filename: string;
  contentType: string;
  size: number;
  content: string; // base64
}

export interface EmailContent {
  subject: string;
  body: string;
  htmlBody?: string;
  attachments?: EmailAttachment[];
}

export interface EmailThread {
  id: string;
  subject: string;
  participants: string[];
  emailCount: number;
  lastEmailAt: string;
  emails: Email[];
}

export interface EmailSendParams {
  from: string;
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  htmlBody?: string;
  inReplyTo?: string;
  threadId?: string;
  priority?: number;
  attachments?: EmailAttachment[];
}

export interface EmailFilter {
  agentId?: string;
  groupId?: string;
  from?: string;
  to?: string;
  threadId?: string;
  isRead?: boolean;
  isProcessed?: boolean;
  limit?: number;
  offset?: number;
}

// Zod schemas for validation

export const emailAttachmentSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1),
  size: z.number().int().nonnegative(),
  content: z.string().min(1), // base64 encoded content
});

export const emailContentSchema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1),
  htmlBody: z.string().optional(),
  attachments: z.array(emailAttachmentSchema).optional(),
});

export const emailSchema = z.object({
  id: z.string().uuid(),
  messageId: z.string().min(1),
  from: z.string().email(),
  to: z.array(z.string().email()).min(1),
  cc: z.array(z.string().email()).optional(),
  subject: z.string().min(1),
  body: z.string(),
  htmlBody: z.string().optional(),
  threadId: z.string().min(1),
  inReplyTo: z.string().optional(),
  references: z.array(z.string()).optional(),
  attachments: z.array(emailAttachmentSchema).optional(),
  priority: z.number().int().min(0),
  isRead: z.boolean(),
  isProcessed: z.boolean(),
  agentId: z.string().uuid().optional(),
  projectId: z.string().uuid(),
  createdAt: z.string().datetime(),
});

export const emailSendParamsSchema = z.object({
  from: z.string().email(),
  to: z.array(z.string().email()).min(1),
  cc: z.array(z.string().email()).optional(),
  subject: z.string().min(1),
  body: z.string().min(1),
  htmlBody: z.string().optional(),
  inReplyTo: z.string().optional(),
  threadId: z.string().optional(),
  priority: z.number().int().min(0).optional(),
  attachments: z.array(emailAttachmentSchema).optional(),
});

export const emailFilterSchema = z.object({
  agentId: z.string().uuid().optional(),
  groupId: z.string().uuid().optional(),
  from: z.string().email().optional(),
  to: z.string().email().optional(),
  threadId: z.string().optional(),
  isRead: z.boolean().optional(),
  isProcessed: z.boolean().optional(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional(),
});
