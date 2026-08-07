import { IRuntimeRegistry } from '../interfaces/services/IRuntimeRegistry';
import { ProcessModel } from '@/domain/entities/ProcessModel';

export class RuntimeRegistry implements IRuntimeRegistry {
  private processes: Map<string, ProcessModel> = new Map();

  add(process: ProcessModel): void {
    this.processes.set(process.id, process);
  }

  remove(id: string): void {
    this.processes.delete(id);
  }

  update(id: string, updates: Partial<ProcessModel>): void {
    const process = this.processes.get(id);
    if (process) {
      this.processes.set(id, { ...process, ...updates });
    }
  }

  findById(id: string): ProcessModel | undefined {
    return this.processes.get(id);
  }

  findByProject(projectId: string): ProcessModel[] {
    return Array.from(this.processes.values()).filter(p => p.projectId === projectId);
  }

  findByService(projectId: string, serviceId: string): ProcessModel | undefined {
    const id = `${projectId}-${serviceId}`;
    return this.processes.get(id);
  }

  getAll(): ProcessModel[] {
    return Array.from(this.processes.values());
  }
}
