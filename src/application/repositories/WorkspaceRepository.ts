import { EventBus, EventType } from '@/application/events/EventBus';
import { IWorkspaceRepository } from '@/domain/interfaces/repositories/IWorkspaceRepository';
import { Workspace } from '@/domain/entities/Workspace';
import { Project } from '@/domain/entities/Project';
import { RuntimeProfile } from '@/domain/entities/RuntimeProfile';
import { IDesktopGateway } from '@/application/interfaces/gateways/IDesktopGateway';
import { workspaceMigrationService } from '@/application/services/WorkspaceMigrationService';

export class WorkspaceRepository implements IWorkspaceRepository {
  private cache: Workspace | null = null;
  private readonly fileName = 'workspace.json';

  constructor(private desktopGateway: IDesktopGateway) {}

  private async getFilePath(): Promise<string> {
    const dir = await this.desktopGateway.getAppDataDir();
    return `${dir}/${this.fileName}`;
  }

  private getDefaultWorkspace(): Workspace {
    return {
      id: 'ws-default',
      version: 1,
      name: 'Default Workspace',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      projects: []
    };
  }

  async getWorkspace(): Promise<Workspace> {
    console.log('[DEBUG 3 WorkspaceRepository] getWorkspace() called. Cache exists?', !!this.cache);
    if (this.cache) return this.cache;

    try {
      const path = await this.getFilePath();
      console.log('[DEBUG 3 WorkspaceRepository] File path resolved:', path);
      const content = await this.desktopGateway.readTextFile(path);
      console.log('[DEBUG 3 WorkspaceRepository] File content read:', content);
      const rawJson = JSON.parse(content);
      this.cache = workspaceMigrationService.migrate(rawJson);
      console.log('[DEBUG 3 WorkspaceRepository] Workspace loaded and migrated:', this.cache);
      return this.cache;
    } catch (e) {
      console.warn('[DEBUG 3 WorkspaceRepository] Failed to read workspace file, creating default workspace:', e);
      const ws = this.getDefaultWorkspace();
      this.cache = ws;
      return ws; // Don't save it yet until they add a project
    }
  }

  async saveWorkspace(workspace: Workspace): Promise<void> {
    console.log('[DEBUG 3 WorkspaceRepository] saveWorkspace() called with:', workspace);
    workspace.updatedAt = Date.now();
    this.cache = workspace;
    const path = await this.getFilePath();
    console.log('[DEBUG 3 WorkspaceRepository] Saving workspace to path:', path);
    await this.desktopGateway.writeTextFile(path, JSON.stringify(workspace, null, 2));
    console.log('[DEBUG 3 WorkspaceRepository] File written. Publishing EventType.WorkspaceChanged...');
    EventBus.publish(EventType.WorkspaceChanged, workspace);
  }

  async addProject(project: Project): Promise<void> {
    console.log('[DEBUG 3 WorkspaceRepository] addProject() called with:', project);
    const ws = await this.getWorkspace();
    if (!Array.isArray(ws.projects)) {
      ws.projects = [];
    }
    ws.projects.push(project);
    await this.saveWorkspace(ws);
  }

  async removeProject(projectId: string): Promise<void> {
    const ws = await this.getWorkspace();
    if (!Array.isArray(ws.projects)) {
      ws.projects = [];
    }
    ws.projects = ws.projects.filter(p => p.id !== projectId);
    await this.saveWorkspace(ws);
  }

  async addProfile(projectId: string, profile: RuntimeProfile): Promise<void> {
    const ws = await this.getWorkspace();
    if (!Array.isArray(ws.projects)) {
      ws.projects = [];
    }
    const p = ws.projects.find(p => p.id === projectId);
    if (p) {
      if (!Array.isArray(p.profiles)) {
        p.profiles = [];
      }
      p.profiles.push(profile);
      await this.saveWorkspace(ws);
    }
  }

  async removeProfile(projectId: string, profileId: string): Promise<void> {
    const ws = await this.getWorkspace();
    if (!Array.isArray(ws.projects)) {
      ws.projects = [];
    }
    const p = ws.projects.find(p => p.id === projectId);
    if (p) {
      if (!Array.isArray(p.profiles)) {
        p.profiles = [];
      }
      p.profiles = p.profiles.filter(pr => pr.id !== profileId);
      await this.saveWorkspace(ws);
    }
  }
}


