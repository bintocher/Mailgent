import type { LLMProviderConfig } from './llm';

export interface GlobalSettings {
  providers: LLMProviderConfig[];
  smtpPort: number;
  uiTheme: 'light' | 'dark' | 'system';
  logLevel: 'trace' | 'debug' | 'info' | 'warn' | 'error';
}

export interface ProjectSettings {
  projectId: string;
  workDir: string;
  companyName: string;
  domain: string; // "company.local"
  maxAgents: number;
  maxEmailsPerMinute: number;
  maxEmailDepth: number; // loop detection
  gitEnabled: boolean;
  gitAutoCommit: boolean;
  defaultModelId?: string;
  defaultProviderId?: string;
  shellTimeout: number; // ms
  shellDenyList: string[];
  enableReviewer?: boolean;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_PROJECT_SETTINGS: Omit<ProjectSettings, 'projectId' | 'workDir' | 'createdAt' | 'updatedAt'> = {
  companyName: 'Mailgent Corp',
  domain: 'company.local',
  maxAgents: 20,
  maxEmailsPerMinute: 60,
  maxEmailDepth: 10,
  gitEnabled: true,
  gitAutoCommit: false,
  shellTimeout: 30000,
  shellDenyList: ['rm -rf /', 'mkfs', 'dd if=', ':(){:|:&};:'],
  enableReviewer: false,
};

export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  providers: [],
  smtpPort: 2525,
  uiTheme: 'system',
  logLevel: 'info',
};
