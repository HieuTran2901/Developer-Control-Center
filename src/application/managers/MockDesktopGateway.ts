import { IDesktopGateway } from '../interfaces/gateways/IDesktopGateway';
import { StartProcessRequest } from '@/desktop/ipc/dto/StartProcessRequest';
import { ProcessState } from '@/domain/entities/ProcessState';
import { EventBus, EventType } from '../events/EventBus';
import { ProcessStatusResponse } from '@/desktop/ipc/dto/ProcessStatusResponse';
import { LogEntryResponse } from '@/desktop/ipc/dto/LogEntryResponse';
import { SystemInfoResponse } from '@/desktop/ipc/dto/SystemInfoResponse';

export class MockDesktopGateway implements IDesktopGateway {
  private activeIntervals: Map<string, NodeJS.Timeout> = new Map();

  async startProcess(request: StartProcessRequest): Promise<void> {
    const { projectId, profileId } = request;
    const processKey = `${projectId}-${profileId}`;

    EventBus.publish<ProcessStatusResponse>(EventType.ProcessStarted, {
      projectId,
      profileId,
      status: ProcessState.Starting
    });

    setTimeout(() => {
      EventBus.publish<ProcessStatusResponse>(EventType.ProcessStarted, {
        projectId,
        profileId,
        status: ProcessState.Running,
        pid: Math.floor(Math.random() * 10000) + 1000,
        cpuUsage: Math.random() * 5,
        memoryUsage: Math.random() * 100 + 50
      });

      const interval = setInterval(() => {
        EventBus.publish<LogEntryResponse>(EventType.LogReceived, {
          projectId,
          profileId,
          timestamp: Date.now(),
          level: 'info',
          message: `[Mock] Processing data for service ${profileId}...`
        });

        EventBus.publish<ProcessStatusResponse>(EventType.ResourceUpdated, {
          projectId,
          profileId,
          status: ProcessState.Running,
          cpuUsage: Math.random() * 10,
          memoryUsage: Math.random() * 200 + 50
        });
      }, 2000);

      this.activeIntervals.set(processKey, interval);
    }, 2000);
  }

  async stopProcess(request: StartProcessRequest): Promise<void> {
    const { projectId, profileId } = request;
    const processKey = `${projectId}-${profileId}`;

    EventBus.publish<ProcessStatusResponse>(EventType.ProcessStopped, {
      projectId,
      profileId,
      status: ProcessState.Stopping
    });

    const interval = this.activeIntervals.get(processKey);
    if (interval) {
      clearInterval(interval);
      this.activeIntervals.delete(processKey);
    }

    setTimeout(() => {
      EventBus.publish<ProcessStatusResponse>(EventType.ProcessStopped, {
        projectId,
        profileId,
        status: ProcessState.Stopped
      });
    }, 1000);
  }

  async ping(): Promise<string> {
    return new Promise(resolve => setTimeout(() => resolve("pong"), 100));
  }

  async getAppVersion(): Promise<string> {
    return "0.1.0-mock";
  }

  async openBrowser(url: string): Promise<void> {
    console.log(`[Mock] Opening browser to: ${url}`);
  }

  async openFolder(path: string): Promise<void> {
    console.log(`[Mock] Opening folder: ${path}`);
  }

  async readDirectory(path: string): Promise<string[]> {
    console.log(`[Mock] Reading directory: ${path}`);
    return ["file1.txt", "file2.json", "src", "public"];
  }

  async getAppDataDir(): Promise<string> {
    return 'C:\\MockAppData';
  }

  async readTextFile(_path: string): Promise<string> {
    return '{}';
  }

  async writeTextFile(path: string, content: string): Promise<void> {
    console.log(`Mock write to ${path}:`, content);
  }

  async selectFolder(): Promise<string | null> {
    return 'E:\\Github project\\Mock-Project';
  }

  async getSystemInfo(): Promise<SystemInfoResponse> {
    return {
      os: "Windows 10 Mock",
      arch: "x86_64",
      hostname: "MOCK-PC",
      username: "MockUser",
      totalMemory: 16 * 1024 * 1024 * 1024,
    };
  }
}

export const desktopGateway = new MockDesktopGateway();




