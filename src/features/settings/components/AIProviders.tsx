import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/Icon';
import { AIProvider, ProviderType } from '../types/aiProvider';
import { aiProviderService } from '@/application/services/AIProviderService';
import { AIProviderCard } from './AIProviderCard';
import { AIProviderForm } from './AIProviderForm';

export function AIProviders() {
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [editingProvider, setEditingProvider] = useState<AIProvider | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadProviders = async () => {
    setIsLoading(true);
    try {
      const list = await aiProviderService.listProviders();
      setProviders(list);
    } catch (e) {
      console.error('Failed to load AI providers', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProviders();
  }, []);

  const handleTestConnection = async (id: string) => {
    setProviders(prev => prev.map(p => p.id === id ? { ...p, status: 'TESTING' } : p));
    try {
      const updated = await aiProviderService.testConnection(id);
      setProviders(prev => prev.map(p => p.id === id ? updated : p));
    } catch (e: any) {
      console.error('Test connection error', e);
      setProviders(prev => prev.map(p => p.id === id ? { ...p, status: 'FAILED', lastError: e?.message || 'Connection failed' } : p));
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await aiProviderService.setDefaultProvider(id);
      await loadProviders();
    } catch (e) {
      console.error('Failed to set default provider', e);
    }
  };

  const handleSave = async (formData: {
    name: string;
    providerType: ProviderType;
    model: string;
    baseUrl: string;
    secretKey?: string;
    isDefault?: boolean;
  }) => {
    setIsSaving(true);
    try {
      if (editingProvider) {
        await aiProviderService.updateProvider({
          id: editingProvider.id,
          name: formData.name,
          providerType: formData.providerType,
          model: formData.model,
          baseUrl: formData.baseUrl,
          secretKey: formData.secretKey,
          isDefault: formData.isDefault,
        });
        setEditingProvider(null);
      } else {
        await aiProviderService.createProvider({
          name: formData.name,
          providerType: formData.providerType,
          model: formData.model,
          baseUrl: formData.baseUrl,
          secretKey: formData.secretKey,
          isDefault: formData.isDefault,
        });
        setIsAdding(false);
      }
      await loadProviders();
    } catch (e) {
      console.error('Failed to save AI provider', e);
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    try {
      await aiProviderService.deleteProvider(deletingId);
      setDeletingId(null);
      await loadProviders();
    } catch (e) {
      console.error('Failed to delete provider', e);
    }
  };

  const targetDeleteProvider = providers.find(p => p.id === deletingId);

  return (
    <Card>
      <CardHeader className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-4">
        <div>
          <CardTitle className="text-xl">AI Providers</CardTitle>
          <CardDescription className="mt-1.5">
            Configure AI models and endpoints used by Developer Control Center for AI Pipeline Builder and Code Assistance.
          </CardDescription>
        </div>
        {!isAdding && !editingProvider && (
          <Button 
            onClick={() => setIsAdding(true)} 
            size="sm" 
            className="bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 gap-1.5"
          >
            <Icon name="Plus" size={14} className="w-3.5 h-3.5 shrink-0" />
            Add Provider
          </Button>
        )}
      </CardHeader>
      
      <CardContent className="flex flex-col gap-4">
        {/* Form View (Add/Edit) */}
        {(isAdding || editingProvider) && (
          <AIProviderForm 
            initialData={editingProvider}
            onSave={handleSave}
            onCancel={() => {
              setIsAdding(false);
              setEditingProvider(null);
            }}
            isSaving={isSaving}
          />
        )}

        {/* Loading State */}
        {isLoading && !isAdding && !editingProvider && (
          <div className="flex items-center justify-center p-12 text-muted-foreground gap-2">
            <Icon name="Loader2" size={18} className="w-4.5 h-4.5 animate-spin" />
            <span className="text-sm font-medium">Loading AI Provider configuration...</span>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !isAdding && !editingProvider && providers.length === 0 && (
          <div className="flex flex-col items-center justify-center p-10 border border-dashed border-border/40 rounded-xl bg-muted/5 text-muted-foreground">
            <div className="w-12 h-12 rounded-full bg-muted/20 border border-border/40 flex items-center justify-center mb-3">
              <Icon name="Bot" size={24} className="w-6 h-6 text-muted-foreground/60" />
            </div>
            <p className="text-sm font-semibold text-foreground">No AI Providers Configured</p>
            <p className="text-xs mt-1 text-center max-w-[320px] text-muted-foreground">
              Connect an AI provider to enable AI-powered pipeline generation and developer automation.
            </p>
            <Button onClick={() => setIsAdding(true)} size="sm" className="mt-4 bg-primary text-primary-foreground gap-1.5">
              <Icon name="Plus" size={14} className="w-3.5 h-3.5 shrink-0" />
              Add Provider
            </Button>
          </div>
        )}

        {/* List View */}
        {!isLoading && !isAdding && !editingProvider && providers.length > 0 && (
          <div className="grid grid-cols-1 gap-4">
            {providers.map(provider => (
              <AIProviderCard 
                key={provider.id} 
                provider={provider} 
                onEdit={setEditingProvider}
                onDelete={setDeletingId}
                onSetDefault={handleSetDefault}
                onTestConnection={handleTestConnection}
              />
            ))}
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deletingId && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full shadow-2xl flex flex-col gap-4">
              <div className="flex items-center gap-3 text-red-400">
                <div className="w-9 h-9 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                  <Icon name="AlertTriangle" size={18} className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-base">Delete Provider?</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">This action cannot be undone.</p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed bg-muted/20 p-3 rounded-lg border border-border/30">
                Are you sure you want to delete <strong className="text-foreground">{targetDeleteProvider?.name || 'this provider'}</strong>? This will permanently remove its configuration and stored API credential.
              </p>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setDeletingId(null)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={confirmDelete} className="bg-red-600 hover:bg-red-700 text-white">
                  Delete Provider
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
