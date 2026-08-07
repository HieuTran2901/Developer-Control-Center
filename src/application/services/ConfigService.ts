export interface AppConfig {
  workspacePath: string;
  theme: 'light' | 'dark' | 'system';
  accentColor: string;
  terminalShell: string;
  developerOptionsEnabled: boolean;
}

export class ConfigService {
  private config: AppConfig = {
    workspacePath: 'C:/Workspaces',
    theme: 'dark',
    accentColor: 'primary',
    terminalShell: 'powershell',
    developerOptionsEnabled: false
  };

  async getConfig(): Promise<AppConfig> {
    return this.config;
  }

  async updateConfig(newConfig: Partial<AppConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
  }
}

export const configService = new ConfigService();
