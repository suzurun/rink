export interface Agent {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  priority: number;
}

export interface Task {
  id: string;
  description: string;
  requirements: string[];
  complexity: 'low' | 'medium' | 'high';
  estimatedAgents: number;
}

export interface AgentSelection {
  agent: Agent;
  reason: string;
  score: number;
}

export interface WorktreeConfig {
  name: string;
  branch: string;
  path: string;
  agents: string[];
}

export interface TmuxSession {
  id: string;
  name: string;
  worktree?: string;
  agents: string[];
  status: 'active' | 'inactive' | 'error';
}

export interface ExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  duration: number;
}
