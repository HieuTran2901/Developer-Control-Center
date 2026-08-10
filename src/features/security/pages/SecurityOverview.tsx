import { useEffect, useState } from 'react';
import { useWorkspace } from '@/shared/hooks/useWorkspace';
import { securityService } from '@/application/services/SecurityService';
import { EventBus, EventType } from '@/application/events/EventBus';
import { SecurityFinding, SecurityScanStatus, SecurityScanSummary, SecurityScanMode } from '@/domain/entities/SecurityFinding';
import { open } from '@tauri-apps/plugin-dialog';

import { SecurityHeader } from '../components/SecurityHeader';
import { SecurityScanTarget } from '../components/SecurityScanTarget';
import { SecurityStatusMetrics } from '../components/SecurityStatusMetrics';
import { SecurityTabs } from '../components/SecurityTabs';
import { SecurityActiveFindings } from '../components/SecurityActiveFindings';
import { SecurityCapabilities } from '../components/SecurityCapabilities';

export function SecurityOverview() {
  const { workspace, session, updateSession } = useWorkspace();

  // Selected Target Resolution Logic:
  // 1. SecurityService cached target (user explicitly changed target during this session)
  // 2. session.selectedProjectId -> match in workspace.projects
  // 3. Fallback to workspace.projects[0]
  const initialCache = securityService.getState();

  const [selectedTarget, setSelectedTarget] = useState<{ name: string; path: string; id?: string } | null>(() => {
    if (initialCache.activeTarget) {
      return initialCache.activeTarget;
    }
    if (session?.selectedProjectId && workspace?.projects) {
      const match = workspace.projects.find(p => p.id === session.selectedProjectId);
      if (match) {
        return { name: match.name, path: match.rootPath, id: match.id };
      }
    }
    if (workspace?.projects && workspace.projects.length > 0) {
      const first = workspace.projects[0];
      return { name: first.name, path: first.rootPath, id: first.id };
    }
    return null;
  });

  // Keep SecurityService activeTarget in sync whenever selectedTarget changes
  const activeTarget = selectedTarget;

  useEffect(() => {
    // If workspace loads asynchronously and no target was set yet, resolve from workspace/session
    if (!selectedTarget && workspace?.projects && workspace.projects.length > 0) {
      let resolved = null;
      if (session?.selectedProjectId) {
        const match = workspace.projects.find(p => p.id === session.selectedProjectId);
        if (match) {
          resolved = { name: match.name, path: match.rootPath, id: match.id };
        }
      }
      if (!resolved) {
        const first = workspace.projects[0];
        resolved = { name: first.name, path: first.rootPath, id: first.id };
      }
      setSelectedTarget(resolved);
      securityService.setSelectedTarget(resolved);
    }
  }, [workspace, session, selectedTarget]);

  // Restored Scan States from SecurityService Singleton
  const [status, setStatus] = useState<SecurityScanStatus>(initialCache.status);
  const [scanId, setScanId] = useState<string | null>(initialCache.scanId);
  const [progress, setProgress] = useState(initialCache.progress);
  const [findings, setFindings] = useState<SecurityFinding[]>(initialCache.findings);
  const [, setSummary] = useState<SecurityScanSummary | null>(initialCache.summary);
  const [activeTab, setActiveTab] = useState<'overview' | 'history'>('overview');
  const [scanMode, setScanMode] = useState<SecurityScanMode>(initialCache.scanMode);

  const handleScanModeChange = (mode: SecurityScanMode) => {
    setScanMode(mode);
    securityService.setScanMode(mode);
  };

  useEffect(() => {
    const unsubStarted = EventBus.subscribe(EventType.SecurityScanStarted, (payload: { projectId: string; scanId: string }) => {
      console.log('[SecurityOverview] Received Started', payload);
      setStatus('SCANNING');
      setScanId(payload.scanId);
      setFindings([]);
      setSummary(null);
      setProgress({ scannedFiles: 0, currentScanner: 'Initializing...' });
    });

    const unsubProgress = EventBus.subscribe(EventType.SecurityScanProgress, (payload: { scanId: string; scannedFiles: number; currentScanner: string }) => {
      console.log('[SecurityOverview] Received Progress', payload, 'current scanId state:', scanId);
      setProgress({ scannedFiles: payload.scannedFiles, currentScanner: payload.currentScanner });
    });

    const unsubFinding = EventBus.subscribe(EventType.SecurityFindingsChunkDetected, (payload: { scanId: string; findings: SecurityFinding[] }) => {
      console.log('[SecurityOverview] Received FindingsChunk', payload.findings.length);
      setFindings(prev => [...prev, ...payload.findings]);
    });

    const unsubCompleted = EventBus.subscribe(EventType.SecurityScanCompleted, (payload: { scanId: string; summary: SecurityScanSummary }) => {
      console.log('[SecurityOverview] Received Completed', payload);
      setStatus('COMPLETED');
      setSummary(payload.summary);
    });

    const unsubFailed = EventBus.subscribe(EventType.SecurityScanFailed, (payload: { scanId: string; reason: string }) => {
      console.log('[SecurityOverview] Received Failed', payload);
      setStatus('FAILED');
    });

    const unsubCancelled = EventBus.subscribe(EventType.SecurityScanCancelled, (payload: { scanId: string }) => {
      console.log('[SecurityOverview] Received Cancelled', payload);
      setStatus('CANCELLED');
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

  const handleChangeTarget = async () => {
    try {
      const selectedPath = await open({
        directory: true,
        multiple: false,
      });
      if (selectedPath && typeof selectedPath === 'string') {
        const name = selectedPath.split(/[/\\]/).pop() || selectedPath;
        const matchedProj = workspace?.projects?.find(p => p.rootPath.toLowerCase() === selectedPath.toLowerCase());
        const newTarget = { name, path: selectedPath, id: matchedProj?.id };
        setSelectedTarget(newTarget);
        securityService.setSelectedTarget(newTarget);
        if (matchedProj) {
          updateSession({ selectedProjectId: matchedProj.id });
        }
      }
    } catch (e) {
      console.error('Failed to open dialog', e);
    }
  };

  const handleStartScan = async () => {
    if (!activeTarget) return;
    try {
      const projectId = (activeTarget as any).id || 'custom-target';
      await securityService.startSecurityScan(projectId, activeTarget.path, scanMode);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCancelScan = async () => {
    if (scanId) {
      await securityService.cancelSecurityScan(scanId);
    }
  };

  return (
    <div className="flex flex-col h-full w-full max-w-7xl mx-auto">
      <div className="flex-1 w-full min-h-0 flex flex-col p-4 sm:p-6 lg:p-8 space-y-6">
        <SecurityHeader 
          activeTargetName={activeTarget ? activeTarget.name : 'Unknown'}
          status={status}
          onRunScan={handleStartScan}
          onCancelScan={handleCancelScan}
          hasTarget={!!activeTarget}
        />

        <SecurityScanTarget 
          activeTarget={activeTarget}
          onChangeTarget={handleChangeTarget}
          scanMode={scanMode}
          onScanModeChange={handleScanModeChange}
          isScanning={status === 'SCANNING'}
        />

        <SecurityStatusMetrics 
          status={status}
          findingsCount={findings.length}
          scannedFiles={progress.scannedFiles}
        />

        <SecurityTabs 
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {activeTab === 'overview' && (
          <>
            <SecurityActiveFindings 
              findings={findings}
              status={status}
              onRunScan={handleStartScan}
              hasTarget={!!activeTarget}
            />

            <SecurityCapabilities />
          </>
        )}

        {activeTab === 'history' && (
          <div className="bg-surface border border-border p-8 rounded-xl flex items-center justify-center text-muted-foreground text-sm shadow-sm flex-shrink-0">
            Scan history will appear here
          </div>
        )}
      </div>
    </div>
  );
}

