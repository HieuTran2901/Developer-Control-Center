import { invoke } from '@tauri-apps/api/core';

export interface DeploymentRequest {
  deploymentId: string;
  projectId: string;
  pipelineId: string;
  environmentId: string;
  platform: string;
  sourceRef: string;
  variablesOverride?: Record<string, string>;
}

export interface DeploymentRecord {
  deploymentId: string;
  projectId: string;
  pipelineId: string;
  environmentId: string;
  platform: string;
  sourceRef: string;
  status: 'Created' | 'Validating' | 'WaitingApproval' | 'Approved' | 'Running' | 'Succeeded' | 'Failed' | 'Cancelled';
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  policyDecision?: string;
  approvalId?: string;
  errorMessage?: string;
  executionId?: string;
}

export async function createDeployment(request: DeploymentRequest, pipelines: any[]): Promise<DeploymentRecord> {
  return await invoke('create_deployment', { request, pipelines });
}

export async function approveDeployment(deploymentId: string, approvalId: string): Promise<DeploymentRecord> {
  return await invoke('approve_deployment', { deploymentId, approvalId });
}

export async function executeDeployment(deploymentId: string, pipeline: any): Promise<void> {
  return await invoke('execute_deployment', { deploymentId, pipeline });
}

export async function getDeploymentHistory(): Promise<DeploymentRecord[]> {
  return await invoke('get_deployment_history');
}
