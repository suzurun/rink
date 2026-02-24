import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { WorktreeConfig, ExecutionResult } from '../types';
import { logger } from '../utils/logger';

export class WorktreeManager {
  private baseDir: string;
  private worktreeDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || process.cwd();
    this.worktreeDir = path.join(this.baseDir, '..', 'worktrees');
    this.ensureWorktreeDirectory();
  }

  private ensureWorktreeDirectory(): void {
    if (!fs.existsSync(this.worktreeDir)) {
      fs.mkdirSync(this.worktreeDir, { recursive: true });
      logger.info(`Created worktree directory: ${this.worktreeDir}`);
    }
  }

  private exec(command: string, cwd?: string): string {
    try {
      return execSync(command, {
        cwd: cwd || this.baseDir,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim();
    } catch (error: any) {
      throw new Error(`Command failed: ${command}\n${error.message}`);
    }
  }

  async createWorktree(config: WorktreeConfig): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      logger.info(`Creating worktree: ${config.name}`);

      const worktreePath = path.join(this.worktreeDir, config.name);

      if (fs.existsSync(worktreePath)) {
        throw new Error(`Worktree already exists: ${worktreePath}`);
      }

      const branchExists = this.branchExists(config.branch);

      if (branchExists) {
        this.exec(`git worktree add "${worktreePath}" ${config.branch}`);
      } else {
        this.exec(`git worktree add -b ${config.branch} "${worktreePath}"`);
      }

      logger.info(`Worktree created successfully at: ${worktreePath}`);

      return {
        success: true,
        output: `Worktree '${config.name}' created at ${worktreePath}`,
        duration: Date.now() - startTime
      };
    } catch (error: any) {
      logger.error(`Failed to create worktree: ${error.message}`);
      return {
        success: false,
        output: '',
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  async listWorktrees(): Promise<WorktreeConfig[]> {
    try {
      const output = this.exec('git worktree list --porcelain');
      const worktrees: WorktreeConfig[] = [];

      const blocks = output.split('\n\n');
      for (const block of blocks) {
        const lines = block.split('\n');
        let worktreePath = '';
        let branch = '';

        for (const line of lines) {
          if (line.startsWith('worktree ')) {
            worktreePath = line.substring(9);
          } else if (line.startsWith('branch ')) {
            branch = line.substring(7).replace('refs/heads/', '');
          }
        }

        if (worktreePath && worktreePath !== this.baseDir) {
          const name = path.basename(worktreePath);
          worktrees.push({
            name,
            branch: branch || 'detached',
            path: worktreePath,
            agents: []
          });
        }
      }

      return worktrees;
    } catch (error: any) {
      logger.error(`Failed to list worktrees: ${error.message}`);
      return [];
    }
  }

  async removeWorktree(name: string, force: boolean = false): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      logger.info(`Removing worktree: ${name}`);

      const worktreePath = path.join(this.worktreeDir, name);

      if (!fs.existsSync(worktreePath)) {
        throw new Error(`Worktree not found: ${name}`);
      }

      const forceFlag = force ? '--force' : '';
      this.exec(`git worktree remove ${forceFlag} "${worktreePath}"`);

      logger.info(`Worktree removed successfully: ${name}`);

      return {
        success: true,
        output: `Worktree '${name}' removed`,
        duration: Date.now() - startTime
      };
    } catch (error: any) {
      logger.error(`Failed to remove worktree: ${error.message}`);
      return {
        success: false,
        output: '',
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  async pruneWorktrees(): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      logger.info('Pruning stale worktrees');
      const output = this.exec('git worktree prune -v');

      return {
        success: true,
        output: output || 'No stale worktrees to prune',
        duration: Date.now() - startTime
      };
    } catch (error: any) {
      logger.error(`Failed to prune worktrees: ${error.message}`);
      return {
        success: false,
        output: '',
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  private branchExists(branch: string): boolean {
    try {
      this.exec(`git rev-parse --verify ${branch}`);
      return true;
    } catch {
      return false;
    }
  }

  getWorktreePath(name: string): string {
    return path.join(this.worktreeDir, name);
  }
}

// CLI Interface
if (require.main === module) {
  const manager = new WorktreeManager();
  const command = process.argv[2];

  (async () => {
    switch (command) {
      case 'create': {
        const name = process.argv[3] || `worktree-${Date.now()}`;
        const branch = process.argv[4] || `feature/${name}`;
        const config: WorktreeConfig = {
          name,
          branch,
          path: manager.getWorktreePath(name),
          agents: []
        };
        const result = await manager.createWorktree(config);
        logger.info(result.success ? result.output : `Error: ${result.error}`);
        break;
      }

      case 'list': {
        const worktrees = await manager.listWorktrees();
        logger.info('\nActive Worktrees:');
        logger.info('='.repeat(60));
        if (worktrees.length === 0) {
          logger.info('No worktrees found');
        } else {
          worktrees.forEach((wt, index) => {
            logger.info(`${index + 1}. ${wt.name}`);
            logger.info(`   Branch: ${wt.branch}`);
            logger.info(`   Path: ${wt.path}`);
          });
        }
        break;
      }

      case 'remove': {
        const name = process.argv[3];
        if (!name) {
          logger.error('Usage: worktree:remove <name>');
          process.exit(1);
        }
        const result = await manager.removeWorktree(name);
        logger.info(result.success ? result.output : `Error: ${result.error}`);
        break;
      }

      case 'prune': {
        const result = await manager.pruneWorktrees();
        logger.info(result.success ? result.output : `Error: ${result.error}`);
        break;
      }

      default:
        logger.info('Usage:');
        logger.info('  ts-node worktree/manager.ts create [name] [branch]');
        logger.info('  ts-node worktree/manager.ts list');
        logger.info('  ts-node worktree/manager.ts remove <name>');
        logger.info('  ts-node worktree/manager.ts prune');
    }
  })();
}
