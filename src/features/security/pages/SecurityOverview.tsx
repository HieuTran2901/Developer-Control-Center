import { useEffect, useState } from 'react';
import { Play, Square, Shield, AlertTriangle } from 'lucide-react';
import { useWorkspace } from '@/shared/hooks/useWorkspace';
import { securityService } from '@/application/services/SecurityService';
import { EventBus, EventType } from '@/application/events/EventBus';
import { SecurityFinding, SecurityScanStatus, SecurityScanSummary } from '@/domain/entities/SecurityFinding';

export function SecurityOverview() {
  const { workspace } = useWorkspace();
  const currentProject = workspace?.projects?.[0];
  const [status, setStatus] = useState<SecurityScanStatus>('IDLE');
  const [scanId, setScanId] = useState<string | null>(null);
  const [progress, setProgress] = useState({ scannedFiles: 0, currentScanner: '' });
  const [findings, setFindings] = useState<SecurityFinding[]>([]);
  const [, setSummary] = useState<SecurityScanSummary | null>(null);

  useEffect(() => {
    const unsubStarted = EventBus.subscribe(EventType.SecurityScanStarted, (payload: { projectId: string; scanId: string }) => {
      setStatus('SCANNING');
      setScanId(payload.scanId);
      setFindings([]);
      setSummary(null);
      setProgress({ scannedFiles: 0, currentScanner: 'Initializing...' });
    });

    const unsubProgress = EventBus.subscribe(EventType.SecurityScanProgress, (payload: { scanId: string; scannedFiles: number; currentScanner: string }) => {
      if (payload.scanId === scanId) {
        setProgress({ scannedFiles: payload.scannedFiles, currentScanner: payload.currentScanner });
      }
    });

    const unsubFinding = EventBus.subscribe(EventType.SecurityFindingsChunkDetected, (payload: { scanId: string; findings: SecurityFinding[] }) => {
      if (payload.scanId === scanId) {
        setFindings(prev => [...prev, ...payload.findings]);
      }
    });

    const unsubCompleted = EventBus.subscribe(EventType.SecurityScanCompleted, (payload: { scanId: string; summary: SecurityScanSummary }) => {
      if (payload.scanId === scanId) {
        setStatus('COMPLETED');
        setSummary(payload.summary);
      }
    });

    const unsubFailed = EventBus.subscribe(EventType.SecurityScanFailed, (payload: { scanId: string; reason: string }) => {
      if (payload.scanId === scanId) {
        setStatus('FAILED');
      }
    });

    const unsubCancelled = EventBus.subscribe(EventType.SecurityScanCancelled, (payload: { scanId: string }) => {
      if (payload.scanId === scanId) {
        setStatus('CANCELLED');
      }
    });

    return () => {
      unsubStarted();
      unsubProgress();
      unsubFinding();
      unsubCompleted();
      unsubFailed();
      unsubCancelled();
    };
  }, [scanId]);

  const handleStartScan = async () => {
    if (!currentProject) return;
    try {
      const id = await securityService.startSecurityScan(currentProject.id, currentProject.rootPath);
      setScanId(id);
      setStatus('SCANNING');
    } catch (e) {
      console.error(e);
    }
  };

  const handleCancelScan = async () => {
    if (scanId) {
      await securityService.cancelSecurityScan(scanId);
    }
  };

  if (!currentProject) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Please select a project first.
      </div>
    );
  }

  return (
    <div className="p-6 h-full flex flex-col space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            Security Center
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Static security analysis for {currentProject.name}
          </p>
        </div>
        
        {status === 'SCANNING' ? (
          <button 
            onClick={handleCancelScan}
            className="flex items-center gap-2 px-4 py-2 bg-destructive/10 text-destructive hover:bg-destructive/20 rounded-md transition-colors"
          >
            <Square className="w-4 h-4 fill-current" />
            Cancel Scan
          </button>
        ) : (
          <button 
            onClick={handleStartScan}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors"
          >
            <Play className="w-4 h-4 fill-current" />
            Run Security Scan
          </button>
        )}
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-surface border border-border p-4 rounded-lg flex flex-col">
          <span className="text-sm text-muted-foreground font-medium uppercase">Status</span>
          <span className="text-xl font-bold mt-1">{status}</span>
          {status === 'SCANNING' && (
            <span className="text-xs text-muted-foreground mt-2">{progress.scannedFiles} files scanned</span>
          )}
        </div>
        <div className="bg-surface border border-border p-4 rounded-lg flex flex-col">
          <span className="text-sm text-muted-foreground font-medium uppercase">Findings</span>
          <span className="text-xl font-bold mt-1 text-warning">{findings.length}</span>
        </div>
      </div>

      <div className="flex-1 bg-surface border border-border rounded-lg overflow-hidden flex flex-col">
        <div className="border-b border-border p-4 flex justify-between items-center bg-surface-hover/50">
          <h3 className="font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning" />
            Active Findings
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {findings.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
              <Shield className="w-12 h-12 mb-4 text-border" />
              <p>No vulnerabilities detected yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {findings.map((f, i) => {
                const isDependency = f.category === 'DEPENDENCY' || (f.metadata && f.metadata.type === 'Dependency');
                const meta = f.metadata?.type === 'Dependency' ? f.metadata.data : null;
                
                return (
                  <div key={i} className="p-3 border border-border rounded-md bg-background">
                    <div className="flex justify-between">
                      <span className="font-medium text-destructive">
                        {isDependency && meta ? `${meta.packageName} (${meta.version}) - ${f.title}` : f.title}
                      </span>
                      <div className="flex gap-2">
                        {isDependency && meta && (
                          <span className="text-xs uppercase bg-primary/10 text-primary px-2 py-1 rounded border border-primary/20">
                            {meta.ecosystem}
                          </span>
                        )}
                        <span className="text-xs uppercase bg-destructive/10 text-destructive px-2 py-1 rounded">
                          {f.severity}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{f.description}</p>
                    
                    {isDependency && meta ? (
                      <div className="text-xs text-muted-foreground mt-2 font-mono bg-surface p-2 rounded flex flex-col gap-1">
                        <div><span className="text-foreground/60">Path:</span> {f.filePath}</div>
                        {meta.vulnerabilityId && <div><span className="text-foreground/60">Vulnerability ID:</span> {meta.vulnerabilityId}</div>}
                        {meta.fixedVersion && <div><span className="text-foreground/60">Fixed In:</span> {meta.fixedVersion}</div>}
                        {f.remediation && <div className="text-primary mt-1">{f.remediation}</div>}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground mt-2 font-mono bg-surface p-2 rounded">
                        {f.filePath}:{f.line || '?'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
