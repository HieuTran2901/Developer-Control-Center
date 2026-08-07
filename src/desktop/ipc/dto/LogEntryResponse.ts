export interface LogEntryResponse {
  projectId: string;
  profileId: string;
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
}

