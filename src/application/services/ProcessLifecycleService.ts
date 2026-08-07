import { IRuntimeService } from '../interfaces/services/IRuntimeService';

export class ProcessLifecycleService {
  constructor(private runtimeService: IRuntimeService) {}

  async start(projectId: string, profileId: string, command: string, cwd: string): Promise<void> {
    return this.runtimeService.start(projectId, profileId, command, cwd);
  }

  async stop(projectId: string, profileId: string): Promise<void> {
    return this.runtimeService.stop(projectId, profileId);
  }

  async restart(projectId: string, profileId: string, command: string, cwd: string): Promise<void> {
    return this.runtimeService.restart(projectId, profileId, command, cwd);
  }
}


