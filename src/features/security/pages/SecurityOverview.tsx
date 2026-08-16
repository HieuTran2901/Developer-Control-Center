import { useEffect, useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
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

import { SecurityHistoryList } from '../components/SecurityHistoryList';
import { securityHistoryRepository } from '@/application/services';
import { SecurityHistoryRecord } from '@/domain/entities/SecurityHistoryRecord';
import { SecurityTargetTooBroadModal } from '../components/SecurityTargetTooBroadModal';
import { SecurityMultiProjectModal, ProjectCandidate } from '../components/SecurityMultiProjectModal';

interface FolderScopeAnalysis {
  rootPath: string;
  classification: 'SAFE' | 'LARGE' | 'BLOCKED';
  reason?: string;
  estimatedFiles: number;
  estimatedDirectories: number;
  excludedDirectories: string[];
  projectCandidates: ProjectCandidate[];
  isBudgetExceeded: boolean;
  isCancelled: boolean;
  scanDurationMs: number;
}

export function SecurityOverview() {
  const { workspace, session, updateSession } = useWorkspace();
  const requestIdRef = useRef(0);

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

  // Target Guard Modal States
  const [tooBroadModal, setTooBroadModal] = useState<{
    isOpen: boolean;
    path: string;
    reason?: string;
  }>({ isOpen: false, path: '' });

  const [multiProjectModal, setMultiProjectModal] = useState<{
    isOpen: boolean;
    parentPath: string;
    candidates: ProjectCandidate[];
  }>({ isOpen: false, parentPath: '', candidates: [] });

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
  const [historyRecords, setHistoryRecords] = useState<SecurityHistoryRecord[]>([]);

  // Load history records from persistent storage
  useEffect(() => {
    securityHistoryRepository.getHistory().then(records => {
      setHistoryRecords(records);
    });

    const unsubHistory = EventBus.subscribe<SecurityHistoryRecord>(EventType.SecurityHistoryUpdated, () => {
      securityHistoryRepository.getHistory().then(records => {
        setHistoryRecords(records);
      });
    });

    return () => {
      unsubHistory();
    };
  }, []);

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

  const validateAndApplyTarget = async (selectedPath: string) => {
    const currentRequestId = ++requestIdRef.current;

    // 1. Immediately invalidate old target state & UI indicators
    const interimTarget = {
      name: 'Analyzing project...',
      path: selectedPath,
    };
    setSelectedTarget(interimTarget);
    securityService.setSelectedTarget(interimTarget);
    setSummary(null);
    setFindings([]);
    setStatus('IDLE');
    setScanId(null);
    setProgress({ scannedFiles: 0, currentScanner: '' });

    // Clean session selected project ID immediately if ad-hoc path
    const matchedImmediate = workspace?.projects?.find(
      (p) => p.rootPath.toLowerCase() === selectedPath.toLowerCase()
    );
    if (matchedImmediate) {
      updateSession({ selectedProjectId: matchedImmediate.id });
    } else if (session?.selectedProjectId) {
      updateSession({ selectedProjectId: undefined });
    }

    try {
      const analysis = await invoke<FolderScopeAnalysis>('analyze_folder_scope_cmd', {
        folderPath: selectedPath,
      });

      // Stale response / race condition protection
      if (requestIdRef.current !== currentRequestId) {
        return;
      }

      // Path identity validation
      if (analysis.rootPath.toLowerCase() !== selectedPath.toLowerCase()) {
        return;
      }

      // 1. Filesystem root / broad / blocked target
      if (analysis.classification === 'BLOCKED') {
        setSelectedTarget(null);
        securityService.setSelectedTarget(null);
        setTooBroadModal({
          isOpen: true,
          path: selectedPath,
          reason: analysis.reason,
        });
        return;
      }

      // 2. Folder is large / multi-project / broad non-project container
      if (analysis.classification === 'LARGE') {
        setSelectedTarget(null);
        securityService.setSelectedTarget(null);
        if (analysis.projectCandidates.length > 1) {
          // Show project selection modal.
          setMultiProjectModal({
            isOpen: true,
            parentPath: selectedPath,
            candidates: analysis.projectCandidates,
          });
        } else {
          // Broad container / non-project directory with 0 or 1 candidate
          setTooBroadModal({
            isOpen: true,
            path: selectedPath,
            reason: analysis.reason || 'Selected directory is a broad container and not a project root.',
          });
        }
        return;
      }

      // 3. Single project or safe folder
      const candidate = analysis.projectCandidates[0];
      const targetPath = candidate?.path || selectedPath;
      const name = candidate?.name || selectedPath.split(/[/\\]/).pop() || selectedPath;
      const matchedProj = workspace?.projects?.find(
        (p) => p.rootPath.toLowerCase() === targetPath.toLowerCase()
      );
      const newTarget = { name, path: targetPath, id: matchedProj?.id };

      setSelectedTarget(newTarget);
      securityService.setSelectedTarget(newTarget);
      if (matchedProj) {
        updateSession({ selectedProjectId: matchedProj.id });
      } else if (session?.selectedProjectId) {
        updateSession({ selectedProjectId: undefined });
      }
    } catch (e) {
      if (requestIdRef.current !== currentRequestId) {
        return;
      }
      console.error('Target validation failed:', e);
      // Fallback safely if IPC failed: treat as standard folder
      const name = selectedPath.split(/[/\\]/).pop() || selectedPath;
      const matchedProj = workspace?.projects?.find(
        (p) => p.rootPath.toLowerCase() === selectedPath.toLowerCase()
      );
      const newTarget = { name, path: selectedPath, id: matchedProj?.id };
      setSelectedTarget(newTarget);
      securityService.setSelectedTarget(newTarget);
      if (matchedProj) {
        updateSession({ selectedProjectId: matchedProj.id });
      } else if (session?.selectedProjectId) {
        updateSession({ selectedProjectId: undefined });
      }
    }
  };

  const handleChangeTarget = async () => {
    try {
      const selectedPath = await open({
        directory: true,
        multiple: false,
      });
      if (selectedPath && typeof selectedPath === 'string') {
        await validateAndApplyTarget(selectedPath);
      }
    } catch (e) {
      console.error('Failed to open dialog', e);
    }
  };

  const handleSelectMultiProjectCandidate = (candidate: ProjectCandidate) => {
    requestIdRef.current += 1;
    setMultiProjectModal({ isOpen: false, parentPath: '', candidates: [] });
    const matchedProj = workspace?.projects?.find(
      (p) => p.rootPath.toLowerCase() === candidate.path.toLowerCase()
    );
    const newTarget = { name: candidate.name, path: candidate.path, id: matchedProj?.id };
    setSummary(null);
    setFindings([]);
    setStatus('IDLE');
    setScanId(null);
    setProgress({ scannedFiles: 0, currentScanner: '' });
    setSelectedTarget(newTarget);
    securityService.setSelectedTarget(newTarget);
    if (matchedProj) {
      updateSession({ selectedProjectId: matchedProj.id });
    } else if (session?.selectedProjectId) {
      updateSession({ selectedProjectId: undefined });
    }
  };

  const handleReopenFolderPicker = async () => {
    setTooBroadModal({ isOpen: false, path: '' });
    setMultiProjectModal({ isOpen: false, parentPath: '', candidates: [] });
    await handleChangeTarget();
  };

  const handleStartScan = async () => {
    if (!activeTarget) return;

    // Safety guard: prevent scanning blocked filesystem roots
    try {
      const analysis = await invoke<FolderScopeAnalysis>('analyze_folder_scope_cmd', {
        folderPath: activeTarget.path,
      });
      if (analysis.classification === 'BLOCKED') {
        setTooBroadModal({
          isOpen: true,
          path: activeTarget.path,
          reason: analysis.reason,
        });
        return;
      }
      if (analysis.classification === 'LARGE') {
        if (analysis.projectCandidates.length > 1) {
          setMultiProjectModal({
            isOpen: true,
            parentPath: activeTarget.path,
            candidates: analysis.projectCandidates,
          });
        } else {
          setTooBroadModal({
            isOpen: true,
            path: activeTarget.path,
            reason: analysis.reason || 'Selected target is too broad to scan.',
          });
        }
        return;
      }
    } catch (e) {
      console.warn('Pre-scan target validation check warning:', e);
    }

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
          <SecurityActiveFindings 
            findings={findings}
            status={status}
            onRunScan={handleStartScan}
            hasTarget={!!activeTarget}
          />
        )}

        {activeTab === 'history' && (
          <SecurityHistoryList historyRecords={historyRecords} />
        )}
      </div>

      <SecurityTargetTooBroadModal
        isOpen={tooBroadModal.isOpen}
        targetPath={tooBroadModal.path}
        reason={tooBroadModal.reason}
        onClose={() => setTooBroadModal({ isOpen: false, path: '' })}
        onChooseFolder={handleReopenFolderPicker}
      />

      <SecurityMultiProjectModal
        isOpen={multiProjectModal.isOpen}
        parentPath={multiProjectModal.parentPath}
        candidates={multiProjectModal.candidates}
        onClose={() => setMultiProjectModal({ isOpen: false, parentPath: '', candidates: [] })}
        onSelectProject={handleSelectMultiProjectCandidate}
        onChangeFolder={handleReopenFolderPicker}
      />
    </div>
  );
}

