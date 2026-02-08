import path from 'path';
import { createChildLogger } from './logger';

const log = createChildLogger('path-guard');

export class PathGuard {
  private allowedRoot: string;

  constructor(workDir: string) {
    this.allowedRoot = path.resolve(workDir);
  }

  validate(filePath: string): string {
    const resolved = path.resolve(this.allowedRoot, filePath);
    if (!resolved.startsWith(this.allowedRoot + path.sep) && resolved !== this.allowedRoot) {
      log.warn({ filePath, resolved, allowedRoot: this.allowedRoot }, 'Path escape attempt blocked');
      throw new Error(`Access denied: path "${filePath}" is outside the working directory`);
    }
    return resolved;
  }

  isAllowed(filePath: string): boolean {
    try {
      this.validate(filePath);
      return true;
    } catch {
      return false;
    }
  }

  setRoot(workDir: string): void {
    this.allowedRoot = path.resolve(workDir);
  }

  getRoot(): string {
    return this.allowedRoot;
  }

  resolve(filePath: string): string {
    return this.validate(filePath);
  }
}
