import { ClaudeProvider } from './claude-provider.js';
import { OpencodeProvider } from './opencode-provider.js';
import { GroqProvider } from './groq-provider.js';

// Provider registry
const providers = {
  claude: ClaudeProvider,
  opencode: OpencodeProvider,
  groq: GroqProvider
};

// Provider instance cache
const providerInstances = new Map();

export function getProvider(providerName, config = {}) {
  const name = providerName?.toLowerCase() || 'groq';

  if (!providers[name]) {
    throw new Error(`Unknown provider: ${name}. Available providers: ${Object.keys(providers).join(', ')}`);
  }

  const cacheKey = `${name}:${JSON.stringify(config)}`;
  if (providerInstances.has(cacheKey)) {
    return providerInstances.get(cacheKey);
  }

  const ProviderClass = providers[name];
  const instance = new ProviderClass(config);
  providerInstances.set(cacheKey, instance);

  return instance;
}

export function getAvailableProviders() {
  return Object.keys(providers);
}

export function registerProvider(name, ProviderClass) {
  providers[name.toLowerCase()] = ProviderClass;
}

export async function clearProviderCache() {
  for (const instance of providerInstances.values()) {
    if (instance.cleanup) {
      await instance.cleanup();
    }
  }
  providerInstances.clear();
}

export async function initializeProviders() {
  console.log('[Providers] Initializing providers...');
  try {
    const opencodeProvider = getProvider('opencode');
    await opencodeProvider.initialize();
    console.log('[Providers] Opencode provider initialized');
  } catch (error) {
    console.error('[Providers] Error initializing providers:', error.message);
  }
}

export { ClaudeProvider } from './claude-provider.js';
export { OpencodeProvider } from './opencode-provider.js';
export { GroqProvider } from './groq-provider.js';
export { BaseProvider } from './base-provider.js';
