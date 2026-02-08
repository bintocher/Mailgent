import { v4 as uuid } from 'uuid';
import type { Email } from '@mailgent/shared';
import type { EmailRepository } from '../db/repositories/email.repo';
import { createChildLogger } from '../utils/logger';

const log = createChildLogger('mail-store');

export interface IncomingEmailData {
  messageId: string;
  from: string;
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  htmlBody?: string;
  inReplyTo?: string;
  references?: string[];
  attachments?: Array<{
    filename: string;
    contentType: string;
    size: number;
    content: string;
  }>;
}

export class MailStore {
  constructor(
    private emailRepo: EmailRepository,
    private projectId: string,
  ) {}

  store(data: IncomingEmailData): Email {
    const threadId = this.resolveThreadId(data);

    const email: Email = {
      id: uuid(),
      messageId: data.messageId,
      from: data.from,
      to: data.to,
      cc: data.cc,
      subject: data.subject,
      body: data.body,
      htmlBody: data.htmlBody,
      threadId,
      inReplyTo: data.inReplyTo,
      references: data.references,
      attachments: data.attachments,
      priority: 0,
      isRead: false,
      isProcessed: false,
      projectId: this.projectId,
      createdAt: new Date().toISOString(),
    };

    this.emailRepo.storeIncoming(email);
    log.info({ id: email.id, from: email.from, subject: email.subject }, 'Email stored');
    return email;
  }

  private resolveThreadId(data: IncomingEmailData): string {
    if (data.inReplyTo) {
      const parentEmail = this.emailRepo.findByMessageId(data.inReplyTo);
      if (parentEmail) {
        return parentEmail.threadId;
      }
    }
    return uuid();
  }
}
