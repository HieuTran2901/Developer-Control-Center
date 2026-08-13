import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { invoke } from '@tauri-apps/api/core';
import { usePipelineContext } from '../context/PipelineContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/Icon';

interface ApprovalPayload {
  executionId: string;
  stepId: string;
  approvalId: string;
  actionFingerprint: string;
  prompt: string;
  pipeline?: any;
  platform?: string;
}

export function PolicyApprovalDialog() {
  const { approveStep } = usePipelineContext();
  const [open, setOpen] = useState(false);
  const [payload, setPayload] = useState<ApprovalPayload | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const handleApprovalRequired = (e: Event) => {
      const customEvent = e as CustomEvent<ApprovalPayload>;
      setPayload(customEvent.detail);
      setOpen(true);
    };

    window.addEventListener('pipeline:approval-required', handleApprovalRequired);
    return () => {
      window.removeEventListener('pipeline:approval-required', handleApprovalRequired);
    };
  }, []);

  useEffect(() => {
    if (open && payload?.approvalId) {
      setLoading(true);
      setError('');
      setDetail(null);
      invoke('get_approval', { approvalId: payload.approvalId })
        .then((res: any) => {
          setDetail(res);
        })
        .catch((err: any) => {
          console.error("Failed to fetch approval details:", err);
          setError(err.toString());
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [open, payload]);

  const handleApprove = async () => {
    if (payload) {
      setSubmitting(true);
      try {
        await approveStep(payload.approvalId, true);
        window.dispatchEvent(new CustomEvent('pipeline:approval-status-changed', {
          detail: { approvalId: payload.approvalId, status: 'APPROVED' }
        }));
        setOpen(false);
        setPayload(null);
      } catch (err: any) {
        setError(err.toString());
      } finally {
        setSubmitting(false);
      }
    }
  };

  const handleDeny = async () => {
    if (payload) {
      setSubmitting(true);
      try {
        await approveStep(payload.approvalId, false);
        window.dispatchEvent(new CustomEvent('pipeline:approval-status-changed', {
          detail: { approvalId: payload.approvalId, status: 'REJECTED' }
        }));
        setOpen(false);
        setPayload(null);
      } catch (err: any) {
        setError(err.toString());
      } finally {
        setSubmitting(false);
      }
    }
  };

  const handleRequestNewApproval = async () => {
    if (payload?.approvalId && payload?.pipeline) {
      setLoading(true);
      setError('');
      try {
        const oldId = payload.approvalId;
        const newApp: any = await invoke('request_new_approval', {
          oldApprovalId: oldId,
          pipeline: payload.pipeline,
          stepId: payload.stepId,
          platform: payload.platform || null,
        });

        window.dispatchEvent(new CustomEvent('pipeline:approval-renewed', {
          detail: {
            oldApprovalId: oldId,
            newApprovalId: newApp.approvalId,
            status: 'PENDING'
          }
        }));
        
        setPayload(prev => prev ? {
          ...prev,
          approvalId: newApp.approvalId,
          prompt: newApp.prompt,
          actionFingerprint: newApp.actionFingerprint
        } : null);
      } catch (err: any) {
        console.error("Failed to request new approval:", err);
        setError(err.toString());
      } finally {
        setLoading(false);
      }
    }
  };

  if (!open || !payload) return null;

  const isExpired = detail && detail.status === 'EXPIRED';
  const isRevoked = detail && detail.status === 'REVOKED';
  const isConsumed = detail && detail.status === 'CONSUMED';
  const isRejected = detail && detail.status === 'REJECTED';
  const canDecide = detail && detail.status === 'PENDING' && !submitting;
  const canRequestNew = (isExpired || isRevoked || isRejected || isConsumed) && payload.pipeline;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-4">
      <Card className="w-full max-w-2xl shadow-xl border-orange-500/30 bg-card/95 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200">
        <CardHeader className="border-b border-border/40 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-orange-500">
              <Icon name="ShieldAlert" size={24} className="animate-pulse" />
              <CardTitle className="text-xl">Security Approval Review</CardTitle>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setOpen(false); setPayload(null); }} disabled={submitting}>
              <Icon name="X" size={18} />
            </Button>
          </div>
          <CardDescription className="pt-1">
            DCC Policy Engine intercepted a high-risk operation requiring explicit operator verification.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="pt-6 space-y-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Icon name="Loader2" size={32} className="animate-spin text-orange-500" />
              <span className="text-sm text-muted-foreground font-medium">Retrieving cryptographic context...</span>
            </div>
          )}

          {error && (
            <div className="p-3 text-sm text-red-500 bg-red-500/10 rounded-lg border border-red-500/20 flex gap-2 items-center">
              <Icon name="AlertTriangle" size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {detail && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">Pipeline Context</span>
                    <span className="text-sm font-semibold text-foreground">{detail.pipelineId || 'Global / Export Scope'}</span>
                  </div>
                  
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">Step Identity</span>
                    <span className="text-sm font-medium text-foreground">{detail.stepName || 'N/A'} <span className="font-mono text-xs text-muted-foreground">({detail.stepId})</span></span>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">Risk Rating</span>
                    <div className="flex items-center gap-1.5 pt-0.5">
                      {detail.riskLevel === 'Critical' || detail.riskLevel === 'High' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-500 border border-red-500/20">
                          <Icon name="AlertOctagon" size={10} />
                          {detail.riskLevel.toUpperCase()} RISK
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                          <Icon name="AlertTriangle" size={10} />
                          {detail.riskLevel.toUpperCase()} RISK
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">Policy Reason Code</span>
                    <span className="text-xs font-mono text-foreground break-all bg-muted/50 px-2 py-1 rounded border border-border/40 w-fit">
                      {detail.reasonCode}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">Action Type</span>
                    <span className="text-sm font-medium text-foreground">{detail.actionType}</span>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">Approval Status</span>
                    <div className="pt-0.5">
                      {detail.status === 'PENDING' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                          <Icon name="Clock" size={10} />
                          PENDING OPERATOR REVIEW
                        </span>
                      )}
                      {detail.status === 'APPROVED' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/10 text-green-500 border border-green-500/20">
                          <Icon name="Check" size={10} />
                          APPROVED BY {detail.approvedBy}
                        </span>
                      )}
                      {detail.status === 'REJECTED' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-500 border border-red-500/20">
                          <Icon name="X" size={10} />
                          REJECTED BY {detail.rejectedBy}
                        </span>
                      )}
                      {detail.status === 'EXPIRED' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-muted text-muted-foreground border border-border/60">
                          <Icon name="Hourglass" size={10} />
                          EXPIRED
                        </span>
                      )}
                      {detail.status === 'CONSUMED' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20">
                          <Icon name="CheckCircle" size={10} />
                          CONSUMED
                        </span>
                      )}
                      {detail.status === 'REVOKED' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/30">
                          <Icon name="AlertTriangle" size={10} />
                          REVOKED / INVALIDATED
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">Approval Expiration</span>
                    <span className="text-xs text-foreground font-medium">
                      {isExpired ? 'Expired' : new Date(detail.expiresAtMs).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Exact Command Details */}
              <div className="space-y-1.5">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">Exact Target Command / Configuration</span>
                <div className="bg-muted/60 border border-border/50 rounded-lg p-3 font-mono text-xs text-foreground max-h-[160px] overflow-y-auto">
                  {detail.command ? (
                    <div className="space-y-1">
                      <div className="text-green-400 font-bold">{detail.command}</div>
                      {detail.args && detail.args.length > 0 && (
                        <div className="pl-4 text-muted-foreground space-y-0.5">
                          {detail.args.map((arg: string, idx: number) => (
                            <div key={idx} className="break-all">{arg}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="italic text-muted-foreground">
                      No direct shell execution payload (Action: {detail.actionType})
                    </div>
                  )}
                </div>
              </div>

              {/* Specific Status Warnings */}
              {isExpired && (
                <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg flex gap-2.5 items-center">
                  <Icon name="Hourglass" size={16} className="text-amber-500 shrink-0" />
                  <div className="text-xs text-amber-500/90 font-medium">
                    Approval expired. Execution is blocked until a new approval is issued.
                  </div>
                </div>
              )}
              {isRevoked && (
                <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-lg flex gap-2.5 items-center">
                  <Icon name="AlertOctagon" size={16} className="text-red-500 shrink-0" />
                  <div className="text-xs text-red-400 font-medium">
                    Approval revoked / invalidated. Step configuration was modified after request creation.
                  </div>
                </div>
              )}
              {isConsumed && (
                <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg flex gap-2.5 items-center">
                  <Icon name="CheckCircle" size={16} className="text-blue-500 shrink-0" />
                  <div className="text-xs text-blue-400 font-medium">
                    Authorization has already been consumed.
                  </div>
                </div>
              )}
              {isRejected && (
                <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-lg flex gap-2.5 items-center">
                  <Icon name="XCircle" size={16} className="text-red-500 shrink-0" />
                  <div className="text-xs text-red-500/90 font-medium">
                    Action rejected.
                  </div>
                </div>
              )}

              {/* Security Warning Badge */}
              <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-lg flex gap-2.5 items-start">
                <Icon name="AlertTriangle" size={16} className="text-red-500 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed text-muted-foreground">
                  <span className="font-bold text-red-500/80">CRYPTOGRAPHIC BINDING WARNING:</span> This approval review binds cryptographically via SHA-256 fingerprint to the exact command and arguments displayed above. Any modifications to this script or pipeline config will immediately void this authorization and block execution.
                </div>
              </div>
            </div>
          )}
        </CardContent>
        
        <CardFooter className="flex justify-between border-t border-border/40 pt-4">
          <div>
            {canRequestNew && (
              <Button onClick={handleRequestNewApproval} disabled={loading || submitting} className="bg-amber-600 hover:bg-amber-700 text-white font-medium">
                <Icon name="RefreshCw" size={16} className="mr-2" />
                Request New Approval
              </Button>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleDeny} disabled={!canDecide} className="border-red-500/20 text-red-500 hover:bg-red-500/10 disabled:opacity-40">
              <Icon name="X" size={16} className="mr-2" />
              Reject Action
            </Button>
            <Button onClick={handleApprove} disabled={!canDecide} className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-40">
              <Icon name="Check" size={16} className="mr-2" />
              Authorize Execution
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>,
    document.body
  );
}
