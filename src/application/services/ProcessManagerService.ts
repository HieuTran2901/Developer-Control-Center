import { IDesktopGateway } from '../interfaces/gateways/IDesktopGateway';
import { StartProcessRequest } from '@/desktop/ipc/dto/StartProcessRequest';

export class ProcessManagerService {
  constructor(private desktopGateway: IDesktopGateway) {}

  async startService(projectId: string, profileId: string): Promise<void> {
    const request: StartProcessRequest = { projectId, profileId };
    await this.desktopGateway.startProcess(request);
  }

  async stopService(projectId: string, profileId: string): Promise<void> {
    const request: StartProcessRequest = { projectId, profileId };
    await this.desktopGateway.stopProcess(request);
  }
}

