import { SecurityScanMode } from './SecurityFinding';

export interface SecurityCapabilities {
  secrets: boolean;
  configuration: boolean;
  dependencies: boolean;
  gitExposure: boolean;
}

export interface DependencyTargetPlan {
  manifestFile: string;
  ecosystem: string;
  description: string;
}

export interface SecurityScanPlan {
  projectId: string;
  projectName: string;
  projectRoot: string;
  architectureType?: string;
  mode: SecurityScanMode;
  languages: string[];
  frameworks: string[];
  manifests: string[];
  buildTools: string[];
  packageManagers: string[];
  capabilities: SecurityCapabilities;
  dependencyTargets: DependencyTargetPlan[];
  gitAvailable: boolean;
  planningNotes: string[];
}
