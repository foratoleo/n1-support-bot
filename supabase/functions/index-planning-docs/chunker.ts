/**
 * Content chunking for planning documentation
 *
 * Implements a sliding window approach to split markdown documentation into
 * overlapping chunks suitable for embedding generation. Uses approximate token
 * counting (chars / 4) since tiktoken is not available in Deno runtime.
 *
 * Chunking configuration:
 * - maxTokens: 800 (within 500-1000 target range)
 * - overlapTokens: 150 (for context preservation)
 * - minTokens: 100 (minimum viable chunk)
 *
 * @module index-planning-docs/chunker
 */

import type { ContentChunk } from './types.ts';

/**
 * Configuration for the chunking algorithm.
 * Targets 500-1000 tokens per chunk with overlap.
 */
interface ChunkingConfig {
  /** Maximum tokens per chunk. Default: 800 */
  maxTokens: number;
  /** Token overlap between consecutive chunks. Default: 150 */
  overlapTokens: number;
  /** Minimum tokens for a chunk to be valid. Default: 100 */
  minTokens: number;
  /** Characters per token approximation. Default: 4 */
  charsPerToken: number;
}

const DEFAULT_CONFIG: ChunkingConfig = {
  maxTokens: 800,
  overlapTokens: 150,
  minTokens: 100,
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
 * Split markdown content by heading sections before chunking.
 * This preserves document structure for better retrieval quality.
 */
function splitBySections(
  content: string,
): Array<{ heading: string; content: string }> {
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
      // Content before first heading
      currentSection = {
        heading: 'Introdução',
        content: line + '\n',
      };
    }
  }

  if (currentSection && currentSection.content.trim()) {
    sections.push(currentSection);
  }

  return sections.length > 0 ? sections : [{ heading: 'Conteúdo', content }];
}

/**
 * Create a ContentChunk from raw content.
 */
function createChunk(
  content: string,
  chunkIndex: number,
  totalChunks: number,
  section?: string,
): ContentChunk {
  const trimmed = content.trim();
  const tokenCount = estimateTokenCount(trimmed);
  const checksum = calculateChecksum(trimmed);

  return {
    content: trimmed,
    chunk_index: chunkIndex,
    total_chunks: totalChunks,
    section,
    tokenCount,
    checksum,
  };
}

/**
 * Sliding window chunking for a single text segment.
 */
function slidingWindowChunk(
  text: string,
  section?: string,
  config: ChunkingConfig = DEFAULT_CONFIG,
): ContentChunk[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const trimmedText = text.trim();
  const totalTokens = estimateTokenCount(trimmedText);

  if (totalTokens < config.minTokens) {
    return [];
  }

  // If content fits in a single chunk, return it
  if (totalTokens <= config.maxTokens) {
    return [createChunk(trimmedText, 0, 1, section)];
  }

  const chunks: ContentChunk[] = [];
  const maxChars = config.maxTokens * config.charsPerToken;
  const overlapChars = config.overlapTokens * config.charsPerToken;
  const stepChars = maxChars - overlapChars;

  let startIndex = 0;

  while (startIndex < trimmedText.length) {
    const endIndex = Math.min(startIndex + maxChars, trimmedText.length);
    const chunkText = trimmedText.slice(startIndex, endIndex);

    if (estimateTokenCount(chunkText) >= config.minTokens) {
      chunks.push(
        createChunk(chunkText, chunks.length, 0, section), // totalChunks updated later
      );
    }

    if (endIndex >= trimmedText.length) {
      break;
    }

    startIndex += stepChars;
  }

  // Update total chunks count
  return chunks.map((chunk) => ({
    ...chunk,
    total_chunks: chunks.length,
  }));
}

/**
 * Chunk planning documentation content.
 *
 * Uses section-aware chunking to preserve Markdown structure.
 * Splits content by headings first, then applies sliding window
 * to each section if needed.
 *
 * @param content - Raw markdown content to chunk
 * @param title - Document title for metadata
 * @returns Array of content chunks ready for embedding
 */
export function chunkPlanningDoc(
  content: string,
  title: string,
): ContentChunk[] {
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return [];
  }

  // Split by sections (headings)
  const sections = splitBySections(content);
  const allChunks: ContentChunk[] = [];

  for (const section of sections) {
    const sectionChunks = slidingWindowChunk(section.content, section.heading);
    allChunks.push(...sectionChunks);
  }

  // Re-assign global chunk indices
  const totalChunks = allChunks.length;
  return allChunks.map((chunk, index) => ({
    ...chunk,
    chunk_index: index,
    total_chunks: totalChunks,
  }));
}

/**
 * Estimate total token count for a document.
 */
export function estimateDocumentTokens(content: string): number {
  return estimateTokenCount(content);
}
