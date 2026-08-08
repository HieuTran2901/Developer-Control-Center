import { ProcessState } from '@/domain/entities/ProcessState';
import { ReadinessState } from '@/domain/entities/ReadinessState';

export interface ProcessStatusResponse {
  projectId: string;
  profileId: string;
  status: ProcessState;
  readiness?: ReadinessState;
  pid?: number;
  cpuUsage?: number;
  memoryUsage?: number;
  startTime?: number;
}

