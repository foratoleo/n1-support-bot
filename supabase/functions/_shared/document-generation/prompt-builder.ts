import { replacePromptPlaceholders } from './types.ts';

interface PromptResult {
  systemPrompt: string;
  userPrompt: string;
  source: {
    system_prompt: 'request' | 'database' | 'default';
    user_prompt: 'request' | 'database' | 'default';
  };
}

export function buildPrompts(
  content: string,
  defaultSystemPrompt: string,
  defaultUserPrompt: string,
  dbConfig: { system_prompt?: string; prompt?: string },
  requestOverrides: { system_prompt?: string; user_prompt?: string },
  logPrefix = ''
): PromptResult {
  const finalSystemPrompt = requestOverrides.system_prompt || dbConfig.system_prompt || defaultSystemPrompt;
  const finalUserPrompt = requestOverrides.user_prompt || dbConfig.prompt || defaultUserPrompt;

  const systemPromptSource = requestOverrides.system_prompt ? 'request' : (dbConfig.system_prompt ? 'database' : 'default');
  const userPromptSource = requestOverrides.user_prompt ? 'request' : (dbConfig.prompt ? 'database' : 'default');

  const processedUserPrompt = replacePromptPlaceholders(finalUserPrompt, content);

  console.log(`${logPrefix} Prompts prepared:`, {
    systemPromptLength: finalSystemPrompt.length,
    userPromptLength: processedUserPrompt.length,
    hasContentPlaceholder: finalUserPrompt.includes('{{content}}')
  });

  return {
    systemPrompt: finalSystemPrompt,
    userPrompt: processedUserPrompt,
    source: {
      system_prompt: systemPromptSource as 'request' | 'database' | 'default',
      user_prompt: userPromptSource as 'request' | 'database' | 'default',
    }
  };
}
