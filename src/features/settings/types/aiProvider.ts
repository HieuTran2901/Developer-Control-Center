export type AIProviderStatus = 'Untested' | 'Connecting' | 'Connected' | 'Failed';

export interface AIProvider {
  id: string;
  displayName: string;
  baseUrl: string;
  maskedApiKey: string;
  model: string;
  organization?: string;
  timeout?: number;
  maxTokens?: number;
  temperature?: number;
  connectionStatus: AIProviderStatus;
}
