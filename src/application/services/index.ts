import { isTauri } from '@tauri-apps/api/core';
import { TauriDesktopGateway } from '../managers/TauriDesktopGateway';
import { DesktopHealthService } from './DesktopHealthService';
import { RuntimeRegistry } from '../managers/RuntimeRegistry';
import { TauriRuntimeService } from './TauriRuntimeService';
import { MockRuntimeService } from './MockRuntimeService';
import { USE_MOCK_RUNTIME } from '@/config/runtimeConfig';
import { LogBufferManager } from '../managers/LogBuffer';

// Process Runtime Core
export const runtimeRegistry = new RuntimeRegistry();
export const logBufferManager = new LogBufferManager();

// Use Tauri Gateway just for Health Check to verify IPC
export const tauriDesktopGateway = new TauriDesktopGateway();
import { WorkspaceRepository } from '../repositories/WorkspaceRepository';
export const workspaceRepository = new WorkspaceRepository(tauriDesktopGateway);
export const desktopHealthService = new DesktopHealthService(tauriDesktopGateway);

import { ProcessLifecycleService } from './ProcessLifecycleService';

export const runtimeService = USE_MOCK_RUNTIME 
  ? new MockRuntimeService(runtimeRegistry, tauriDesktopGateway) 
  : new TauriRuntimeService(runtimeRegistry);

export const processLifecycleService = new ProcessLifecycleService(runtimeService);



export * from './WorkspaceMigrationService';
import { ApplicationStateService } from './ApplicationStateService';
export const applicationStateService = new ApplicationStateService(tauriDesktopGateway);


export * from './ResourceMonitorService';
import { TauriResourceGateway } from '../managers/TauriResourceGateway';
import { MockResourceGateway } from '../managers/MockResourceGateway';
import { ResourceMonitorService } from './ResourceMonitorService';
export const resourceGateway = isTauri() ? new TauriResourceGateway() : new MockResourceGateway();
export const resourceMonitorService = new ResourceMonitorService(resourceGateway);



export * from './ResourceHistoryService';
export * from './AlertService';
import { ResourceHistoryService } from './ResourceHistoryService';
import { AlertService } from './AlertService';
export const resourceHistoryService = new ResourceHistoryService();
export const alertService = new AlertService();


export * from './PerformanceAnalysisService';
import { PerformanceAnalysisService } from './PerformanceAnalysisService';
export const performanceAnalysisService = new PerformanceAnalysisService();

