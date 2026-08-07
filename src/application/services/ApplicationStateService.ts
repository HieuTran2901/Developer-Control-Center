import { IDesktopGateway } from '@/application/interfaces/gateways/IDesktopGateway';
import { WorkspaceSession, createDefaultSession, RecentWorkspace } from '@/domain/entities/WorkspaceSession';
import { EventBus, EventType } from '@/application/events/EventBus';

export class ApplicationStateService {
  private session: WorkspaceSession | null = null;
  private readonly fileName = 'session.json';

  constructor(private desktopGateway: IDesktopGateway) {}

  private async getFilePath(): Promise<string> {
    const dir = await this.desktopGateway.getAppDataDir();
    return `${dir}/${this.fileName}`;
  }

  async loadSession(): Promise<WorkspaceSession> {
    if (this.session) return this.session;

    try {
      const path = await this.getFilePath();
      const content = await this.desktopGateway.readTextFile(path);
      this.session = JSON.parse(content) as WorkspaceSession;
      return this.session;
    } catch (e) {
      // File not found or invalid
      this.session = createDefaultSession();
      return this.session;
    }
  }

  async saveSession(): Promise<void> {
    if (!this.session) return;
    const path = await this.getFilePath();
    await this.desktopGateway.writeTextFile(path, JSON.stringify(this.session, null, 2));
    EventBus.publish(EventType.SettingsChanged, this.session);
  }

  getSession(): WorkspaceSession {
    if (!this.session) {
      throw new Error("Session not loaded. Call loadSession() first.");
    }
    return this.session;
  }

  async updateSession(updates: Partial<WorkspaceSession>): Promise<void> {
    this.session = { ...this.getSession(), ...updates };
    await this.saveSession();
  }

  async addRecentWorkspace(recent: RecentWorkspace): Promise<void> {
    const session = this.getSession();
    const existingIndex = session.recentWorkspaces.findIndex(w => w.id === recent.id);
    
    let updatedWorkspaces = [...session.recentWorkspaces];
    if (existingIndex >= 0) {
      updatedWorkspaces[existingIndex] = { ...updatedWorkspaces[existingIndex], lastOpened: Date.now() };
    } else {
      updatedWorkspaces.unshift(recent);
    }
    
    // Keep max 10
    if (updatedWorkspaces.length > 10) {
      updatedWorkspaces = updatedWorkspaces.slice(0, 10);
    }
    
    await this.updateSession({ recentWorkspaces: updatedWorkspaces });
  }
}
