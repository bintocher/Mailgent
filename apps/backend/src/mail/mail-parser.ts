import { simpleParser, type ParsedMail } from 'mailparser';
import type { Readable } from 'stream';
import type { IncomingEmailData } from './mail-store';
import { createChildLogger } from '../utils/logger';

const log = createChildLogger('mail-parser');

export class MailParser {
  async parse(source: string | Buffer | Readable): Promise<IncomingEmailData> {
    const parsed = await simpleParser(source);
    return this.toEmailData(parsed);
  }

  private toEmailData(parsed: ParsedMail): IncomingEmailData {
    const from = parsed.from?.value?.[0]?.address || 'unknown@company.local';

    const to = parsed.to
      ? (Array.isArray(parsed.to) ? parsed.to : [parsed.to])
          .flatMap(addr => addr.value.map(v => v.address || ''))
          .filter(Boolean)
      : [];

    const cc = parsed.cc
      ? (Array.isArray(parsed.cc) ? parsed.cc : [parsed.cc])
          .flatMap(addr => addr.value.map(v => v.address || ''))
          .filter(Boolean)
      : undefined;

    const data: IncomingEmailData = {
      messageId: parsed.messageId || `${Date.now()}@company.local`,
      from,
      to,
      cc: cc?.length ? cc : undefined,
      subject: parsed.subject || '(no subject)',
      body: parsed.text || '',
      htmlBody: parsed.html || undefined,
      inReplyTo: parsed.inReplyTo,
      references: parsed.references
        ? (Array.isArray(parsed.references) ? parsed.references : [parsed.references])
        : undefined,
    };

    if (parsed.attachments?.length) {
      data.attachments = parsed.attachments.map(att => ({
        filename: att.filename || 'attachment',
        contentType: att.contentType,
        size: att.size,
        content: att.content.toString('base64'),
      }));
    }

    log.debug({ from: data.from, to: data.to, subject: data.subject }, 'Email parsed');
    return data;
  }
}
