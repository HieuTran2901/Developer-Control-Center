import { Workspace } from '../../entities/Workspace';
import { Project } from '../../entities/Project';
import { RuntimeProfile } from '../../entities/RuntimeProfile';

export interface IWorkspaceRepository {
  getWorkspace(): Promise<Workspace>;
  saveWorkspace(workspace: Workspace): Promise<void>;
  addProject(project: Project): Promise<void>;
  removeProject(projectId: string): Promise<void>;
  addProfile(projectId: string, profile: RuntimeProfile): Promise<void>;
  removeProfile(projectId: string, profileId: string): Promise<void>;
}
