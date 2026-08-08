
export interface ReadinessConfig {
  type: 'none' | 'log_pattern' | 'port' | 'http';
  pattern?: string;
  port?: number;
  path?: string;
}

export interface RuntimeProfile {
  projectId: string;
  id: string;
  name: string;
  workingDirectory: string;
  command: string;
  arguments: string[];
  environment?: Record<string, string>;
  autoStart?: boolean;
  readinessRegex?: string;
  readinessConfig?: ReadinessConfig;
}


