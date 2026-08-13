import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/Icon';

export interface AuditEventDetail {
  eventId: string;
  sequenceNumber?: number;
  pipelineId: string;
  pipelineVersion: number;
  eventType: string;
  actor?: string;
  timestampMs: number;
  stageId?: string;
  stepId?: string;
  approvalId?: string;
  executionId?: string;
  commandFingerprint?: string;
  previousState?: string;
  newState?: string;
  reasonCode?: string;
  reason?: string;
  policyCode?: string;
  summary: string;
  metadata: Record<string, string>;
}

interface EventDetailDrawerProps {
  event: AuditEventDetail | null;
  onClose: () => void;
}

export function EventDetailDrawer({ event, onClose }: EventDetailDrawerProps) {
  const [copiedFingerprint, setCopiedFingerprint] = useState(false);
  const [showFullFingerprint, setShowFullFingerprint] = useState(false);

  if (!event) return null;

  const handleCopyFingerprint = () => {
    if (event.commandFingerprint) {
      navigator.clipboard.writeText(event.commandFingerprint);
      setCopiedFingerprint(true);
      setTimeout(() => setCopiedFingerprint(false), 2000);
    }
  };

  const formatTimestamp = (ms: number) => {
    if (!ms) return 'N/A';
    return new Date(ms).toLocaleString();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end">
      <div className="bg-card border-l border-border w-full max-w-xl h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b border-border/40 flex items-center justify-between bg-muted/20">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-primary/10 text-primary border border-primary/20">
                {event.eventType}
              </span>
              <span className="text-xs font-mono text-muted-foreground">
                #{event.sequenceNumber ?? '0'}
              </span>
            </div>
            <h3 className="font-bold text-foreground text-sm mt-1">{event.summary}</h3>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose} className="h-8 w-8 p-0">
            <Icon name="X" size={16} />
          </Button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-6 overflow-y-auto flex-1 text-xs">
          {/* Core System Identifiers */}
          <div className="space-y-2">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Icon name="Shield" size={14} /> Core Audit Metadata
            </h4>
            <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-muted/30 border border-border/30 font-mono">
              <div>
                <span className="text-muted-foreground block text-[10px]">Event ID</span>
                <span className="text-foreground font-semibold truncate block">{event.eventId}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px]">Actor Provenance</span>
                <span className="text-primary font-bold">{event.actor || 'UNKNOWN'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px]">Timestamp</span>
                <span className="text-foreground">{formatTimestamp(event.timestampMs)}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px]">Sequence No.</span>
                <span className="text-foreground font-semibold">#{event.sequenceNumber ?? 0}</span>
              </div>
            </div>
          </div>

          {/* Pipeline Scoped Identifiers */}
          <div className="space-y-2">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Icon name="Layers" size={14} /> Scoped Identity Context
            </h4>
            <div className="space-y-1.5 p-3 rounded-lg bg-muted/30 border border-border/30 font-mono">
              <div className="flex justify-between items-center py-1 border-b border-border/20">
                <span className="text-muted-foreground">Pipeline ID</span>
                <span className="text-foreground font-semibold">{event.pipelineId}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-border/20">
                <span className="text-muted-foreground">Pipeline Version</span>
                <span className="text-primary font-bold">v{event.pipelineVersion}</span>
              </div>
              {event.stageId && (
                <div className="flex justify-between items-center py-1 border-b border-border/20">
                  <span className="text-muted-foreground">Stage ID</span>
                  <span className="text-foreground">{event.stageId}</span>
                </div>
              )}
              {event.stepId && (
                <div className="flex justify-between items-center py-1 border-b border-border/20">
                  <span className="text-muted-foreground">Step ID</span>
                  <span className="text-foreground">{event.stepId}</span>
                </div>
              )}
              {event.approvalId && (
                <div className="flex justify-between items-center py-1 border-b border-border/20">
                  <span className="text-amber-500 font-semibold">Approval ID</span>
                  <span className="text-amber-400 font-bold">{event.approvalId}</span>
                </div>
              )}
              {event.executionId && (
                <div className="flex justify-between items-center py-1">
                  <span className="text-blue-500 font-semibold">Execution ID</span>
                  <span className="text-blue-400 font-bold">{event.executionId}</span>
                </div>
              )}
            </div>
          </div>

          {/* Security & Command Fingerprint */}
          {event.commandFingerprint && (
            <div className="space-y-2">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Icon name="Key" size={14} /> Cryptographic Command Fingerprint
              </h4>
              <div className="p-3 rounded-lg bg-card border border-border/40 font-mono space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">SHA-256 Digest</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowFullFingerprint(!showFullFingerprint)}
                      className="text-[10px] text-primary hover:underline"
                    >
                      {showFullFingerprint ? 'Collapse' : 'Show Full'}
                    </button>
                    <button
                      onClick={handleCopyFingerprint}
                      className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                    >
                      <Icon name={copiedFingerprint ? 'Check' : 'Copy'} size={12} />
                      {copiedFingerprint ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-foreground font-semibold break-all bg-muted/40 p-2 rounded">
                  {showFullFingerprint
                    ? event.commandFingerprint
                    : `${event.commandFingerprint.slice(0, 16)}...${event.commandFingerprint.slice(-16)}`}
                </p>
              </div>
            </div>
          )}

          {/* Lifecycle State Transition & Reason */}
          {(event.previousState || event.newState || event.reasonCode || event.reason) && (
            <div className="space-y-2">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Icon name="Activity" size={14} /> Lifecycle State Transition & Policy
              </h4>
              <div className="p-3 rounded-lg bg-card border border-border/40 space-y-2">
                {(event.previousState || event.newState) && (
                  <div className="flex items-center gap-2 font-mono">
                    <span className="px-2 py-0.5 rounded bg-muted/60 text-muted-foreground text-[10px]">
                      {event.previousState || 'NONE'}
                    </span>
                    <Icon name="ArrowRight" size={12} className="text-muted-foreground" />
                    <span className="px-2 py-0.5 rounded bg-primary/20 text-primary font-bold text-[10px]">
                      {event.newState || 'UNKNOWN'}
                    </span>
                  </div>
                )}

                {event.reasonCode && (
                  <div className="text-[11px]">
                    <span className="text-muted-foreground">Reason Code: </span>
                    <span className="font-mono font-semibold text-foreground">{event.reasonCode}</span>
                  </div>
                )}

                {event.policyCode && (
                  <div className="text-[11px]">
                    <span className="text-muted-foreground">Policy Code: </span>
                    <span className="font-mono font-semibold text-amber-400">{event.policyCode}</span>
                  </div>
                )}

                {event.reason && (
                  <div className="text-[11px] text-foreground bg-muted/30 p-2 rounded mt-1">
                    {event.reason}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sanitized Metadata */}
          {Object.keys(event.metadata || {}).length > 0 && (
            <div className="space-y-2">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Icon name="FileText" size={14} /> Event Metadata
              </h4>
              <div className="p-3 rounded-lg bg-card border border-border/40 font-mono space-y-1">
                {Object.entries(event.metadata).map(([k, v]) => (
                  <div key={k} className="flex justify-between items-center py-0.5 text-[11px]">
                    <span className="text-muted-foreground">{k}:</span>
                    <span className="text-foreground truncate max-w-[280px] font-medium">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border/40 flex justify-end bg-muted/20">
          <Button size="sm" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
