import { AIProvider } from '../types/aiProvider';

export const initialMockProviders: AIProvider[] = [
  {
    id: '1',
    displayName: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    maskedApiKey: 'sk-proj-••••••••••••••••',
    model: 'gpt-4o',
    organization: 'org-developer-control',
    timeout: 30000,
    maxTokens: 4096,
    temperature: 0.7,
    connectionStatus: 'Connected',
  },
  {
    id: '2',
    displayName: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    maskedApiKey: 'sk-ant-••••••••••••••••',
    model: 'claude-3-5-sonnet-20240620',
    timeout: 30000,
    maxTokens: 4096,
    temperature: 0.5,
    connectionStatus: 'Untested',
  }
];
