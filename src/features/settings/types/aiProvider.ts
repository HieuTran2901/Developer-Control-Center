export type ProviderType = 'openai' | 'anthropic' | 'custom';

export type AIProviderStatus = 'UNTESTED' | 'TESTING' | 'CONNECTED' | 'FAILED' | 'DISABLED';

export interface AIProvider {
  id: string;
  name: string;
  providerType: ProviderType;
  model: string;
  baseUrl: string;
  enabled: boolean;
  isDefault: boolean;
  status: AIProviderStatus;
  createdAt: number;
  updatedAt: number;
  lastError?: string;
}

export interface CreateAIProviderInput {
  name: string;
  providerType: ProviderType;
  model: string;
  baseUrl: string;
  secretKey?: string;
  isDefault?: boolean;
}

export interface UpdateAIProviderInput {
  id: string;
  name?: string;
  providerType?: ProviderType;
  model?: string;
  baseUrl?: string;
  secretKey?: string;
  enabled?: boolean;
  isDefault?: boolean;
}
