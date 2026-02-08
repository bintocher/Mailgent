import nodemailer from 'nodemailer';
import type { EmailSendParams } from '@mailgent/shared';
import { createChildLogger } from '../utils/logger';

const log = createChildLogger('mail-service');

export class MailService {
  private transporter: nodemailer.Transporter;

  constructor(smtpPort: number, smtpHost: string = 'localhost') {
    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: false,
      tls: { rejectUnauthorized: false },
    });
  }

  async sendEmail(params: EmailSendParams): Promise<string> {
    const messageId = `<${Date.now()}-${Math.random().toString(36).slice(2)}@company.local>`;

    const info = await this.transporter.sendMail({
      from: params.from,
      to: params.to.join(', '),
      cc: params.cc?.join(', '),
      subject: params.subject,
      text: params.body,
      html: params.htmlBody,
      messageId,
      inReplyTo: params.inReplyTo,
      headers: params.threadId ? { 'X-Thread-ID': params.threadId } : undefined,
    });

    log.info({ messageId: info.messageId, from: params.from, to: params.to }, 'Email sent');
    return messageId;
  }

  async verify(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch {
      return false;
    }
  }
}
