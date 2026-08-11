import { AIProvider } from '../types/aiProvider';

export const initialMockProviders: AIProvider[] = [
  {
    id: 'provider_openai_1',
    name: 'OpenAI',
    providerType: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    enabled: true,
    isDefault: true,
    status: 'CONNECTED',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'provider_anthropic_1',
    name: 'Anthropic',
    providerType: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    model: 'claude-3-5-sonnet-20240620',
    enabled: true,
    isDefault: false,
    status: 'UNTESTED',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
];
