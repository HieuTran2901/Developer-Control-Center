import { ProcessState } from './ProcessState';

export interface ProcessModel {
  id: string; // Typically ${projectId}-${profileId}
  projectId: string;
  profileId: string;
  pid?: number;
  command: string;
  args?: string[];
  workingDirectory: string;
  status: ProcessState;
  startTime?: number; // timestamp
  stopTime?: number; // timestamp
  exitCode?: number;
}

