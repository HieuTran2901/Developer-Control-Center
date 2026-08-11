import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/Icon';
import { AIProvider } from '../types/aiProvider';
import { initialMockProviders } from '../data/mockAIProviders';
import { AIProviderCard } from './AIProviderCard';
import { AIProviderForm } from './AIProviderForm';

export function AIProviders() {
  const [providers, setProviders] = useState<AIProvider[]>(initialMockProviders);
  const [isAdding, setIsAdding] = useState(false);
  const [editingProvider, setEditingProvider] = useState<AIProvider | null>(null);

  const handleTestConnection = (id: string) => {
    // Optimistic UI update: Set to Connecting
    setProviders(prev => prev.map(p => p.id === id ? { ...p, connectionStatus: 'Connecting' } : p));
    
    // Simulate network delay and random success/fail
    setTimeout(() => {
      const isSuccess = Math.random() > 0.3; // 70% success rate for mock
      setProviders(prev => prev.map(p => 
        p.id === id ? { ...p, connectionStatus: isSuccess ? 'Connected' : 'Failed' } : p
      ));
    }, 1500);
  };

  const handleSave = (data: Partial<AIProvider>) => {
    if (editingProvider) {
      // Update existing
      setProviders(prev => prev.map(p => p.id === editingProvider.id ? { ...p, ...data } as AIProvider : p));
      setEditingProvider(null);
    } else {
      // Add new
      const newProvider: AIProvider = {
        id: Math.random().toString(36).substring(7),
        displayName: data.displayName || 'Unknown Provider',
        baseUrl: data.baseUrl || '',
        maskedApiKey: data.maskedApiKey || '',
        model: data.model || '',
        organization: data.organization,
        timeout: data.timeout,
        maxTokens: data.maxTokens,
        temperature: data.temperature,
        connectionStatus: 'Untested'
      };
      setProviders(prev => [...prev, newProvider]);
      setIsAdding(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <CardTitle className="text-xl">AI Providers</CardTitle>
          <CardDescription className="mt-1.5">
            Configure AI services used by Developer Control Center for Pipeline Generation and Code Assistance.
          </CardDescription>
        </div>
        {!isAdding && !editingProvider && (
          <Button onClick={() => setIsAdding(true)} size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 shrink-0">
            <Icon name="Plus" size={14} className="w-3.5 h-3.5 shrink-0 mr-2" />
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
          />
        )}

        {/* List View */}
        {!isAdding && !editingProvider && providers.length === 0 && (
          <div className="flex flex-col items-center justify-center p-8 border border-dashed border-border/40 rounded-xl bg-muted/5 text-muted-foreground">
            <Icon name="Bot" size={24} className="w-6 h-6 mb-3 opacity-50" />
            <p className="text-sm font-medium">No AI Providers Configured</p>
            <p className="text-xs mt-1 text-center max-w-[250px]">Add a provider to enable AI Pipeline Builder and other assistant features.</p>
          </div>
        )}

        {!isAdding && !editingProvider && providers.length > 0 && (
          <div className="grid grid-cols-1 gap-4">
            {providers.map(provider => (
              <AIProviderCard 
                key={provider.id} 
                provider={provider} 
                onEdit={setEditingProvider}
                onTestConnection={handleTestConnection}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
