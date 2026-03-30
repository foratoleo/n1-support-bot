/**
 * Simplified content chunking for Deno Edge Functions
 *
 * Implements a sliding window approach to split content into overlapping chunks
 * suitable for embedding generation. Uses approximate token counting (chars / 4)
 * since tiktoken is not readily available in the Deno runtime.
 *
 * @module _shared/indexing/chunker
 */

import type { SourceTable, ChunkMetadata, ContentChunk } from './types.ts';

/**
 * Configuration for the chunking algorithm
 */
interface ChunkingConfig {
  /** Maximum tokens per chunk (approximate). Default: 800 */
  maxTokens: number;
  /** Token overlap between consecutive chunks. Default: 150 */
  overlapTokens: number;
  /** Minimum tokens for a chunk to be valid. Default: 50 */
  minTokens: number;
  /** Characters per token approximation. Default: 4 */
  charsPerToken: number;
}

const DEFAULT_CONFIG: ChunkingConfig = {
  maxTokens: 800,
  overlapTokens: 150,
  minTokens: 50,
  charsPerToken: 4,
};

/**
 * Approximate token count from text length.
 * Uses the heuristic: ~4 characters per token for English text.
 */
function estimateTokenCount(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / DEFAULT_CONFIG.charsPerToken);
}

/**
 * Calculate a simple hash checksum for content deduplication.
 * Matches the algorithm used in the frontend content-chunker.ts.
 */
function calculateChecksum(content: string): string {
  if (!content) return '';
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  return Array.from(data)
    .reduce((hash, byte) => {
      const newHash = ((hash << 5) - hash) + byte;
      return newHash & newHash;
    }, 0)
    .toString(16);
}

/**
 * Create a ContentChunk from raw content and metadata
 */
function createChunk(
  content: string,
  sourceTable: SourceTable,
  sourceId: string,
  metadata: Partial<ChunkMetadata>,
  chunkIndex: number,
): ContentChunk {
  const trimmed = content.trim();
  const tokenCount = estimateTokenCount(trimmed);
  const checksum = calculateChecksum(trimmed);

  return {
    content: trimmed,
    metadata: {
      ...metadata,
      sourceTable,
      sourceId,
      chunkIndex,
    },
    tokenCount,
    checksum,
  };
}

/**
 * Sliding window chunking algorithm.
 *
 * Splits text into overlapping chunks using character-based approximation of tokens.
 * If the text fits within a single chunk, returns it as-is.
 * Chunks below the minimum token threshold are discarded.
 */
function slidingWindowChunk(
  content: string,
  sourceTable: SourceTable,
  sourceId: string,
  metadata: Partial<ChunkMetadata>,
  config: ChunkingConfig = DEFAULT_CONFIG,
): ContentChunk[] {
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return [];
  }

  const text = content.trim();
  const totalTokens = estimateTokenCount(text);

  if (totalTokens < config.minTokens) {
    return [];
  }

  if (totalTokens <= config.maxTokens) {
    return [createChunk(text, sourceTable, sourceId, metadata, 0)];
  }

  const chunks: ContentChunk[] = [];
  const maxChars = config.maxTokens * config.charsPerToken;
  const overlapChars = config.overlapTokens * config.charsPerToken;
  const stepChars = maxChars - overlapChars;

  let startIndex = 0;

  while (startIndex < text.length) {
    const endIndex = Math.min(startIndex + maxChars, text.length);
    const chunkText = text.slice(startIndex, endIndex);

    if (estimateTokenCount(chunkText) >= config.minTokens) {
      chunks.push(createChunk(chunkText, sourceTable, sourceId, metadata, chunks.length));
    }

    if (endIndex >= text.length) {
      break;
    }

    startIndex += stepChars;
  }

  // Assign totalChunks to all chunk metadata
  return chunks.map((chunk, index) => ({
    ...chunk,
    metadata: {
      ...chunk.metadata,
      chunkIndex: index,
      totalChunks: chunks.length,
    },
  }));
}

/**
 * Split markdown content by heading sections before chunking.
 * This preserves document structure for better retrieval quality.
 */
function splitBySections(content: string): Array<{ heading: string; content: string }> {
  const sections: Array<{ heading: string; content: string }> = [];
  const lines = content.split('\n');
  let currentSection: { heading: string; content: string } | null = null;

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

    if (headingMatch) {
      if (currentSection && currentSection.content.trim()) {
        sections.push(currentSection);
      }
      currentSection = {
        heading: headingMatch[2],
        content: line + '\n',
      };
    } else if (currentSection) {
      currentSection.content += line + '\n';
    } else {
      currentSection = {
        heading: 'Introduction',
        content: line + '\n',
      };
    }
  }

  if (currentSection && currentSection.content.trim()) {
    sections.push(currentSection);
  }

  return sections.length > 0 ? sections : [{ heading: 'Content', content }];
}

/**
 * Chunk content based on its source table type.
 *
 * Different source tables benefit from different chunking strategies:
 * - generated_documents / project_documents: Section-aware markdown chunking
 * - meeting_transcripts: Plain sliding window (speaker detection is complex)
 * - backlog_items / features / dev_tasks: Section-aware chunking for normalized Markdown records
 *
 * @param content - Raw text content to chunk
 * @param sourceTable - The source table type
 * @param sourceId - The record ID
 * @param metadata - Optional additional metadata for chunks
 * @returns Array of content chunks ready for embedding
 */
export function chunkContent(
  content: string,
  sourceTable: SourceTable,
  sourceId: string,
  metadata: Partial<ChunkMetadata> = {},
): ContentChunk[] {
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return [];
  }

  switch (sourceTable) {
    // Intentional fall-through: generated_documents and project_documents share
    // the same section-aware chunking strategy for Markdown content
    case 'generated_documents':
    case 'project_documents': {
      // Section-aware chunking for markdown documents
      const sections = splitBySections(content);
      const allChunks: ContentChunk[] = [];

      for (const section of sections) {
        const sectionChunks = slidingWindowChunk(
          section.content,
          sourceTable,
          sourceId,
          { ...metadata, section: section.heading, heading: section.heading },
        );
        allChunks.push(...sectionChunks);
      }

      // Re-assign global chunk indices
      return allChunks.map((chunk, index) => ({
        ...chunk,
        metadata: {
          ...chunk.metadata,
          chunkIndex: index,
          totalChunks: allChunks.length,
        },
      }));
    }

    case 'meeting_transcripts':
      return slidingWindowChunk(content, sourceTable, sourceId, metadata);

    // Intentional fall-through: backlog_items, features, and dev_tasks all use
    // normalized Markdown records and share the same adaptive chunking strategy
    case 'backlog_items':
    case 'features':
    case 'dev_tasks': {
      const tokenCount = estimateTokenCount(content);

      // For small content (basic title+description), use single chunk
      if (tokenCount <= DEFAULT_CONFIG.maxTokens) {
        if (tokenCount < DEFAULT_CONFIG.minTokens) {
          return [];
        }
        return [createChunk(content, sourceTable, sourceId, metadata, 0)];
      }

      // For larger content (normalized records with Markdown sections),
      // use section-aware chunking to preserve structure
      const sections = splitBySections(content);
      const allChunks: ContentChunk[] = [];

      for (const section of sections) {
        const sectionChunks = slidingWindowChunk(
          section.content,
          sourceTable,
          sourceId,
          { ...metadata, section: section.heading, heading: section.heading },
        );
        allChunks.push(...sectionChunks);
      }

      // Re-assign global chunk indices
      return allChunks.map((chunk, index) => ({
        ...chunk,
        metadata: {
          ...chunk.metadata,
          chunkIndex: index,
          totalChunks: allChunks.length,
        },
      }));
    }

    default:
      return slidingWindowChunk(content, sourceTable, sourceId, metadata);
  }
}
