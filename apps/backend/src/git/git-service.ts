import simpleGit, { type SimpleGit } from 'simple-git';
import { createChildLogger } from '../utils/logger';

const log = createChildLogger('git-service');

export class GitService {
  private git: SimpleGit;

  constructor(workDir: string) {
    this.git = simpleGit(workDir);
  }

  setWorkDir(workDir: string): void {
    this.git = simpleGit(workDir);
  }

  async init(): Promise<void> {
    const isRepo = await this.git.checkIsRepo();
    if (!isRepo) {
      await this.git.init();
      log.info('Git repository initialized');
    }
  }

  async status() {
    return this.git.status();
  }

  async diff(staged = false) {
    return staged ? this.git.diff(['--staged']) : this.git.diff();
  }

  async log(count = 10) {
    return this.git.log({ maxCount: count });
  }

  async add(files: string | string[]) {
    return this.git.add(files);
  }

  async commit(message: string) {
    return this.git.commit(message);
  }

  async stageAndCommit(files: string[], message: string) {
    await this.git.add(files);
    return this.git.commit(message);
  }

  async isRepo(): Promise<boolean> {
    return this.git.checkIsRepo();
  }
}
