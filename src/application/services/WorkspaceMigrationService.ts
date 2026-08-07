import { Workspace } from '@/domain/entities/Workspace';

export class WorkspaceMigrationService {
  /**
   * Cập nhật JSON schema từ các phiên bản cũ lên phiên bản hiện tại (v1)
   */
  public migrate(rawJson: any): Workspace {
    if (!rawJson) {
      throw new Error("Invalid workspace JSON");
    }

    let version = rawJson.version || 0;

    // v0 to v1 (Initial migration)
    if (version < 1) {
      rawJson = this.migrateV0ToV1(rawJson);
      version = 1;
    }

    // Future migrations
    // if (version < 2) {
    //   rawJson = this.migrateV1ToV2(rawJson);
    //   version = 2;
    // }

    return rawJson as Workspace;
  }

  private migrateV0ToV1(raw: any): any {
    // Phase 5A / 5B Workspace didn't have version
    const migrated = {
      ...raw,
      version: 1,
      lastOpened: raw.lastOpened || Date.now(),
      description: raw.description || '',
      appVersion: raw.appVersion || '0.1.0',
      projects: Array.isArray(raw.projects) ? raw.projects : []
    };

    // Ensure all projects have profiles array
    migrated.projects = migrated.projects.map((p: any) => ({
      ...p,
      profiles: Array.isArray(p.profiles) ? p.profiles : []
    }));

    return migrated;
  }
}

export const workspaceMigrationService = new WorkspaceMigrationService();
