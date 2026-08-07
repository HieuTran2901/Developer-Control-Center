
export interface RuntimeProfile {
  projectId: string;
  id: string;
  name: string;
  workingDirectory: string;
  command: string;
  arguments: string[];
  environment?: Record<string, string>;
  autoStart?: boolean;
}


