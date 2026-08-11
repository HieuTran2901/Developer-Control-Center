import { invoke } from '@tauri-apps/api/core';
import { AIProvider, CreateAIProviderInput, UpdateAIProviderInput } from '@/features/settings/types/aiProvider';

export interface AIMessageInput {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIRequestPayload {
  providerId: string;
  model?: string;
  messages: AIMessageInput[];
  options?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
  };
}

export interface AIResponsePayload {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: string;
}

export class AIProviderService {
  private fallbackProviders: AIProvider[] = [
    {
      id: 'provider_openai_default',
      name: 'OpenAI',
      providerType: 'openai',
      model: 'gpt-4o',
      baseUrl: 'https://api.openai.com/v1',
      enabled: true,
      isDefault: true,
      status: 'UNTESTED',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: 'provider_anthropic_default',
      name: 'Anthropic',
      providerType: 'anthropic',
      model: 'claude-3-5-sonnet-20240620',
      baseUrl: 'https://api.anthropic.com/v1',
      enabled: true,
      isDefault: false,
      status: 'UNTESTED',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
  ];

  async listProviders(): Promise<AIProvider[]> {
    try {
      return await invoke<AIProvider[]>('ai_provider_list_cmd');
    } catch (e) {
      console.warn('Tauri IPC not available, using in-memory provider list', e);
      return this.fallbackProviders;
    }
  }

  async createProvider(input: CreateAIProviderInput): Promise<AIProvider> {
    try {
      return await invoke<AIProvider>('ai_provider_create_cmd', { input });
    } catch (e) {
      console.warn('Tauri IPC error on createProvider, fallback used', e);
      const newProvider: AIProvider = {
        id: `provider_${Date.now()}`,
        name: input.name,
        providerType: input.providerType,
        model: input.model,
        baseUrl: input.baseUrl,
        enabled: true,
        isDefault: input.isDefault ?? (this.fallbackProviders.length === 0),
        status: 'UNTESTED',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      if (newProvider.isDefault) {
        this.fallbackProviders.forEach(p => p.isDefault = false);
      }
      this.fallbackProviders.push(newProvider);
      return newProvider;
    }
  }

  async updateProvider(input: UpdateAIProviderInput): Promise<AIProvider> {
    try {
      return await invoke<AIProvider>('ai_provider_update_cmd', { input });
    } catch (e) {
      console.warn('Tauri IPC error on updateProvider, fallback used', e);
      const idx = this.fallbackProviders.findIndex(p => p.id === input.id);
      if (idx === -1) throw new Error(`Provider ${input.id} not found`);

      if (input.isDefault) {
        this.fallbackProviders.forEach(p => p.isDefault = false);
      }

      const p = this.fallbackProviders[idx];
      const updated: AIProvider = {
        ...p,
        name: input.name ?? p.name,
        providerType: input.providerType ?? p.providerType,
        model: input.model ?? p.model,
        baseUrl: input.baseUrl ?? p.baseUrl,
        enabled: input.enabled ?? p.enabled,
        isDefault: input.isDefault ?? p.isDefault,
        updatedAt: Date.now(),
      };
      this.fallbackProviders[idx] = updated;
      return updated;
    }
  }

  async deleteProvider(id: string): Promise<void> {
    try {
      await invoke('ai_provider_delete_cmd', { id });
    } catch (e) {
      console.warn('Tauri IPC error on deleteProvider, fallback used', e);
      const wasDefault = this.fallbackProviders.find(p => p.id === id)?.isDefault;
      this.fallbackProviders = this.fallbackProviders.filter(p => p.id !== id);
      if (wasDefault && this.fallbackProviders.length > 0) {
        this.fallbackProviders[0].isDefault = true;
      }
    }
  }

  async setDefaultProvider(id: string): Promise<AIProvider> {
    try {
      return await invoke<AIProvider>('ai_provider_set_default_cmd', { id });
    } catch (e) {
      console.warn('Tauri IPC error on setDefaultProvider, fallback used', e);
      let updated: AIProvider | null = null;
      this.fallbackProviders.forEach(p => {
        if (p.id === id) {
          p.isDefault = true;
          updated = p;
        } else {
          p.isDefault = false;
        }
      });
      if (!updated) throw new Error(`Provider ${id} not found`);
      return updated;
    }
  }

  async testConnection(id: string): Promise<AIProvider> {
    try {
      return await invoke<AIProvider>('ai_provider_test_connection_cmd', { id });
    } catch (e: any) {
      console.warn('Tauri IPC error on testConnection, fallback used', e);
      const p = this.fallbackProviders.find(p => p.id === id);
      if (!p) throw new Error(`Provider ${id} not found`);
      p.status = 'FAILED';
      p.lastError = typeof e === 'string' ? e : (e?.message || 'Connection failed');
      return p;
    }
  }

  async sendAIRequest(request: AIRequestPayload): Promise<AIResponsePayload> {
    try {
      return await invoke<AIResponsePayload>('ai_gateway_send_request_cmd', { request });
    } catch (e: any) {
      console.warn('Tauri IPC error on sendAIRequest, fallback mock used', e);
      return {
        content: `[Mock AI Gateway Fallback Response]: Generated for provider ${request.providerId}`,
        model: request.model || 'mock-model',
        usage: { promptTokens: 10, completionTokens: 15, totalTokens: 25 },
        finishReason: 'stop',
      };
    }
  }
}

export const aiProviderService = new AIProviderService();
