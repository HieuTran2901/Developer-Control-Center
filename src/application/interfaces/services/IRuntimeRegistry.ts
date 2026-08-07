import { ProcessModel } from '@/domain/entities/ProcessModel';

export interface IRuntimeRegistry {
  add(process: ProcessModel): void;
  remove(id: string): void;
  update(id: string, updates: Partial<ProcessModel>): void;
  findById(id: string): ProcessModel | undefined;
  findByProject(projectId: string): ProcessModel[];
  findByService(projectId: string, serviceId: string): ProcessModel | undefined;
  getAll(): ProcessModel[];
}
