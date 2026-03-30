// Public API of the rag-context module.
// Consumers (Edge Functions) must import exclusively via this file,
// never directly from the internal sub-modules.

export { RagContextService } from './service.ts';

export {
  loadRagContextConfig,
  RAG_CONTEXT_DEFAULTS,
  PLATFORM_SETTINGS_RAG_KEY,
  PLATFORM_SETTINGS_RAG_SECTION,
  CHARS_PER_TOKEN,
} from './config.ts';

export type {
  RagContextConfig,
  RagContextResult,
  RagContextOptions,
  CreationType,
  RagSearchResult,
} from './types.ts';
