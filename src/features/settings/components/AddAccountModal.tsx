import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/Icon';
import { AccountMonitorConfig } from '@/domain/entities/QuotaPolling';
import { QuotaProviderId } from '@/domain/entities/QuotaProvider';
import { quotaPollingService } from '@/application/services';

interface AddAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddAccount: (config: AccountMonitorConfig) => Promise<void>;
  onAccountAdded?: (accountId?: string) => Promise<void> | void;
}

export function AddAccountModal({ isOpen, onClose, onAddAccount, onAccountAdded }: AddAccountModalProps) {
  const [provider, setProvider] = useState<QuotaProviderId>('google_cloud_code');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [tier, setTier] = useState('Standard Tier');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConnectingOAuth, setIsConnectingOAuth] = useState(false);
  const [oauthStatusMessage, setOauthStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConnectGoogleOAuth = async () => {
    setIsConnectingOAuth(true);
    setError(null);
    setOauthStatusMessage('Opening browser for Google OAuth authorization...');

    try {
      setOauthStatusMessage('Waiting for browser authentication callback...');
      const res = await quotaPollingService.connectGoogleAccount('new', true);

      if (res.success) {
        setOauthStatusMessage('✓ Connected Google account successfully!');
        if (onAccountAdded) {
          try {
            await onAccountAdded(res.accountId || undefined);
          } catch (e) {
            console.error('Error in onAccountAdded callback:', e);
          }
        }
        onClose();
      } else {
        setError(res.message || 'Google OAuth connection failed.');
      }
    } catch (err: any) {
      setError(err?.message || String(err) || 'Google authentication failed.');
    } finally {
      setIsConnectingOAuth(false);
      setOauthStatusMessage(null);
    }
  };

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
              Connect a Google account for 0-IDE background monitoring, or configure local Antigravity runtime monitoring.
            </CardDescription>
          </CardHeader>

          <div className="px-6 pb-2">
            <Button
              type="button"
              onClick={handleConnectGoogleOAuth}
              disabled={isConnectingOAuth || isSubmitting}
              className="w-full flex items-center justify-center gap-2 bg-white hover:bg-neutral-100 text-neutral-900 border border-neutral-300 font-medium text-xs shadow-sm py-2"
            >
              {isConnectingOAuth ? (
                <>
                  <Icon name="Loader2" className="w-4 h-4 animate-spin text-neutral-700" />
                  <span>{oauthStatusMessage || 'Connecting Google Account...'}</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Connect with Google (Recommended)</span>
                </>
              )}
            </Button>

            <div className="relative my-3.5 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <span className="relative bg-surface px-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Or configure manually
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-3.5 text-xs pt-0">
              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive space-y-2">
                  <div className="flex items-start gap-2">
                    <Icon name="AlertTriangle" className="w-4 h-4 shrink-0 mt-0.5" />
                    <span className="leading-tight">{error}</span>
                  </div>
                  {error.includes('myaccount.google.com') && (
                    <div className="pt-2 border-t border-destructive/20 text-[11px] text-foreground font-sans space-y-1">
                      <p className="font-semibold text-destructive">How to resolve:</p>
                      <ol className="list-decimal list-inside space-y-0.5 text-muted-foreground">
                        <li>Open <a href="https://myaccount.google.com/connections" target="_blank" rel="noreferrer" className="underline text-primary font-medium">Google Account Third-Party Connections</a>.</li>
                        <li>Find <strong>Developer Control Center</strong> and click <strong>Delete all connections</strong>.</li>
                        <li>Return here and click <strong>Connect with Google</strong> again to grant offline access.</li>
                      </ol>
                    </div>
                  )}
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
                  Security Invariant: DCC never stores passwords, cookies, or raw tokens.
                  OAuth refresh tokens are protected securely in your OS Credential Manager.
                </span>
              </div>
            </CardContent>

            <CardFooter className="pt-2 pb-4 flex items-center justify-end gap-2 border-t bg-muted/10">
              <Button type="button" onClick={onClose} variant="ghost" size="sm" className="text-xs">
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || isConnectingOAuth} variant="default" size="sm" className="text-xs">
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
