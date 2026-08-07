import { StartProcessRequest } from '@/desktop/ipc/dto/StartProcessRequest';
import { SystemInfoResponse } from '@/desktop/ipc/dto/SystemInfoResponse';

export interface IDesktopGateway {
  // Process Commands
  startProcess(request: StartProcessRequest): Promise<void>;
  stopProcess(request: StartProcessRequest): Promise<void>;

  // System Commands
  ping(): Promise<string>;
  getAppVersion(): Promise<string>;
  openBrowser(url: string): Promise<void>;
  openFolder(path: string): Promise<void>;
  readDirectory(path: string): Promise<string[]>;
  getSystemInfo(): Promise<SystemInfoResponse>;
  
  // File System Commands
  getAppDataDir(): Promise<string>;
  readTextFile(path: string): Promise<string>;
  writeTextFile(path: string, content: string): Promise<void>;
  selectFolder(): Promise<string | null>;
}


