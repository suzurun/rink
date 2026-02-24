import { execSync } from 'child_process';
import { TmuxSession, ExecutionResult } from '../types';
import { logger } from '../utils/logger';

export class TmuxSessionManager {
  private exec(command: string): string {
    try {
      return execSync(command, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim();
    } catch (error: any) {
      if (error.status === 1 && command.includes('tmux has-session')) {
        return '';
      }
      throw new Error(`Command failed: ${command}\n${error.message}`);
    }
  }

  private isTmuxAvailable(): boolean {
    try {
      this.exec('tmux -V');
      return true;
    } catch {
      return false;
    }
  }

  async createSession(name: string, worktreePath?: string): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      if (!this.isTmuxAvailable()) {
        throw new Error('tmux is not installed or not available');
      }

      logger.info(`Creating tmux session: ${name}`);

      if (this.sessionExists(name)) {
        throw new Error(`Session already exists: ${name}`);
      }

      const workDir = worktreePath || process.cwd();

      this.exec(`tmux new-session -d -s "${name}" -c "${workDir}"`);

      this.exec(`tmux rename-window -t "${name}:0" "main"`);

      this.exec(`tmux new-window -t "${name}" -n "agent-1"`);
      this.exec(`tmux new-window -t "${name}" -n "agent-2"`);
      this.exec(`tmux new-window -t "${name}" -n "logs"`);

      logger.info(`Tmux session '${name}' created successfully`);

      return {
        success: true,
        output: `Tmux session '${name}' created with 4 windows`,
        duration: Date.now() - startTime
      };
    } catch (error: any) {
      logger.error(`Failed to create tmux session: ${error.message}`);
      return {
        success: false,
        output: '',
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  async listSessions(): Promise<TmuxSession[]> {
    try {
      if (!this.isTmuxAvailable()) {
        logger.warn('tmux is not available');
        return [];
      }

      const output = this.exec('tmux list-sessions -F "#{session_name}:#{session_created}:#{session_attached}"');

      if (!output) {
        return [];
      }

      const sessions: TmuxSession[] = [];
      const lines = output.split('\n');

      for (const line of lines) {
        const [name, created, attached] = line.split(':');
        sessions.push({
          id: created,
          name,
          agents: [],
          status: attached === '1' ? 'active' : 'inactive'
        });
      }

      return sessions;
    } catch (error: any) {
      logger.error(`Failed to list tmux sessions: ${error.message}`);
      return [];
    }
  }

  async attachSession(name: string): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      if (!this.sessionExists(name)) {
        throw new Error(`Session not found: ${name}`);
      }

      logger.info(`Attaching to tmux session: ${name}`);

      logger.info(`Run this command to attach: tmux attach-session -t "${name}"`);

      return {
        success: true,
        output: `Ready to attach to session '${name}'`,
        duration: Date.now() - startTime
      };
    } catch (error: any) {
      logger.error(`Failed to attach to session: ${error.message}`);
      return {
        success: false,
        output: '',
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  async killSession(name: string): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      if (!this.sessionExists(name)) {
        throw new Error(`Session not found: ${name}`);
      }

      logger.info(`Killing tmux session: ${name}`);

      this.exec(`tmux kill-session -t "${name}"`);

      logger.info(`Tmux session '${name}' killed successfully`);

      return {
        success: true,
        output: `Tmux session '${name}' killed`,
        duration: Date.now() - startTime
      };
    } catch (error: any) {
      logger.error(`Failed to kill session: ${error.message}`);
      return {
        success: false,
        output: '',
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  async sendCommand(sessionName: string, windowName: string, command: string): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      if (!this.sessionExists(sessionName)) {
        throw new Error(`Session not found: ${sessionName}`);
      }

      const target = `${sessionName}:${windowName}`;
      this.exec(`tmux send-keys -t "${target}" "${command.replace(/"/g, '\\"')}" C-m`);

      return {
        success: true,
        output: `Command sent to ${target}`,
        duration: Date.now() - startTime
      };
    } catch (error: any) {
      logger.error(`Failed to send command: ${error.message}`);
      return {
        success: false,
        output: '',
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  private sessionExists(name: string): boolean {
    try {
      this.exec(`tmux has-session -t "${name}"`);
      return true;
    } catch {
      return false;
    }
  }
}

// CLI Interface
if (require.main === module) {
  const manager = new TmuxSessionManager();
  const command = process.argv[2];

  (async () => {
    switch (command) {
      case 'create': {
        const name = process.argv[3] || `tmux-session-${Date.now()}`;
        const worktreePath = process.argv[4];
        const result = await manager.createSession(name, worktreePath);
        logger.info(result.success ? result.output : `Error: ${result.error}`);
        if (result.success) {
          logger.info(`\nTo attach: tmux attach-session -t "${name}"`);
        }
        break;
      }

      case 'list': {
        const sessions = await manager.listSessions();
        logger.info('\nActive Tmux Sessions:');
        logger.info('='.repeat(60));
        if (sessions.length === 0) {
          logger.info('No tmux sessions found');
        } else {
          sessions.forEach((session, index) => {
            logger.info(`${index + 1}. ${session.name} (${session.status})`);
          });
        }
        break;
      }

      case 'attach': {
        const name = process.argv[3];
        if (!name) {
          logger.error('Usage: tmux:attach <session-name>');
          process.exit(1);
        }
        const result = await manager.attachSession(name);
        logger.info(result.success ? result.output : `Error: ${result.error}`);
        break;
      }

      case 'kill': {
        const name = process.argv[3];
        if (!name) {
          logger.error('Usage: tmux:kill <session-name>');
          process.exit(1);
        }
        const result = await manager.killSession(name);
        logger.info(result.success ? result.output : `Error: ${result.error}`);
        break;
      }

      case 'send': {
        const sessionName = process.argv[3];
        const windowName = process.argv[4];
        const cmd = process.argv.slice(5).join(' ');
        if (!sessionName || !windowName || !cmd) {
          logger.error('Usage: tmux:send <session> <window> <command>');
          process.exit(1);
        }
        const result = await manager.sendCommand(sessionName, windowName, cmd);
        logger.info(result.success ? result.output : `Error: ${result.error}`);
        break;
      }

      default:
        logger.info('Usage:');
        logger.info('  ts-node tmux/session-manager.ts create [name] [worktree-path]');
        logger.info('  ts-node tmux/session-manager.ts list');
        logger.info('  ts-node tmux/session-manager.ts attach <session-name>');
        logger.info('  ts-node tmux/session-manager.ts kill <session-name>');
        logger.info('  ts-node tmux/session-manager.ts send <session> <window> <command>');
    }
  })();
}
