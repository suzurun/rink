import { Agent, Task, AgentSelection } from '../types';
import { AGENTS_REGISTRY, findAgentsByCapability } from './agents-registry';
import { logger } from '../utils/logger';

export class AIT42Coordinator {
  private agents: Agent[];

  constructor() {
    this.agents = AGENTS_REGISTRY;
    logger.info('AIT42 Coordinator initialized with ' + this.agents.length + ' agents');
  }

  analyzeTask(taskDescription: string): Task {
    const complexity = this.assessComplexity(taskDescription);
    const requirements = this.extractRequirements(taskDescription);
    const estimatedAgents = this.estimateAgentCount(complexity, requirements);

    return {
      id: Date.now().toString(),
      description: taskDescription,
      requirements,
      complexity,
      estimatedAgents
    };
  }

  selectAgents(task: Task, maxAgents: number = 3): AgentSelection[] {
    logger.info(`Selecting agents for task: ${task.description}`);

    const candidates: AgentSelection[] = [];

    for (const agent of this.agents) {
      const score = this.calculateAgentScore(agent, task);
      if (score > 0) {
        candidates.push({
          agent,
          reason: this.generateSelectionReason(agent, task),
          score
        });
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    const selected = candidates.slice(0, Math.min(maxAgents, task.estimatedAgents));

    logger.info(`Selected ${selected.length} agents: ${selected.map(s => s.agent.name).join(', ')}`);

    return selected;
  }

  private assessComplexity(description: string): 'low' | 'medium' | 'high' {
    const lowerDesc = description.toLowerCase();

    const highComplexityKeywords = ['architecture', 'distributed', 'microservices', 'security', 'integration'];
    const mediumComplexityKeywords = ['api', 'database', 'backend', 'frontend', 'testing'];

    if (highComplexityKeywords.some(keyword => lowerDesc.includes(keyword))) {
      return 'high';
    }

    if (mediumComplexityKeywords.some(keyword => lowerDesc.includes(keyword))) {
      return 'medium';
    }

    return 'low';
  }

  private extractRequirements(description: string): string[] {
    const requirements: string[] = [];
    const lowerDesc = description.toLowerCase();

    const keywordMap: Record<string, string> = {
      'api': 'API Development',
      'database': 'Database Design',
      'frontend': 'Frontend Development',
      'backend': 'Backend Development',
      'security': 'Security Implementation',
      'test': 'Testing',
      'deploy': 'Deployment',
      'monitoring': 'Monitoring'
    };

    for (const [keyword, requirement] of Object.entries(keywordMap)) {
      if (lowerDesc.includes(keyword)) {
        requirements.push(requirement);
      }
    }

    return requirements.length > 0 ? requirements : ['General Development'];
  }

  private estimateAgentCount(complexity: 'low' | 'medium' | 'high', requirements: string[]): number {
    const baseCount = {
      'low': 1,
      'medium': 2,
      'high': 3
    }[complexity];

    return Math.min(3, Math.max(1, baseCount + Math.floor(requirements.length / 3)));
  }

  private calculateAgentScore(agent: Agent, task: Task): number {
    let score = 0;

    for (const requirement of task.requirements) {
      const reqLower = requirement.toLowerCase();
      for (const capability of agent.capabilities) {
        if (capability.includes(reqLower) || reqLower.includes(capability)) {
          score += 10;
        }
      }
    }

    score += agent.priority * 0.1;

    const complexityBonus = {
      'low': agent.priority < 85 ? 5 : 0,
      'medium': agent.priority >= 80 && agent.priority <= 90 ? 5 : 0,
      'high': agent.priority > 85 ? 5 : 0
    }[task.complexity];

    score += complexityBonus;

    return score;
  }

  private generateSelectionReason(agent: Agent, task: Task): string {
    const matchingCaps = agent.capabilities.filter(cap =>
      task.requirements.some(req =>
        req.toLowerCase().includes(cap) || cap.includes(req.toLowerCase())
      )
    );

    if (matchingCaps.length > 0) {
      return `Expert in ${matchingCaps.join(', ')} - directly matches task requirements`;
    }

    return `High priority specialist (${agent.priority}) suitable for ${task.complexity} complexity tasks`;
  }

  async executeTask(task: Task, agents: AgentSelection[]): Promise<void> {
    logger.info(`Executing task with ${agents.length} agents in parallel`);

    for (const selection of agents) {
      logger.info(`  - ${selection.agent.name}: ${selection.reason}`);
    }

    logger.info('Task execution would begin here (implementation pending)');
  }
}

// CLI Interface
if (require.main === module) {
  const coordinator = new AIT42Coordinator();

  const taskDescription = process.argv[2] || 'Design and implement a RESTful API for real estate property management';

  logger.info('='.repeat(60));
  logger.info('AIT42 Agent Coordinator - Task Analysis');
  logger.info('='.repeat(60));

  const task = coordinator.analyzeTask(taskDescription);
  logger.info('\nTask Analysis:');
  logger.info(`  Description: ${task.description}`);
  logger.info(`  Complexity: ${task.complexity}`);
  logger.info(`  Requirements: ${task.requirements.join(', ')}`);
  logger.info(`  Estimated Agents: ${task.estimatedAgents}`);

  const selections = coordinator.selectAgents(task);
  logger.info('\nSelected Agents:');
  selections.forEach((selection, index) => {
    logger.info(`\n${index + 1}. ${selection.agent.name} (Score: ${selection.score})`);
    logger.info(`   ${selection.agent.description}`);
    logger.info(`   Reason: ${selection.reason}`);
  });
}
