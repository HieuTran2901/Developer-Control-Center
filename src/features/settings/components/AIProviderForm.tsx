import { useState } from 'react';
import { AIProvider } from '../types/aiProvider';
import { Button } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/Icon';

interface AIProviderFormProps {
  initialData?: AIProvider | null;
  onSave: (data: Partial<AIProvider>) => void;
  onCancel: () => void;
}

export function AIProviderForm({ initialData, onSave, onCancel }: AIProviderFormProps) {
  const [showApiKey, setShowApiKey] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const [formData, setFormData] = useState<Partial<AIProvider>>({
    displayName: initialData?.displayName || '',
    baseUrl: initialData?.baseUrl || '',
    maskedApiKey: initialData?.maskedApiKey || '',
    model: initialData?.model || '',
    organization: initialData?.organization || '',
    timeout: initialData?.timeout || 30000,
    maxTokens: initialData?.maxTokens || 4096,
    temperature: initialData?.temperature || 0.7,
  });

  const handleChange = (field: keyof AIProvider, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-5 border border-border/40 rounded-xl bg-card/40 backdrop-blur-sm mt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{initialData ? 'Edit AI Provider' : 'Add AI Provider'}</h3>
        <Button variant="ghost" size="sm" type="button" onClick={onCancel} className="h-6 w-6 p-0 rounded-full">
          <Icon name="X" size={14} className="w-3.5 h-3.5 shrink-0" />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Display Name */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-foreground">Display Name</label>
          <input 
            type="text" 
            required
            className="flex h-9 w-full rounded-md border border-border/50 bg-background/50 px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            placeholder="e.g. OpenAI GPT-4"
            value={formData.displayName}
            onChange={e => handleChange('displayName', e.target.value)}
          />
        </div>

        {/* Model */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-foreground">Model</label>
          <input 
            type="text" 
            required
            className="flex h-9 w-full rounded-md border border-border/50 bg-background/50 px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            placeholder="e.g. gpt-4o"
            value={formData.model}
            onChange={e => handleChange('model', e.target.value)}
          />
        </div>

        {/* Base URL */}
        <div className="flex flex-col gap-1.5 md:col-span-2">
          <label className="text-xs font-medium text-foreground">Base URL</label>
          <input 
            type="text" 
            required
            className="flex h-9 w-full rounded-md border border-border/50 bg-background/50 px-3 py-1 text-sm font-mono shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            placeholder="https://api.openai.com/v1"
            value={formData.baseUrl}
            onChange={e => handleChange('baseUrl', e.target.value)}
          />
        </div>

        {/* API Key */}
        <div className="flex flex-col gap-1.5 md:col-span-2">
          <label className="text-xs font-medium text-foreground">API Key</label>
          <div className="relative">
            <input 
              type={showApiKey ? "text" : "password"} 
              required
              className="flex h-9 w-full rounded-md border border-border/50 bg-background/50 px-3 py-1 pr-10 text-sm font-mono shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
              placeholder="sk-..."
              value={formData.maskedApiKey}
              onChange={e => handleChange('maskedApiKey', e.target.value)}
            />
            <button 
              type="button"
              className="absolute right-0 top-0 h-9 w-10 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShowApiKey(!showApiKey)}
            >
              <Icon name={showApiKey ? "EyeOff" : "Eye"} size={14} className="w-3.5 h-3.5 shrink-0" />
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground">Keys are stored securely in the system keychain (mocked in this phase).</p>
        </div>
      </div>

      {/* Advanced Settings */}
      <div className="flex flex-col gap-3 pt-2 border-t border-border/40">
        <button 
          type="button"
          className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-fit"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          <Icon name={showAdvanced ? "ChevronDown" : "ChevronRight"} size={14} className="w-3.5 h-3.5 shrink-0" />
          Advanced Settings
        </button>

        {showAdvanced && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 animate-in slide-in-from-top-2 fade-in duration-200">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground">Organization ID</label>
              <input 
                type="text" 
                className="flex h-9 w-full rounded-md border border-border/50 bg-background/50 px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                placeholder="Optional"
                value={formData.organization}
                onChange={e => handleChange('organization', e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground">Max Tokens</label>
              <input 
                type="number" 
                className="flex h-9 w-full rounded-md border border-border/50 bg-background/50 px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                value={formData.maxTokens}
                onChange={e => handleChange('maxTokens', parseInt(e.target.value))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground">Temperature</label>
              <input 
                type="number" 
                step="0.1"
                min="0"
                max="2"
                className="flex h-9 w-full rounded-md border border-border/50 bg-background/50 px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                value={formData.temperature}
                onChange={e => handleChange('temperature', parseFloat(e.target.value))}
              />
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-4 border-t border-border/40">
        <Button variant="outline" size="sm" type="button" onClick={onCancel}>Cancel</Button>
        <Button size="sm" type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Icon name="Save" size={14} className="w-3.5 h-3.5 shrink-0 mr-2" />
          {initialData ? 'Save Changes' : 'Add Provider'}
        </Button>
      </div>
    </form>
  );
}
