import { SMTPServer } from 'smtp-server';
import { simpleParser } from 'mailparser';
import type { EventBus } from '../utils/event-bus';
import { createChildLogger } from '../utils/logger';

const log = createChildLogger('mail-server');

export class MailServer {
  private server: SMTPServer;
  private isRunning = false;

  constructor(
    private port: number,
    private eventBus: EventBus,
  ) {
    this.server = new SMTPServer({
      disabledCommands: ['AUTH', 'STARTTLS'],
      allowInsecureAuth: true,
      onConnect: (session, callback) => {
        log.debug({ remoteAddress: session.remoteAddress }, 'SMTP connection');
        callback();
      },
      onMailFrom: (address, session, callback) => {
        log.debug({ from: address.address }, 'MAIL FROM');
        callback();
      },
      onRcptTo: (address, session, callback) => {
        log.debug({ to: address.address }, 'RCPT TO');
        callback();
      },
      onData: (stream, session, callback) => {
        simpleParser(stream)
          .then((parsed) => {
            const from = typeof parsed.from?.value?.[0]?.address === 'string'
              ? parsed.from.value[0].address
              : 'unknown@company.local';

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

            const emailData = {
              messageId: parsed.messageId || `${Date.now()}@company.local`,
              from,
              to,
              cc,
              subject: parsed.subject || '(no subject)',
              body: parsed.text || '',
              htmlBody: parsed.html || undefined,
              inReplyTo: parsed.inReplyTo,
              references: parsed.references
                ? (Array.isArray(parsed.references) ? parsed.references : [parsed.references])
                : undefined,
              attachments: parsed.attachments?.map(att => ({
                filename: att.filename || 'attachment',
                contentType: att.contentType,
                size: att.size,
                content: att.content.toString('base64'),
              })),
            };

            log.info({ from: emailData.from, to: emailData.to, subject: emailData.subject }, 'Email received');
            this.eventBus.emit('email:received', emailData);
            callback();
          })
          .catch((err) => {
            log.error({ error: err }, 'Failed to parse email');
            callback(new Error('Failed to parse email'));
          });
      },
    });

    this.server.on('error', (err) => {
      log.error({ error: err }, 'SMTP server error');
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.listen(this.port, () => {
        this.isRunning = true;
        log.info({ port: this.port }, 'SMTP server started');
        resolve();
      });
      this.server.on('error', reject);
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.isRunning) {
        resolve();
        return;
      }
      this.server.close(() => {
        this.isRunning = false;
        log.info('SMTP server stopped');
        resolve();
      });
    });
  }

  getStatus(): boolean {
    return this.isRunning;
  }
}
