import { Project } from './Project';

export interface Workspace {
  id: string;
  version: number;
  name: string;
  description?: string;
  appVersion?: string;
  createdAt: number;
  updatedAt: number;
  lastOpened?: number;
  projects: Project[];
}
