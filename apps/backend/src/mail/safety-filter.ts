import type { Email } from '@mailgent/shared';
import type { EmailRepository } from '../db/repositories/email.repo';
import type { EventBus } from '../utils/event-bus';
import { createChildLogger } from '../utils/logger';

const log = createChildLogger('safety-filter');

export type SafetyWarningType = 'prompt_injection' | 'debate_loop';
export type SafetyWarningSeverity = 'high' | 'medium';

export interface SafetyWarning {
  type: SafetyWarningType;
  severity: SafetyWarningSeverity;
  message: string;
  details?: string;
}

export interface SafetyFilterResult {
  passed: boolean;
  warnings: SafetyWarning[];
}

interface InjectionPattern {
  pattern: RegExp;
  severity: SafetyWarningSeverity;
  description: string;
}

const INJECTION_PATTERNS: InjectionPattern[] = [
  { pattern: /ignore\s+(all\s+)?previous\s+instructions/i, severity: 'high', description: 'Attempt to override previous instructions' },
  { pattern: /you\s+are\s+now\s+a/i, severity: 'high', description: 'Attempt to reassign agent identity' },
  { pattern: /system:\s*you\s+are/i, severity: 'high', description: 'Fake system message injection' },
  { pattern: /\[INST\]|\[\/INST\]|<\|im_start\|>|<\|im_end\|>|<\|system\|>/i, severity: 'high', description: 'Chat template token injection' },
  { pattern: /disregard\s+(your\s+)?previous/i, severity: 'medium', description: 'Attempt to disregard previous context' },
  { pattern: /pretend\s+you\s+are\s+not/i, severity: 'medium', description: 'Attempt to alter agent self-perception' },
  { pattern: /do\s+not\s+follow\s+your\s+rules/i, severity: 'medium', description: 'Attempt to disable agent rules' },
  { pattern: /IMPORTANT:\s*override/i, severity: 'medium', description: 'Fake override directive' },
];

const DEBATE_LOOP_THRESHOLD = 3;

export class SafetyFilter {
  constructor(
    private emailRepo: EmailRepository,
    private eventBus: EventBus,
  ) {}

  check(email: Email): SafetyFilterResult {
    const warnings: SafetyWarning[] = [];

    // 1. Prompt injection detection
    const textToCheck = `${email.subject} ${email.body}`;
    for (const { pattern, severity, description } of INJECTION_PATTERNS) {
      if (pattern.test(textToCheck)) {
        warnings.push({
          type: 'prompt_injection',
          severity,
          message: description,
          details: `Matched in email from ${email.from}: "${email.subject}"`,
        });
      }
    }

    // 2. Debate loop detection — count exchanges between sender-recipient pairs
    if (email.threadId) {
      const threadEmails = this.emailRepo.findByThreadId(email.threadId);
      const pairCounts = new Map<string, number>();

      for (const e of threadEmails) {
        for (const to of e.to) {
          // Normalize pair key (sorted to count both directions)
          const pair = [e.from, to].sort().join('<->');
          pairCounts.set(pair, (pairCounts.get(pair) || 0) + 1);
        }
      }

      for (const [pair, count] of pairCounts) {
        if (count >= DEBATE_LOOP_THRESHOLD) {
          warnings.push({
            type: 'debate_loop',
            severity: 'medium',
            message: `Potential debate loop detected: ${pair} exchanged ${count} messages in thread`,
            details: `Thread: ${email.threadId}, Subject: "${email.subject}"`,
          });
        }
      }
    }

    // Log warnings
    for (const warning of warnings) {
      log.warn({ type: warning.type, severity: warning.severity, emailId: email.id }, warning.message);
    }

    // Currently non-blocking — all emails pass
    // To enable blocking for high-severity: passed = !warnings.some(w => w.severity === 'high')
    return { passed: true, warnings };
  }
}
