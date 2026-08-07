import { IDesktopGateway } from '../interfaces/gateways/IDesktopGateway';

export interface HealthStatus {
  rustConnected: boolean;
  ipcConnected: boolean;
  tauriReady: boolean;
  desktopGatewayReady: boolean;
  version: string | null;
}

export class DesktopHealthService {
  constructor(private desktopGateway: IDesktopGateway) {}

  async checkHealth(): Promise<HealthStatus> {
    const status: HealthStatus = {
      rustConnected: false,
      ipcConnected: false,
      tauriReady: false,
      desktopGatewayReady: false,
      version: null
    };

    try {
      const pingResult = await this.desktopGateway.ping();
      if (pingResult === 'pong') {
        status.rustConnected = true;
        status.ipcConnected = true;
      }
      
      const version = await this.desktopGateway.getAppVersion();
      if (version) {
        status.tauriReady = true;
        status.version = version;
      }
      
      status.desktopGatewayReady = true;
    } catch (e) {
      console.error("Health check failed", e);
    }

    return status;
  }
}
