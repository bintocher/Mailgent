import { PathGuard } from '../utils/path-guard';
import { createChildLogger } from '../utils/logger';

const log = createChildLogger('agent-sandbox');

const COMMAND_DENYLIST = [
  'rm -rf /',
  'rm -rf /*',
  'mkfs',
  'dd if=',
  ':(){:|:&};:',
  'chmod -R 777 /',
  '> /dev/sda',
  'mv / ',
  'wget|sh',
  'curl|sh',
];

export class AgentSandbox {
  private pathGuard: PathGuard;
  private denyList: string[];

  constructor(workDir: string, additionalDenyList: string[] = []) {
    this.pathGuard = new PathGuard(workDir);
    this.denyList = [...COMMAND_DENYLIST, ...additionalDenyList];
  }

  validatePath(filePath: string): string {
    return this.pathGuard.validate(filePath);
  }

  isPathAllowed(filePath: string): boolean {
    return this.pathGuard.isAllowed(filePath);
  }

  validateCommand(command: string): void {
    const normalized = command.toLowerCase().trim();
    for (const denied of this.denyList) {
      if (normalized.includes(denied.toLowerCase())) {
        log.warn({ command, denied }, 'Blocked dangerous command');
        throw new Error(`Command blocked: contains forbidden pattern "${denied}"`);
      }
    }
  }

  setWorkDir(workDir: string): void {
    this.pathGuard.setRoot(workDir);
  }

  getWorkDir(): string {
    return this.pathGuard.getRoot();
  }
}
