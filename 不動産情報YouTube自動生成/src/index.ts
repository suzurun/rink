import { AIT42Coordinator } from './ait42/coordinator';
import { WorktreeManager } from './worktree/manager';
import { TmuxSessionManager } from './tmux/session-manager';
import { logger } from './utils/logger';
import { WorktreeConfig } from './types';

export class IntegratedSystem {
  private coordinator: AIT42Coordinator;
  private worktreeManager: WorktreeManager;
  private tmuxManager: TmuxSessionManager;

  constructor() {
    this.coordinator = new AIT42Coordinator();
    this.worktreeManager = new WorktreeManager();
    this.tmuxManager = new TmuxSessionManager();
  }

  async executeTaskWithIsolation(taskDescription: string): Promise<void> {
    logger.info('='.repeat(70));
    logger.info('INTEGRATED EXECUTION: AIT42 + Worktree + TMUX');
    logger.info('='.repeat(70));

    const task = this.coordinator.analyzeTask(taskDescription);
    logger.info(`\nTask: ${task.description}`);
    logger.info(`Complexity: ${task.complexity} | Requirements: ${task.requirements.join(', ')}`);

    const agentSelections = this.coordinator.selectAgents(task);
    logger.info(`\nSelected ${agentSelections.length} agents:`);
    agentSelections.forEach((sel, idx) => {
      logger.info(`  ${idx + 1}. ${sel.agent.name} (score: ${sel.score})`);
    });

    const worktreeName = `task-${Date.now()}`;
    const branchName = `feature/${worktreeName}`;

    logger.info(`\nCreating isolated worktree: ${worktreeName}`);
    const worktreeConfig: WorktreeConfig = {
      name: worktreeName,
      branch: branchName,
      path: this.worktreeManager.getWorktreePath(worktreeName),
      agents: agentSelections.map(s => s.agent.id)
    };

    const worktreeResult = await this.worktreeManager.createWorktree(worktreeConfig);
    if (!worktreeResult.success) {
      logger.error(`Failed to create worktree: ${worktreeResult.error}`);
      return;
    }

    logger.info(worktreeResult.output);

    logger.info(`\nCreating tmux session: ${worktreeName}`);
    const tmuxResult = await this.tmuxManager.createSession(worktreeName, worktreeConfig.path);
    if (!tmuxResult.success) {
      logger.error(`Failed to create tmux session: ${tmuxResult.error}`);
      return;
    }

    logger.info(tmuxResult.output);

    logger.info('\n' + '='.repeat(70));
    logger.info('SETUP COMPLETE - Ready for parallel agent execution');
    logger.info('='.repeat(70));
    logger.info(`\nWorktree: ${worktreeConfig.path}`);
    logger.info(`Branch: ${branchName}`);
    logger.info(`Tmux session: ${worktreeName}`);
    logger.info(`\nTo attach to the tmux session, run:`);
    logger.info(`  tmux attach-session -t "${worktreeName}"`);
    logger.info('\nWindows:');
    logger.info('  0: main     - Main workspace');
    logger.info('  1: agent-1  - First agent execution');
    logger.info('  2: agent-2  - Second agent execution');
    logger.info('  3: logs     - Log monitoring');
  }

  async cleanup(sessionName: string, worktreeName: string): Promise<void> {
    logger.info('\nCleaning up resources...');

    const tmuxResult = await this.tmuxManager.killSession(sessionName);
    if (tmuxResult.success) {
      logger.info(`Tmux session killed: ${sessionName}`);
    }

    const worktreeResult = await this.worktreeManager.removeWorktree(worktreeName);
    if (worktreeResult.success) {
      logger.info(`Worktree removed: ${worktreeName}`);
    }

    logger.info('Cleanup complete');
  }

  async status(): Promise<void> {
    logger.info('\n=== SYSTEM STATUS ===\n');

    logger.info('Active Worktrees:');
    const worktrees = await this.worktreeManager.listWorktrees();
    if (worktrees.length === 0) {
      logger.info('  (none)');
    } else {
      worktrees.forEach(wt => {
        logger.info(`  - ${wt.name} (${wt.branch}) at ${wt.path}`);
      });
    }

    logger.info('\nActive Tmux Sessions:');
    const sessions = await this.tmuxManager.listSessions();
    if (sessions.length === 0) {
      logger.info('  (none)');
    } else {
      sessions.forEach(session => {
        logger.info(`  - ${session.name} (${session.status})`);
      });
    }
  }
}

// CLI Interface
if (require.main === module) {
  const system = new IntegratedSystem();
  const command = process.argv[2];

  (async () => {
    switch (command) {
      case 'execute': {
        const taskDescription = process.argv.slice(3).join(' ') ||
          'Design and implement a RESTful API for real estate property management with authentication and database integration';
        await system.executeTaskWithIsolation(taskDescription);
        break;
      }

      case 'status': {
        await system.status();
        break;
      }

      case 'cleanup': {
        const sessionName = process.argv[3];
        const worktreeName = process.argv[4];
        if (!sessionName || !worktreeName) {
          logger.error('Usage: cleanup <session-name> <worktree-name>');
          process.exit(1);
        }
        await system.cleanup(sessionName, worktreeName);
        break;
      }

      default:
        logger.info('AIT42 + Worktree + TMUX Integrated System');
        logger.info('\nUsage:');
        logger.info('  npm run dev execute [task-description]');
        logger.info('  npm run dev status');
        logger.info('  npm run dev cleanup <session-name> <worktree-name>');
        logger.info('\nExamples:');
        logger.info('  npm run dev execute "Build a user authentication API"');
        logger.info('  npm run dev status');
    }
  })();
}

export { AIT42Coordinator, WorktreeManager, TmuxSessionManager };
