import { IDesktopGateway } from '@/application/interfaces/gateways/IDesktopGateway';
import { SecurityHistoryRecord } from '@/domain/entities/SecurityHistoryRecord';

export class SecurityHistoryRepository {
  private cache: SecurityHistoryRecord[] | null = null;
  private readonly defaultFileName = 'security_history.json';
  private readonly preferedPath = 'E:/Developer-Control-Center/data/security-history/history.json';

  constructor(private desktopGateway: IDesktopGateway) {}

  private async getFilePath(): Promise<string> {
    // Try preferred drive path E: first, fallback to AppData directory if inaccessible
    try {
      return this.preferedPath;
    } catch {
      const dir = await this.desktopGateway.getAppDataDir();
      return `${dir}/${this.defaultFileName}`;
    }
  }

  async getHistory(): Promise<SecurityHistoryRecord[]> {
    if (this.cache) return this.cache;

    try {
      const path = await this.getFilePath();
      const content = await this.desktopGateway.readTextFile(path);
      const parsed = JSON.parse(content) as SecurityHistoryRecord[];
      this.cache = Array.isArray(parsed) ? parsed : [];
      return this.cache;
    } catch (e) {
      // Return empty array on initial read or missing file
      this.cache = [];
      return this.cache;
    }
  }

  async addRecord(record: SecurityHistoryRecord): Promise<void> {
    const history = await this.getHistory();

    // Idempotency check using scanId/id
    if (history.some(r => r.id === record.id || r.scanId === record.scanId)) {
      console.log('[SecurityHistoryRepository] Record with scanId already exists, skipping:', record.scanId);
      return;
    }

    let updated = [record, ...history];

    // Retention policy: Keep maximum 100 records
    if (updated.length > 100) {
      updated = updated.slice(0, 100);
    }

    this.cache = updated;

    try {
      const path = await this.getFilePath();
      await this.desktopGateway.writeTextFile(path, JSON.stringify(updated, null, 2));
    } catch (e) {
      console.error('[SecurityHistoryRepository] Failed to write history record:', e);
    }
  }
}
