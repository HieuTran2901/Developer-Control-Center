import { IRuntimeService } from '../interfaces/services/IRuntimeService';
import { IRuntimeRegistry } from '../interfaces/services/IRuntimeRegistry';
import { ProcessModel } from '@/domain/entities/ProcessModel';
import { ProcessState } from '@/domain/entities/ProcessState';
import { invoke } from '@tauri-apps/api/core';


export class TauriRuntimeService implements IRuntimeService {
  constructor(private registry: IRuntimeRegistry) {}

  async start(projectId: string, profileId: string, command: string, workingDirectory: string): Promise<void> {
    try {
      await invoke('start_process_cmd', {
        projectId,
        profileId,
        command,
        cwd: workingDirectory
      });
    } catch (e) {
      console.error("Failed to invoke start_process_cmd", e);
      // Rust backend will emit ProcessFailed if it fails internally, 
      // but if the IPC itself fails (e.g. network/serialize error), we log it.
    }
  }

  async stop(projectId: string, profileId: string): Promise<void> {
    try {
      await invoke('stop_process_cmd', { projectId, profileId });
    } catch (e) {
      console.error("Failed to invoke stop_process_cmd", e);
    }
  }

  async restart(projectId: string, profileId: string, command: string, workingDirectory: string): Promise<void> {
    try {
      await invoke('restart_process_cmd', {
        projectId,
        profileId,
        command,
        cwd: workingDirectory
      });
    } catch (e) {
      console.error("Failed to invoke restart_process_cmd", e);
    }
  }

  getStatus(projectId: string, profileId: string): ProcessState {
    const id = `${projectId}-${profileId}`;
    const process = this.registry.findById(id);
    return process ? process.status : ProcessState.Idle;
  }

  listRunning(): ProcessModel[] {
    return this.registry.getAll().filter(p => p.status === ProcessState.Running || p.status === ProcessState.Starting);
  }
}



