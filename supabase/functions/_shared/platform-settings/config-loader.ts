import { OpenAIConfig } from '../document-generation/types.ts';
import { PlatformSettingsService } from './service.ts';
import { AIConfigurationKey } from './types.ts';

interface ConfigurationResult {
  config: OpenAIConfig;
  source: {
    model: 'request' | 'database' | 'default';
    temperature: 'request' | 'database' | 'default';
    token_limit: 'request' | 'database' | 'default';
  };
}

export async function loadConfiguration(
  platformSettingsService: PlatformSettingsService,
  configKey: AIConfigurationKey,
  defaultConfig: OpenAIConfig,
  requestOverrides: {
    model?: string;
    temperature?: number;
    token_limit?: number;
  },
  logPrefix = ''
): Promise<ConfigurationResult> {
  let dbConfig: Partial<OpenAIConfig> = {};

  try {
    console.log(`${logPrefix} Fetching platform settings for key: ${configKey}`);
    const platformConfig = await platformSettingsService.getAIConfiguration(configKey);

    if (platformConfig) {
      dbConfig = platformConfig;
      console.log(`${logPrefix} Platform settings loaded successfully:`, {
        model: platformConfig.model,
        temperature: platformConfig.temperature,
        token_limit: platformConfig.token_limit
      });
    } else {
      console.log(`${logPrefix} Platform settings not found, using defaults`);
    }
  } catch (error) {
    console.error(`${logPrefix} Failed to fetch platform settings, using defaults:`, error);
  }

  const requestConfig: Partial<OpenAIConfig> = {};
  if (requestOverrides.model !== undefined) requestConfig.model = requestOverrides.model;
  if (requestOverrides.temperature !== undefined) requestConfig.temperature = requestOverrides.temperature;
  if (requestOverrides.token_limit !== undefined) requestConfig.token_limit = requestOverrides.token_limit;

  const finalConfig: OpenAIConfig = {
    ...defaultConfig,
    ...dbConfig,
    ...requestConfig,
  };

  if (finalConfig.token_limit !== undefined) {
    finalConfig.max_output_tokens = finalConfig.token_limit;
  }

  const source = {
    model: (requestOverrides.model !== undefined ? 'request' : (dbConfig.model ? 'database' : 'default')) as 'request' | 'database' | 'default',
    temperature: (requestOverrides.temperature !== undefined ? 'request' : (dbConfig.temperature !== undefined ? 'database' : 'default')) as 'request' | 'database' | 'default',
    token_limit: (requestOverrides.token_limit !== undefined ? 'request' : (dbConfig.token_limit !== undefined ? 'database' : 'default')) as 'request' | 'database' | 'default',
  };

  console.log(`${logPrefix} Configuration sources:`, source);

  return { config: finalConfig, source };
}
