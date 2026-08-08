import { ProcessState } from './ProcessState';
import { ReadinessState } from './ReadinessState';

export interface ProcessModel {
  id: string; // Typically ${projectId}-${profileId}
  projectId: string;
  profileId: string;
  pid?: number;
  command: string;
  args?: string[];
  workingDirectory: string;
  status: ProcessState;
  readiness?: ReadinessState;
  startTime?: number; // timestamp
  stopTime?: number; // timestamp
  exitCode?: number;
}

