import { RuntimeProfile } from './RuntimeProfile';

export interface Project {
  id: string;
  name: string;
  rootPath: string;
  workspaceId: string;
  icon?: string;
  description?: string;
  profiles: RuntimeProfile[];
}


