import { ProcessModel } from '@/domain/entities/ProcessModel';
import { ProcessState } from '@/domain/entities/ProcessState';
import { ReadinessConfig } from '@/domain/entities/RuntimeProfile';

export interface IRuntimeService {
  start(projectId: string, profileId: string, command: string, workingDirectory: string, readinessRegex?: string, readinessConfig?: ReadinessConfig): Promise<void>;
  stop(projectId: string, profileId: string): Promise<void>;
  restart(projectId: string, profileId: string, command: string, workingDirectory: string, readinessRegex?: string, readinessConfig?: ReadinessConfig): Promise<void>;
  getStatus(projectId: string, profileId: string): ProcessState;
  listRunning(): ProcessModel[];
}


