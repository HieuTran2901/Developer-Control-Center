import { IResourceGateway } from '@/application/interfaces/gateways/IResourceGateway';

export class MockResourceGateway implements IResourceGateway {
  async watchPid(pid: number): Promise<void> {
    console.log(`[Mock] Watching PID: ${pid}`);
  }

  async unwatchPid(pid: number): Promise<void> {
    console.log(`[Mock] Unwatching PID: ${pid}`);
  }
}
