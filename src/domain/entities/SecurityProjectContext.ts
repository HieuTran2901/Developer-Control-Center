export interface SecurityProjectContext {
  projectId: string;
  projectName: string;
  projectRoot: string;
  architectureType: string;
  languages: string[];
  frameworks: string[];
  buildTools: string[];
  packageManagers: string[];
  manifests: string[];
  isGitRepo: boolean;
  gitBranch?: string;
}
