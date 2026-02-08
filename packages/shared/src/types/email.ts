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

export interface EmailThread {
  id: string;
  subject: string;
  participants: string[];
  emailCount: number;
  lastEmailAt: string;
  emails: Email[];
}

export interface EmailContent {
  subject: string;
  text?: string; // plain text body
  html?: string; // HTML body
}

export interface EmailSendParams {
  from: string;
  to: string[];
  cc?: string[];
  subject: string;
  body?: string;
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

// Zod validation schemas

// Email attachment schema
export const emailAttachmentSchema = z.object({
  filename: z.string().min(1, 'Filename is required'),
  contentType: z.string().min(1, 'Content type is required'),
  size: z.number().int().nonnegative('Size must be a non-negative integer'),
  content: z.string().min(1, 'Content is required'),
});

// Email content schema
export const emailContentSchema = z.object({
  subject: z.string().min(1, 'Subject is required'),
  text: z.string().optional(),
  html: z.string().optional(),
}).refine(
  (data) => data.text !== undefined || data.html !== undefined,
  { message: 'At least one of text or html must be provided' }
);

// Email schema with nested attachment schema
export const emailSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  messageId: z.string().min(1, 'Message ID is required'),
  from: z.string().email('From must be a valid email address'),
  to: z.array(z.string().email('Each "to" address must be a valid email')).min(1, 'At least one "to" recipient is required'),
  cc: z.array(z.string().email('Each CC address must be a valid email')).optional(),
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Body is required'),
  htmlBody: z.string().optional(),
  threadId: z.string().min(1, 'Thread ID is required'),
  inReplyTo: z.string().optional(),
  references: z.array(z.string()).optional(),
  attachments: z.array(emailAttachmentSchema).optional(),
  priority: z.number().int('Priority must be an integer'),
  isRead: z.boolean(),
  isProcessed: z.boolean(),
  agentId: z.string().optional(),
  projectId: z.string().min(1, 'Project ID is required'),
  createdAt: z.string().min(1, 'Created at is required'),
});

// Email thread schema
export const emailThreadSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  subject: z.string().min(1, 'Subject is required'),
  participants: z.array(z.string().email('Each participant must be a valid email')).min(1, 'At least one participant is required'),
  emailCount: z.number().int().nonnegative('Email count must be a non-negative integer'),
  lastEmailAt: z.string().min(1, 'Last email at is required'),
  emails: z.array(emailSchema),
});

// Email send params schema
export const emailSendParamsSchema = z.object({
  from: z.string().email('From must be a valid email address'),
  to: z.array(z.string().email('Each "to" address must be a valid email')).min(1, 'At least one "to" recipient is required'),
  cc: z.array(z.string().email('Each CC address must be a valid email')).optional(),
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().optional(),
  htmlBody: z.string().optional(),
  inReplyTo: z.string().optional(),
  threadId: z.string().optional(),
  priority: z.number().int('Priority must be an integer').optional(),
  attachments: z.array(emailAttachmentSchema).optional(),
}).refine(
  (data) => data.body !== undefined || data.htmlBody !== undefined,
  { message: 'At least one of body or htmlBody must be provided' }
);

// Email filter schema
export const emailFilterSchema = z.object({
  agentId: z.string().optional(),
  groupId: z.string().optional(),
  from: z.string().email('From must be a valid email address').optional(),
  to: z.string().email('To must be a valid email address').optional(),
  threadId: z.string().optional(),
  isRead: z.boolean().optional(),
  isProcessed: z.boolean().optional(),
  limit: z.number().int().positive('Limit must be a positive integer').optional(),
  offset: z.number().int().nonnegative('Offset must be a non-negative integer').optional(),
});

// Inferred types from schemas
export type EmailAttachmentSchema = z.infer<typeof emailAttachmentSchema>;
export type EmailContentSchema = z.infer<typeof emailContentSchema>;
export type EmailSchema = z.infer<typeof emailSchema>;
export type EmailThreadSchema = z.infer<typeof emailThreadSchema>;
export type EmailSendParamsSchema = z.infer<typeof emailSendParamsSchema>;
export type EmailFilterSchema = z.infer<typeof emailFilterSchema>;
