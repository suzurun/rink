import { Agent } from '../types';

export const AGENTS_REGISTRY: Agent[] = [
  {
    id: 'api-designer',
    name: 'Senior API Architect',
    description: 'Enterprise API design with 10+ years experience in REST, GraphQL, OpenAPI specification',
    capabilities: ['api-design', 'openapi', 'rest', 'graphql', 'api-governance'],
    priority: 90
  },
  {
    id: 'api-developer',
    name: 'Senior API Developer',
    description: 'REST/GraphQL/gRPC implementation with authentication, validation, and performance optimization',
    capabilities: ['api-implementation', 'authentication', 'validation', 'performance'],
    priority: 85
  },
  {
    id: 'backend-developer',
    name: 'Senior Backend Developer',
    description: 'Backend API implementation for REST/GraphQL, microservices, authentication, database integration',
    capabilities: ['backend', 'microservices', 'database', 'clean-architecture'],
    priority: 85
  },
  {
    id: 'frontend-developer',
    name: 'Senior Frontend Developer',
    description: 'Frontend UI implementation for React/Vue/Svelte, responsive design, accessibility',
    capabilities: ['frontend', 'react', 'vue', 'accessibility', 'responsive-design'],
    priority: 80
  },
  {
    id: 'database-designer',
    name: 'Senior Database Architect',
    description: 'Enterprise database design with PostgreSQL, MySQL, MongoDB',
    capabilities: ['database-design', 'postgresql', 'mysql', 'mongodb', 'optimization'],
    priority: 88
  },
  {
    id: 'system-architect',
    name: 'Principal Systems Architect',
    description: 'Enterprise-scale architecture design with distributed systems, microservices',
    capabilities: ['architecture', 'distributed-systems', 'microservices', 'cloud-native'],
    priority: 95
  },
  {
    id: 'devops-engineer',
    name: 'Elite DevOps Engineer',
    description: 'Infrastructure automation with IaC, Kubernetes, CI/CD, multi-cloud operations',
    capabilities: ['devops', 'kubernetes', 'cicd', 'iac', 'monitoring'],
    priority: 87
  },
  {
    id: 'security-architect',
    name: 'Principal Security Architect',
    description: 'Enterprise security design with threat modeling, zero-trust architecture',
    capabilities: ['security', 'threat-modeling', 'zero-trust', 'compliance'],
    priority: 92
  },
  {
    id: 'test-generator',
    name: 'Automated Test Specialist',
    description: 'Automated test generation for unit, integration, E2E tests with 80%+ coverage',
    capabilities: ['testing', 'unit-tests', 'integration-tests', 'e2e-tests', 'coverage'],
    priority: 82
  },
  {
    id: 'code-reviewer',
    name: 'Code Review Specialist',
    description: 'Automated code review with 0-100 scoring, security analysis, best practices',
    capabilities: ['code-review', 'security-analysis', 'best-practices', 'quality'],
    priority: 80
  }
];

export function findAgentById(id: string): Agent | undefined {
  return AGENTS_REGISTRY.find(agent => agent.id === id);
}

export function findAgentsByCapability(capability: string): Agent[] {
  return AGENTS_REGISTRY.filter(agent =>
    agent.capabilities.some(cap => cap.includes(capability))
  );
}

export function getTopAgents(count: number = 3): Agent[] {
  return [...AGENTS_REGISTRY]
    .sort((a, b) => b.priority - a.priority)
    .slice(0, count);
}
