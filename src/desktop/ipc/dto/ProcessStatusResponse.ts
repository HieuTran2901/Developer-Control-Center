import { ProcessState } from '@/domain/entities/ProcessState';

export interface ProcessStatusResponse {
  projectId: string;
  profileId: string;
  status: ProcessState;
  pid?: number;
  cpuUsage?: number;
  memoryUsage?: number;
}

