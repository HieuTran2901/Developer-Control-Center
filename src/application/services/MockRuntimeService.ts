import { IRuntimeService } from '../interfaces/services/IRuntimeService';
import { IRuntimeRegistry } from '../interfaces/services/IRuntimeRegistry';
import { IDesktopGateway } from '../interfaces/gateways/IDesktopGateway';
import { ProcessModel } from '@/domain/entities/ProcessModel';
import { ProcessState } from '@/domain/entities/ProcessState';
import { EventBus, EventType } from '../events/EventBus';

export class MockRuntimeService implements IRuntimeService {
  constructor(
    private registry: IRuntimeRegistry,
    private desktopGateway: IDesktopGateway
  ) {}

  async start(projectId: string, profileId: string, command: string, workingDirectory: string, readinessRegex?: string, readinessConfig?: any): Promise<void> {
    const id = `${projectId}-${profileId}`;
    console.log(`Starting mock process with command: ${command}, cwd: ${workingDirectory}, readinessRegex: ${readinessRegex}, readinessConfig:`, readinessConfig);
    
    const process: ProcessModel = {
      id,
      projectId,
      profileId,
      command,
      workingDirectory,
      status: ProcessState.Starting,
      startTime: Date.now()
    };
    
    this.registry.add(process);
    EventBus.publish(EventType.ProcessStarting, { projectId, profileId });
    
    await this.desktopGateway.startProcess({ projectId, profileId });

    setTimeout(() => {
      // Import ReadinessState here or assume it's imported (wait, let's just use string values if needed, or rely on import if we add it)
      this.registry.update(id, { status: ProcessState.Running, readiness: 'waiting' as any, pid: Math.floor(Math.random() * 10000) + 1000 });
      EventBus.publish(EventType.ProcessStarted, { projectId, profileId, status: ProcessState.Running, readiness: 'waiting', pid: Math.floor(Math.random() * 10000) });
    }, 500);

    setTimeout(() => {
      const process = this.registry.findById(id);
      if (process?.status === ProcessState.Running && process.readiness === 'waiting') {
        this.registry.update(id, { readiness: 'ready' as any });
        EventBus.publish(EventType.ProcessReadinessChanged, { projectId, profileId, readiness: 'ready' });
      }
    }, 2000);
  }

  async forceStop(projectId: string, profileId: string): Promise<void> {
    return this.stop(projectId, profileId);
  }

  async stop(projectId: string, profileId: string): Promise<void> {
    const id = `${projectId}-${profileId}`;
    const process = this.registry.findById(id);
    
    if (process && process.status !== ProcessState.Stopped) {
      this.registry.update(id, { status: ProcessState.Stopping });
      EventBus.publish(EventType.ProcessStopped, { projectId, profileId, status: ProcessState.Stopping });
      
      await this.desktopGateway.stopProcess({ projectId, profileId });
      
      setTimeout(() => {
        this.registry.update(id, { 
          status: ProcessState.Stopped,
          stopTime: Date.now(),
          exitCode: 0
        });
        EventBus.publish(EventType.ProcessExited, { projectId, profileId, exitCode: 0 });
      }, 1000);
    }
  }

  async restart(projectId: string, profileId: string, command: string, workingDirectory: string, readinessRegex?: string): Promise<void> {
    console.log(`Restarting mock process with command: ${command}, cwd: ${workingDirectory}, readinessRegex: ${readinessRegex}`);
    const id = `${projectId}-${profileId}`;
    this.registry.update(id, { status: ProcessState.Restarting });
    EventBus.publish(EventType.ProcessRestarted, { projectId, profileId });
    
    await this.stop(projectId, profileId);
    setTimeout(async () => {
      const process = this.registry.findById(id);
      if (process) {
        await this.start(projectId, profileId, process.command, process.workingDirectory);
      }
    }, 1500);
  }

  async kill(projectId: string, profileId: string): Promise<void> {
    const id = `${projectId}-${profileId}`;
    this.registry.update(id, { 
      status: ProcessState.Failed,
      stopTime: Date.now(),
      exitCode: -1
    });
    EventBus.publish(EventType.ProcessFailed, { projectId, profileId, error: 'Killed forcefully' });
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


