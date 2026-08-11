import { useState } from 'react';
import { AIProvider, ProviderType } from '../types/aiProvider';
import { Button } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/Icon';

interface AIProviderFormProps {
  initialData?: AIProvider | null;
  onSave: (data: {
    name: string;
    providerType: ProviderType;
    model: string;
    baseUrl: string;
    secretKey?: string;
    isDefault?: boolean;
  }) => Promise<void>;
  onCancel: () => void;
  isSaving?: boolean;
}

const DEFAULT_BASE_URLS: Record<ProviderType, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  custom: 'http://localhost:11434/v1',
};

const DEFAULT_MODELS: Record<ProviderType, string> = {
  openai: 'gpt-4o',
  anthropic: 'claude-3-5-sonnet-20240620',
  custom: 'llama3',
};

export function AIProviderForm({ initialData, onSave, onCancel, isSaving }: AIProviderFormProps) {
  const [providerType, setProviderType] = useState<ProviderType>(initialData?.providerType || 'openai');
  const [name, setName] = useState(initialData?.name || 'OpenAI');
  const [baseUrl, setBaseUrl] = useState(initialData?.baseUrl || DEFAULT_BASE_URLS.openai);
  const [model, setModel] = useState(initialData?.model || DEFAULT_MODELS.openai);
  const [secretKey, setSecretKey] = useState('');
  const [isChangingKey, setIsChangingKey] = useState(!initialData);
  const [isDefault, setIsDefault] = useState(initialData?.isDefault || false);
  
  const [showApiKey, setShowApiKey] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Handle provider type change defaults for new items
  const handleTypeChange = (type: ProviderType) => {
    setProviderType(type);
    if (!initialData) {
      if (type === 'openai') {
        setName('OpenAI');
        setBaseUrl(DEFAULT_BASE_URLS.openai);
        setModel(DEFAULT_MODELS.openai);
      } else if (type === 'anthropic') {
        setName('Anthropic');
        setBaseUrl(DEFAULT_BASE_URLS.anthropic);
        setModel(DEFAULT_MODELS.anthropic);
      } else {
        setName('Custom LLM');
        setBaseUrl(DEFAULT_BASE_URLS.custom);
        setModel(DEFAULT_MODELS.custom);
      }
    }
  };

  const validate = (): boolean => {
    if (!name.trim()) {
      setErrorMsg('Provider Name is required.');
      return false;
    }
    if (!baseUrl.trim()) {
      setErrorMsg('Base URL is required.');
      return false;
    }
    try {
      new URL(baseUrl);
    } catch {
      setErrorMsg('Base URL must be a valid URL (e.g. https://api.openai.com/v1).');
      return false;
    }
    if (!model.trim()) {
      setErrorMsg('Model name is required.');
      return false;
    }
    if (!initialData && !secretKey.trim() && providerType !== 'custom') {
      setErrorMsg('API Key is required when creating a new provider.');
      return false;
    }
    setErrorMsg('');
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    await onSave({
      name: name.trim(),
      providerType,
      baseUrl: baseUrl.trim(),
      model: model.trim(),
      secretKey: (isChangingKey && secretKey.trim()) ? secretKey.trim() : undefined,
      isDefault,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5 border border-border/40 rounded-xl bg-card/60 backdrop-blur-sm mt-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Icon name="Bot" size={16} className="text-primary shrink-0" />
          {initialData ? 'Edit AI Provider' : 'Add New AI Provider'}
        </h3>
        <Button variant="ghost" size="sm" type="button" onClick={onCancel} className="h-7 w-7 p-0 rounded-full">
          <Icon name="X" size={14} className="w-3.5 h-3.5 shrink-0" />
        </Button>
      </div>

      {errorMsg && (
        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 p-2.5 rounded-md flex items-center gap-2">
          <Icon name="AlertCircle" size={14} className="w-3.5 h-3.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Provider Type */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-foreground">Provider Type</label>
          <select
            className="flex h-9 w-full rounded-md border border-border/50 bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            value={providerType}
            onChange={(e) => handleTypeChange(e.target.value as ProviderType)}
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="custom">Custom (OpenAI-compatible / Ollama)</option>
          </select>
        </div>

        {/* Display Name */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-foreground">Provider Name</label>
          <input 
            type="text" 
            required
            className="flex h-9 w-full rounded-md border border-border/50 bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            placeholder="e.g. OpenAI Production"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>

        {/* Base URL */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-foreground">Base URL</label>
          <input 
            type="text" 
            required
            className="flex h-9 w-full rounded-md border border-border/50 bg-background px-3 py-1 text-sm font-mono shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            placeholder="https://api.openai.com/v1"
            value={baseUrl}
            onChange={e => setBaseUrl(e.target.value)}
          />
        </div>

        {/* Model Name */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-foreground">Model Name</label>
          <input 
            type="text" 
            required
            className="flex h-9 w-full rounded-md border border-border/50 bg-background px-3 py-1 text-sm font-mono shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            placeholder="e.g. gpt-4o or claude-3-5-sonnet"
            value={model}
            onChange={e => setModel(e.target.value)}
          />
        </div>

        {/* API Key / Secret */}
        <div className="flex flex-col gap-1.5 md:col-span-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-foreground">API Key / Secret</label>
            {initialData && !isChangingKey && (
              <button
                type="button"
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                onClick={() => setIsChangingKey(true)}
              >
                <Icon name="Edit2" size={12} className="w-3 h-3 shrink-0" />
                Change API Key
              </button>
            )}
          </div>

          {initialData && !isChangingKey ? (
            <div className="flex h-9 w-full rounded-md border border-border/40 bg-muted/20 px-3 py-1 text-sm font-mono text-muted-foreground items-center justify-between">
              <span>•••••••••••••••• (Configured securely)</span>
              <span className="text-[10px] text-green-400 font-sans uppercase">Protected</span>
            </div>
          ) : (
            <div className="relative">
              <input 
                type={showApiKey ? "text" : "password"} 
                className="flex h-9 w-full rounded-md border border-border/50 bg-background px-3 py-1 pr-10 text-sm font-mono shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                placeholder={providerType === 'custom' ? "sk-... (Optional for local LLMs)" : "sk-..."}
                value={secretKey}
                onChange={e => setSecretKey(e.target.value)}
              />
              <button 
                type="button"
                className="absolute right-0 top-0 h-9 w-10 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                <Icon name={showApiKey ? "EyeOff" : "Eye"} size={14} className="w-3.5 h-3.5 shrink-0" />
              </button>
            </div>
          )}
          <p className="text-[10px] text-muted-foreground mt-0.5">
            API Keys are isolated in backend secure credential storage and never logged or exposed.
          </p>
        </div>

        {/* Set Default Checkbox */}
        <div className="flex items-center gap-2 md:col-span-2 pt-1">
          <input
            type="checkbox"
            id="isDefaultCheck"
            className="rounded border-border/50 bg-background text-primary focus:ring-primary h-4 w-4"
            checked={isDefault}
            onChange={e => setIsDefault(e.target.checked)}
          />
          <label htmlFor="isDefaultCheck" className="text-xs text-foreground cursor-pointer select-none">
            Set as Primary Default Provider for AI Pipeline Builder
          </label>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/40">
        <Button variant="outline" size="sm" type="button" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
        <Button size="sm" type="submit" disabled={isSaving} className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5">
          {isSaving ? (
            <>
              <Icon name="Loader2" size={14} className="w-3.5 h-3.5 shrink-0 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Icon name="Save" size={14} className="w-3.5 h-3.5 shrink-0" />
              {initialData ? 'Save Changes' : 'Save Provider'}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
