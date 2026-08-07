import { Project } from '@/domain/entities/Project';

export interface IProjectRepository {
  getAllProjects(): Promise<Project[]>;
  getProjectById(id: string): Promise<Project | null>;
  addProject(project: Project): Promise<void>;
  updateProject(project: Project): Promise<void>;
  removeProject(id: string): Promise<void>;
}
