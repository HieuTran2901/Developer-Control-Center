export type Status = 'Success' | 'Failed' | 'Running' | 'Cancelled';

export interface PipelineRun {
  id: string;
  name: string;
  project: string;
  status: Status;
  branch: string;
  commit: string;
  commitMessage: string;
  duration: string;
  triggeredAt: string;
  triggeredBy: string;
}

export interface Deployment {
  id: string;
  environment: string;
  status: Status;
  version: string;
  deployedAt: string;
  deployedBy: string;
}

export interface PipelineStage {
  id: string;
  name: string;
  status: Status;
  duration: string;
  info?: string;
}

export const mockMetrics = {
  totalPipelines: 12,
  successfulRuns: 24,
  failedRuns: 3,
  avgDuration: '6m 24s',
  deployments: 8,
};

export const mockPipelineRuns: PipelineRun[] = [
  {
    id: 'run-1245',
    name: 'Web Application',
    project: 'market-frontend',
    status: 'Success',
    branch: 'main',
    commit: 'a1b2c3d',
    commitMessage: 'feat: update UI',
    duration: '4m 32s',
    triggeredAt: '2m ago',
    triggeredBy: 'DevUser'
  },
  {
    id: 'run-1244',
    name: 'API Service',
    project: 'market-backend',
    status: 'Failed',
    branch: 'develop',
    commit: 'd4e5f6g',
    commitMessage: 'fix: auth bug',
    duration: '7m 18s',
    triggeredAt: '15m ago',
    triggeredBy: 'DevUser'
  },
  {
    id: 'run-1243',
    name: 'AI Worker',
    project: 'ai-service',
    status: 'Success',
    branch: 'main',
    commit: 'h7i8j9k',
    commitMessage: 'chore: deps update',
    duration: '3m 05s',
    triggeredAt: '32m ago',
    triggeredBy: 'DevUser'
  },
  {
    id: 'run-1242',
    name: 'Database Migration',
    project: 'market-backend',
    status: 'Success',
    branch: 'main',
    commit: 'k9l0m1n',
    commitMessage: 'feat: add indexes',
    duration: '2m 12s',
    triggeredAt: '1h ago',
    triggeredBy: 'DevUser'
  },
  {
    id: 'run-1241',
    name: 'E2E Tests',
    project: 'market-frontend',
    status: 'Failed',
    branch: 'feature/e2e',
    commit: 'n2o3p4q',
    commitMessage: 'test: add e2e cases',
    duration: '9m 44s',
    triggeredAt: '2h ago',
    triggeredBy: 'DevUser'
  }
];

export const mockHealthStats = {
  total: 27,
  success: 24,
  failed: 3,
  cancelled: 0,
  running: 0
};

export const mockDeployments: Deployment[] = [
  {
    id: 'dep-1',
    environment: 'Production',
    status: 'Success',
    version: 'v1.2.3',
    deployedAt: '1h ago',
    deployedBy: 'DevUser'
  },
  {
    id: 'dep-2',
    environment: 'Staging',
    status: 'Success',
    version: 'v1.2.3',
    deployedAt: '2h ago',
    deployedBy: 'DevUser'
  },
  {
    id: 'dep-3',
    environment: 'Development',
    status: 'Success',
    version: 'v1.2.4-beta.1',
    deployedAt: '3h ago',
    deployedBy: 'DevUser'
  }
];

export const mockPipelineStages: PipelineStage[] = [
  { id: 's1', name: 'Checkout', status: 'Success', duration: '12s' },
  { id: 's2', name: 'Install Dependencies', status: 'Success', duration: '45s' },
  { id: 's3', name: 'Lint', status: 'Success', duration: '32s' },
  { id: 's4', name: 'Unit Tests', status: 'Success', duration: '1m 12s', info: '124 passed' },
  { id: 's5', name: 'Build', status: 'Success', duration: '1m 45s' },
  { id: 's6', name: 'Docker Build', status: 'Success', duration: '1m 08s' },
  { id: 's7', name: 'Deploy', status: 'Success', duration: '1m 10s' }
];
