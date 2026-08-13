import { useState, useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/Icon';
import { EventDetailDrawer, AuditEventDetail } from './EventDetailDrawer';

interface SecuritySummary {
  allowedCount: number;
  approvalRequiredCount: number;
  deniedCount: number;
  approvedCount?: number;
  rejectedCount?: number;
}

interface PipelineHistorySummary {
  pipelineId: string;
  pipelineName: string;
  latestVersion: number;
  latestStatus: string;
  createdAtMs: number;
  updatedAtMs: number;
  providerId?: string;
  modelName?: string;
  securitySummary: SecuritySummary;
  totalEvents: number;
}

interface PipelineVersionRecord {
  pipelineId: string;
  version: number;
  name: string;
  description?: string;
  trigger: string;
  created_at_ms: number;
  sourceType: string;
  promptReference?: string;
  providerId?: string;
  modelName?: string;
  fingerprint: string;
}

interface PipelineDetailHistory {
  pipelineId: string;
  versions: PipelineVersionRecord[];
  events: AuditEventDetail[];
}

interface StepDiff {
  stepId: string;
  stepName: string;
  diffType: 'added' | 'removed' | 'modified' | 'unchanged';
  oldCommand?: string;
  newCommand?: string;
  oldArgs: string[];
  newArgs: string[];
  securityChanged: boolean;
}

interface VersionDiff {
  pipelineId: string;
  v1: number;
  v2: number;
  addedStages: string[];
  removedStages: string[];
  stepDiffs: StepDiff[];
  hasSecurityChanges: boolean;
}

export function PipelineHistory() {
  const [summaries, setSummaries] = useState<PipelineHistorySummary[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PipelineDetailHistory | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<AuditEventDetail | null>(null);
  
  // Filter States
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('ALL');
  const [actorFilter, setActorFilter] = useState<string>('ALL');
  const [versionFilter, setVersionFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Compare Modal State
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [v1Compare, setV1Compare] = useState<number>(1);
  const [v2Compare, setV2Compare] = useState<number>(2);
  const [diffResult, setDiffResult] = useState<VersionDiff | null>(null);

  const fetchSummaries = async () => {
    setLoading(true);
    try {
      const data = await invoke<PipelineHistorySummary[]>('list_pipeline_history_cmd');
      setSummaries(data);
    } catch (err) {
      console.error('Failed to fetch pipeline history summaries:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummaries();

    const handleStatusChanged = () => {
      fetchSummaries();
      if (selectedPipelineId) {
        handleSelectPipeline(selectedPipelineId);
      }
    };

    window.addEventListener('pipeline:approval-status-changed', handleStatusChanged);
    window.addEventListener('pipeline:history-updated', handleStatusChanged);
    return () => {
      window.removeEventListener('pipeline:approval-status-changed', handleStatusChanged);
      window.removeEventListener('pipeline:history-updated', handleStatusChanged);
    };
  }, [selectedPipelineId]);

  const handleSelectPipeline = async (pipelineId: string) => {
    setSelectedPipelineId(pipelineId);
    setLoading(true);
    try {
      const data = await invoke<PipelineDetailHistory>('get_pipeline_history_cmd', { pipelineId });
      setDetail(data);
      if (data.versions.length >= 2) {
        setV1Compare(data.versions[0].version);
        setV2Compare(data.versions[data.versions.length - 1].version);
      }
    } catch (err) {
      console.error('Failed to fetch pipeline detail history:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRunCompare = async () => {
    if (!selectedPipelineId) return;
    try {
      const diff = await invoke<VersionDiff>('compare_pipeline_versions_cmd', {
        pipelineId: selectedPipelineId,
        v1: v1Compare,
        v2: v2Compare,
      });
      setDiffResult(diff);
      setCompareModalOpen(true);
    } catch (err) {
      console.error('Failed to compare pipeline versions:', err);
    }
  };

  const formatTimestamp = (ms: number) => {
    if (!ms) return 'N/A';
    return new Date(ms).toLocaleString();
  };

  const getActorBadge = (actor?: string) => {
    switch (actor) {
      case 'AI':
        return <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">AI</span>;
      case 'USER':
        return <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">USER</span>;
      case 'POLICY_ENGINE':
        return <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">POLICY</span>;
      case 'EXECUTOR':
        return <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">EXECUTOR</span>;
      case 'SYSTEM':
        return <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-gray-500/10 text-gray-400 border border-gray-500/20">SYSTEM</span>;
      default:
        return <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">UNKNOWN</span>;
    }
  };

  const getEventBadge = (type: string) => {
    switch (type) {
      case 'PIPELINE_GENERATED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">GENERATED</span>;
      case 'POLICY_EVALUATED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">POLICY EVAL</span>;
      case 'APPROVAL_REQUESTED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">APPROVAL REQ</span>;
      case 'APPROVAL_APPROVED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-green-500/10 text-green-400 border border-green-500/20">APPROVED</span>;
      case 'APPROVAL_REJECTED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20">REJECTED</span>;
      case 'APPROVAL_EXPIRED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-orange-500/10 text-orange-400 border border-orange-500/20">EXPIRED</span>;
      case 'APPROVAL_REVOKED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">REVOKED</span>;
      case 'APPROVAL_CONSUMED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">CONSUMED</span>;
      case 'EXPORT_REQUESTED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">EXPORT REQ</span>;
      case 'EXPORT_AUTHORIZED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">EXPORT AUTH</span>;
      case 'PIPELINE_EXPORTED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">EXPORTED</span>;
      case 'EXPORT_FAILED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20">EXPORT FAIL</span>;
      case 'PIPELINE_EXECUTION_STARTED':
      case 'EXECUTION_STARTED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">EXEC STARTED</span>;
      case 'PIPELINE_EXECUTION_COMPLETED':
      case 'EXECUTION_SUCCEEDED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">EXEC SUCCEEDED</span>;
      case 'PIPELINE_EXECUTION_FAILED':
      case 'EXECUTION_FAILED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20">EXEC FAILED</span>;
      case 'STEP_STARTED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">STEP START</span>;
      case 'STEP_SUCCEEDED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-green-500/10 text-green-400 border border-green-500/20">STEP PASS</span>;
      case 'STEP_FAILED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20">STEP FAIL</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-500/10 text-gray-400 border border-gray-500/20">{type}</span>;
    }
  };

  // Filtered Events Calculation
  const filteredEvents = useMemo(() => {
    if (!detail) return [];
    return detail.events.filter((evt) => {
      // Event Type Filter
      if (eventTypeFilter !== 'ALL') {
        if (eventTypeFilter === 'APPROVAL' && !evt.eventType.startsWith('APPROVAL_')) return false;
        if (eventTypeFilter === 'EXPORT' && !evt.eventType.includes('EXPORT')) return false;
        if (eventTypeFilter === 'EXECUTION' && !evt.eventType.includes('EXEC')) return false;
        if (eventTypeFilter === 'POLICY' && !evt.eventType.includes('POLICY')) return false;
      }
      // Actor Filter
      if (actorFilter !== 'ALL' && (evt.actor || 'UNKNOWN') !== actorFilter) return false;
      // Version Filter
      if (versionFilter !== 'ALL' && evt.pipelineVersion !== Number(versionFilter)) return false;
      // Approval Status Filter
      if (statusFilter !== 'ALL') {
        const state = evt.newState || evt.eventType;
        if (statusFilter === 'APPROVED' && !state.includes('APPROVED')) return false;
        if (statusFilter === 'REJECTED' && !state.includes('REJECTED')) return false;
        if (statusFilter === 'PENDING' && !state.includes('REQUESTED') && !state.includes('PENDING')) return false;
        if (statusFilter === 'EXPIRED' && !state.includes('EXPIRED')) return false;
        if (statusFilter === 'REVOKED' && !state.includes('REVOKED')) return false;
      }
      // Text Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const text = `${evt.summary} ${evt.eventId} ${evt.stepId || ''} ${evt.approvalId || ''} ${evt.executionId || ''} ${evt.reasonCode || ''} ${evt.commandFingerprint || ''}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [detail, eventTypeFilter, actorFilter, versionFilter, statusFilter, searchQuery]);

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* Compact History Toolbar */}
      <div className="flex items-center justify-between shrink-0 pb-2">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-1.5">
            <Icon name="History" className="text-primary" size={16} />
            Pipeline Security Audit Trail
          </h2>
          <span className="text-[11px] text-muted-foreground hidden sm:inline border-l border-border/40 pl-3">
            Immutable append-only audit trail
          </span>
        </div>
        <Button variant="outline" size="sm" onClick={fetchSummaries} disabled={loading} className="gap-1.5 text-xs h-7">
          <Icon name="RefreshCw" size={13} className={loading ? 'animate-spin' : ''} />
          Refresh Audit Trail
        </Button>
      </div>

      {/* Main Workspace Grid (Fixed Height Viewport Container) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0 overflow-hidden">
        {/* Left Column: Recorded Pipelines List (Internal Scroll Only) */}
        <div className="lg:col-span-1 flex flex-col min-h-0 border border-border/40 rounded-xl bg-card/60 p-3 overflow-hidden">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/30 shrink-0">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Icon name="FileText" size={14} />
              Recorded Pipelines
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-muted text-muted-foreground">
              {summaries.length}
            </span>
          </div>
          
          {summaries.length === 0 ? (
            <Card className="p-6 text-center text-muted-foreground text-xs my-auto">
              No pipeline history recorded yet. Generate a pipeline using AI to start auditing.
            </Card>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
              {summaries.map((summary) => (
                <div
                  key={summary.pipelineId}
                  onClick={() => handleSelectPipeline(summary.pipelineId)}
                  className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                    selectedPipelineId === summary.pipelineId
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border/40 bg-card hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-foreground truncate max-w-[170px]">{summary.pipelineName}</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-primary/10 text-primary border border-primary/20">
                      v{summary.latestVersion}
                    </span>
                  </div>

                  <div className="text-[10px] text-muted-foreground font-mono truncate mb-1.5">
                    {summary.pipelineId}
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-muted-foreground border-t border-border/20 pt-1.5 mt-1.5">
                    <div className="flex flex-wrap items-center gap-1 font-mono">
                      <span className="text-green-400 font-semibold">{summary.securitySummary.allowedCount} Allowed</span>
                      {summary.securitySummary.approvedCount ? summary.securitySummary.approvedCount > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-emerald-400 font-semibold">{summary.securitySummary.approvedCount} Appr</span>
                        </>
                      ) : null}
                      {summary.securitySummary.approvalRequiredCount > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-amber-400 font-semibold">{summary.securitySummary.approvalRequiredCount} Req</span>
                        </>
                      )}
                      {summary.securitySummary.rejectedCount ? summary.securitySummary.rejectedCount > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-red-400 font-semibold">{summary.securitySummary.rejectedCount} Rej</span>
                        </>
                      ) : null}
                    </div>
                    <span>{summary.totalEvents} evts</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Pipeline Detail & Audit Timeline (Main Vertical Space Owner) */}
        <div className="lg:col-span-2 flex flex-col min-h-0 border border-border/40 rounded-xl bg-card/60 p-3 overflow-hidden">
          {!selectedPipelineId || !detail ? (
            <div className="p-6 h-full text-center text-muted-foreground flex flex-col items-center justify-center border border-border/40 rounded-xl bg-card/60">
              <Icon name="Shield" size={32} className="text-muted-foreground/40 mb-2" />
              <p className="text-xs font-medium">Select a pipeline from the list to inspect its security audit trail.</p>
            </div>
          ) : (
            <div className="flex flex-col flex-1 min-h-0 space-y-3">
              {/* Detail Header */}
              <div className="flex items-center justify-between pb-2 border-b border-border/30 shrink-0">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-foreground">
                      {detail.versions[detail.versions.length - 1]?.name || selectedPipelineId}
                    </h3>
                    <span className="px-2 py-0.5 rounded text-xs font-mono bg-primary/10 text-primary border border-primary/20">
                      Latest: v{detail.versions[detail.versions.length - 1]?.version}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-muted-foreground">ID: {selectedPipelineId}</span>
                </div>

                {detail.versions.length >= 2 && (
                  <Button variant="outline" size="sm" onClick={handleRunCompare} className="gap-1.5 text-xs h-7">
                    <Icon name="GitCompare" size={13} />
                    Compare Versions
                  </Button>
                )}
              </div>

              {/* Compact Version Snapshots Pill Bar */}
              <div className="shrink-0">
                <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                    Versions ({detail.versions.length}):
                  </span>
                  {detail.versions.map((ver) => (
                    <div
                      key={ver.version}
                      className="px-2 py-1 rounded bg-muted/40 border border-border/30 text-[11px] flex items-center gap-1.5 whitespace-nowrap shrink-0"
                    >
                      <span className="font-semibold font-mono text-primary">v{ver.version}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">{formatTimestamp(ver.created_at_ms)}</span>
                      <span className="text-[9px] px-1 rounded bg-background border border-border/40 text-muted-foreground font-mono">
                        {ver.sourceType}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Compact Filter Toolbar */}
              <div className="shrink-0 p-2 rounded-lg bg-muted/20 border border-border/30 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <select
                    value={eventTypeFilter}
                    onChange={(e) => setEventTypeFilter(e.target.value)}
                    className="bg-background border border-border/40 rounded px-2 py-1 text-[11px] text-foreground font-mono"
                  >
                    <option value="ALL">All Event Types</option>
                    <option value="APPROVAL">Approval Events</option>
                    <option value="EXPORT">Export Events</option>
                    <option value="EXECUTION">Execution Events</option>
                    <option value="POLICY">Policy Events</option>
                  </select>

                  <select
                    value={actorFilter}
                    onChange={(e) => setActorFilter(e.target.value)}
                    className="bg-background border border-border/40 rounded px-2 py-1 text-[11px] text-foreground font-mono"
                  >
                    <option value="ALL">All Actors</option>
                    <option value="AI">AI</option>
                    <option value="USER">USER</option>
                    <option value="POLICY_ENGINE">POLICY_ENGINE</option>
                    <option value="EXECUTOR">EXECUTOR</option>
                    <option value="SYSTEM">SYSTEM</option>
                    <option value="UNKNOWN">UNKNOWN</option>
                  </select>

                  <select
                    value={versionFilter}
                    onChange={(e) => setVersionFilter(e.target.value)}
                    className="bg-background border border-border/40 rounded px-2 py-1 text-[11px] text-foreground font-mono"
                  >
                    <option value="ALL">All Versions</option>
                    {detail.versions.map(v => (
                      <option key={v.version} value={v.version}>v{v.version}</option>
                    ))}
                  </select>

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-background border border-border/40 rounded px-2 py-1 text-[11px] text-foreground font-mono"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="APPROVED">Approved</option>
                    <option value="REJECTED">Rejected</option>
                    <option value="PENDING">Pending</option>
                    <option value="EXPIRED">Expired</option>
                    <option value="REVOKED">Revoked</option>
                  </select>

                  <div className="relative flex-1 min-w-[150px]">
                    <Icon name="Search" size={13} className="absolute left-2 top-1.5 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search step, ID, summary..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-background border border-border/40 rounded pl-7 pr-2 py-0.5 text-[11px] text-foreground font-mono focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>
              </div>

              {/* Audit Event Timeline (Primary Vertical Space Owner with Internal Scroll) */}
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="flex items-center justify-between mb-2 shrink-0">
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Icon name="Clock" size={13} />
                    Audit Event Timeline ({filteredEvents.length} / {detail.events.length})
                  </h4>
                </div>

                {filteredEvents.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-xs bg-muted/10 rounded-lg border border-dashed border-border/40 my-auto">
                    No audit events match the selected filters.
                  </div>
                ) : (
                  <div className="flex-1 min-h-0 overflow-y-auto relative pl-5 border-l-2 border-border/40 space-y-2 pr-1">
                    {filteredEvents.map((evt) => (
                      <div key={evt.eventId} className="relative group cursor-pointer" onClick={() => setSelectedEvent(evt)}>
                        <div className="absolute -left-[27px] top-1.5 w-2.5 h-2.5 rounded-full bg-primary ring-4 ring-background" />

                        <div className="p-2.5 rounded-lg bg-card border border-border/40 hover:border-primary/50 transition-all space-y-1 text-xs shadow-sm">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              {getEventBadge(evt.eventType)}
                              {getActorBadge(evt.actor)}
                              <span className="font-mono text-[9px] text-muted-foreground">v{evt.pipelineVersion}</span>
                              <span className="font-mono text-[9px] text-muted-foreground">#{evt.sequenceNumber ?? 0}</span>
                            </div>
                            <span className="text-[9px] text-muted-foreground font-mono">
                              {formatTimestamp(evt.timestampMs)}
                            </span>
                          </div>

                          <p className="text-foreground font-medium text-[11px] flex items-center justify-between">
                            <span className="truncate max-w-[90%]">{evt.summary}</span>
                            <Icon name="ChevronRight" size={13} className="text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                          </p>

                          <div className="flex flex-wrap gap-1.5 text-[9px] font-mono text-muted-foreground pt-0.5">
                            {evt.stepId && (
                              <span className="bg-muted/50 px-1 py-0.5 rounded">Step: {evt.stepId}</span>
                            )}
                            {evt.approvalId && (
                              <span className="bg-amber-500/10 text-amber-400 px-1 py-0.5 rounded">Approval: {evt.approvalId}</span>
                            )}
                            {evt.executionId && (
                              <span className="bg-blue-500/10 text-blue-400 px-1 py-0.5 rounded">Exec: {evt.executionId}</span>
                            )}
                            {evt.commandFingerprint && (
                              <span className="bg-purple-500/10 text-purple-400 px-1 py-0.5 rounded">fp:{evt.commandFingerprint.slice(0, 8)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Read-Only Event Detail Drawer */}
      <EventDetailDrawer event={selectedEvent} onClose={() => setSelectedEvent(null)} />

      {/* Version Comparison Modal */}
      {compareModalOpen && diffResult && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl max-w-3xl w-full max-h-[80vh] flex flex-col shadow-2xl">
            <div className="p-3 border-b border-border/40 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-foreground flex items-center gap-2 text-sm">
                  <Icon name="GitCompare" className="text-primary" size={16} />
                  Version Comparison: v{diffResult.v1} ↔ v{diffResult.v2}
                </h3>
                <p className="text-[10px] text-muted-foreground font-mono">Pipeline: {diffResult.pipelineId}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setCompareModalOpen(false)} className="h-7 w-7 p-0">
                <Icon name="X" size={14} />
              </Button>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto flex-1 text-xs">
              {diffResult.hasSecurityChanges && (
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center gap-2 font-medium text-[11px]">
                  <Icon name="AlertTriangle" size={15} />
                  Security-Relevant Command / Step Changes Detected Between Versions
                </div>
              )}

              {/* Stage differences */}
              {(diffResult.addedStages.length > 0 || diffResult.removedStages.length > 0) && (
                <div className="space-y-1">
                  <h4 className="font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">Stage Changes</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {diffResult.addedStages.map(s => (
                      <span key={s} className="px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20 font-mono text-[10px]">
                        + Added Stage: {s}
                      </span>
                    ))}
                    {diffResult.removedStages.map(s => (
                      <span key={s} className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 font-mono text-[10px]">
                        - Removed Stage: {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Step Diffs */}
              <div className="space-y-1.5">
                <h4 className="font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">Step Differences</h4>
                {diffResult.stepDiffs.map((sd) => (
                  <div
                    key={sd.stepId}
                    className={`p-2.5 rounded border font-mono text-[11px] ${
                      sd.diffType === 'added'
                        ? 'border-green-500/30 bg-green-500/5'
                        : sd.diffType === 'removed'
                        ? 'border-red-500/30 bg-red-500/5'
                        : sd.diffType === 'modified'
                        ? 'border-amber-500/30 bg-amber-500/5'
                        : 'border-border/30 bg-muted/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-foreground">{sd.stepName} ({sd.stepId})</span>
                      <span className={`uppercase font-semibold text-[9px] px-1.5 py-0.5 rounded ${
                        sd.diffType === 'added' ? 'bg-green-500/20 text-green-400' :
                        sd.diffType === 'removed' ? 'bg-red-500/20 text-red-400' :
                        sd.diffType === 'modified' ? 'bg-amber-500/20 text-amber-400' : 'bg-gray-500/20 text-gray-400'
                      }`}>
                        {sd.diffType}
                      </span>
                    </div>

                    {sd.oldCommand && (
                      <div className="text-[10px] text-red-400">
                        - v{diffResult.v1}: {sd.oldCommand} {sd.oldArgs.join(' ')}
                      </div>
                    )}
                    {sd.newCommand && (
                      <div className="text-[10px] text-green-400">
                        + v{diffResult.v2}: {sd.newCommand} {sd.newArgs.join(' ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="p-2.5 border-t border-border/40 flex justify-end">
              <Button size="sm" variant="outline" onClick={() => setCompareModalOpen(false)} className="h-7 text-xs">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
