import path from 'path';
import os from 'os';

export interface AppConfig {
  port: number;
  smtpPort: number;
  host: string;
  workDir: string;
  mailgentHome: string;
  globalDbPath: string;
  projectDbPath: string;
  logLevel: string;
  nodeEnv: string;
}

function expandTilde(p: string): string {
  if (p.startsWith('~/') || p === '~') {
    return path.join(os.homedir(), p.slice(1));
  }
  return p;
}

export function loadConfig(cliWorkDir?: string): AppConfig {
  // workDir can be empty string — means "not selected yet, user will pick via UI"
  const rawWorkDir = cliWorkDir || process.env.WORKDIR || '';
  const workDir = rawWorkDir ? path.resolve(expandTilde(rawWorkDir)) : '';
  const mailgentHome = process.env.MAILGENT_HOME
    ? path.resolve(expandTilde(process.env.MAILGENT_HOME))
    : path.join(os.homedir(), '.mailgent');

  return {
    port: parseInt(process.env.PORT || '3000', 10),
    smtpPort: parseInt(process.env.SMTP_PORT || '2525', 10),
    host: process.env.HOST || 'localhost',
    workDir,
    mailgentHome,
    globalDbPath: path.join(mailgentHome, 'global.db'),
    projectDbPath: workDir ? path.join(workDir, '.mailgent', 'project.db') : '',
    logLevel: process.env.LOG_LEVEL || 'info',
    nodeEnv: process.env.NODE_ENV || 'development',
  };
}
