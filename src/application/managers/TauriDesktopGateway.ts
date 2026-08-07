import { open } from '@tauri-apps/plugin-dialog';
import { IDesktopGateway } from '../interfaces/gateways/IDesktopGateway';
import { StartProcessRequest } from '@/desktop/ipc/dto/StartProcessRequest';
import { SystemInfoResponse } from '@/desktop/ipc/dto/SystemInfoResponse';
import { invoke } from '@tauri-apps/api/core';

export class TauriDesktopGateway implements IDesktopGateway {
  
  async startProcess(_request: StartProcessRequest): Promise<void> {
    // Process manager logic not implemented yet in this phase
    console.warn("TauriDesktopGateway.startProcess is not fully implemented yet");
  }

  async stopProcess(_request: StartProcessRequest): Promise<void> {
    // Process manager logic not implemented yet in this phase
    console.warn("TauriDesktopGateway.stopProcess is not fully implemented yet");
  }

  async ping(): Promise<string> {
    return await invoke<string>('ping_command');
  }

  async getAppVersion(): Promise<string> {
    return await invoke<string>('get_app_version_command');
  }

  async openBrowser(url: string): Promise<void> {
    return await invoke<void>('open_browser_command', { url });
  }

  async openFolder(path: string): Promise<void> {
    return await invoke<void>('open_folder_command', { path });
  }

  async readDirectory(path: string): Promise<string[]> {
    return await invoke<string[]>('read_directory_command', { path });
  }

  async getAppDataDir(): Promise<string> {
    return invoke<string>('get_app_data_dir_cmd');
  }

  async readTextFile(path: string): Promise<string> {
    return invoke<string>('read_text_file_cmd', { path });
  }

  async writeTextFile(path: string, content: string): Promise<void> {
    return invoke<void>('write_text_file_cmd', { path, content });
  }

  async selectFolder(): Promise<string | null> {
    const selected = await open({
      directory: true,
      multiple: false,
    });
    return selected ? (Array.isArray(selected) ? selected[0] : selected) : null;
  }

  async getSystemInfo(): Promise<SystemInfoResponse> {
    return await invoke<SystemInfoResponse>('get_system_info_command');
  }
}


