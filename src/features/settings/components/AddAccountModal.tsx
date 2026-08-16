import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/Icon';
import { AccountMonitorConfig } from '@/domain/entities/QuotaPolling';
import { QuotaProviderId } from '@/domain/entities/QuotaProvider';

interface AddAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddAccount: (config: AccountMonitorConfig) => Promise<void>;
}

export function AddAccountModal({ isOpen, onClose, onAddAccount }: AddAccountModalProps) {
  const [provider, setProvider] = useState<QuotaProviderId>('antigravity');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [tier, setTier] = useState('Standard Tier');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const accountId = cleanEmail.replace(/[^a-z0-9]/g, '-').slice(0, 32) || `acc-${Date.now()}`;

    setIsSubmitting(true);
    setError(null);
    try {
      const now = (Math.floor(Date.now() / 1000)).toString();
      const config: AccountMonitorConfig = {
        accountId,
        provider,
        email: cleanEmail,
        displayName: displayName.trim() || cleanEmail,
        tier: tier.trim() || null,
        enabled: true,
        autoConnect: true,
        pollingIntervalSeconds: 120,
        createdAt: now,
        updatedAt: now,
      };


      await onAddAccount(config);
      setDisplayName('');
      setEmail('');
      onClose();
    } catch (err: any) {
      setError(err?.message || String(err) || 'Failed to register account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <Card className="border-border bg-surface shadow-2xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Icon name="UserPlus" className="w-5 h-5 text-primary" />
                Add AI Quota Account
              </CardTitle>
              <Button onClick={onClose} variant="ghost" size="sm" className="h-7 w-7 p-0">
                <Icon name="X" className="w-4 h-4" />
              </Button>
            </div>
            <CardDescription className="text-xs">
              Register an account to monitor its AI quota, capacity, and rolling reset windows.
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-3.5 text-xs">
              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive flex items-center gap-2">
                  <Icon name="AlertTriangle" className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="font-semibold text-foreground">AI Quota Provider</label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as QuotaProviderId)}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                >
                  <option value="antigravity">Antigravity (Local Runtime Bridge)</option>
                  <option value="codex">Codex (Planned / Future)</option>
                  <option value="claude_code">Claude Code (Planned / Future)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Account Name / Label</label>
                <input
                  type="text"
                  placeholder="e.g. Work Account or Personal"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  autoFocus
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">
                  Account Email / Identity <span className="text-destructive">*</span>
                </label>
                <input
                  type="email"
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Account Tier (Optional)</label>
                <select
                  value={tier}
                  onChange={(e) => setTier(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="Standard Tier">Standard Tier</option>
                  <option value="Pro">Pro Tier</option>
                  <option value="Enterprise">Enterprise</option>
                  <option value="Free">Free</option>
                </select>
              </div>


              <div className="p-3 rounded-lg bg-muted/30 border text-[11px] text-muted-foreground flex items-start gap-2 font-sans">
                <Icon name="Shield" className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span>
                  Security Invariant: DCC never stores or asks for passwords, cookies, or tokens.
                  OAuth credentials are managed securely via your OS Credential Manager.
                </span>
              </div>
            </CardContent>

            <CardFooter className="pt-2 pb-4 flex items-center justify-end gap-2 border-t bg-muted/10">
              <Button type="button" onClick={onClose} variant="ghost" size="sm" className="text-xs">
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} variant="default" size="sm" className="text-xs">
                {isSubmitting ? (
                  <>
                    <Icon name="Loader2" className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Icon name="Check" className="mr-1.5 h-3.5 w-3.5" />
                    Add Account
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
