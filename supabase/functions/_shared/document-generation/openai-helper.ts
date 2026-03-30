import { InputMsg } from './types.ts';

/**
 * Result type for raw output text extraction
 * Provides both raw and cleaned versions for different use cases
 */
export interface ExtractedOutput {
  /** Raw text preserving all formatting including code fences */
  rawText: string;
  /** Cleaned text with code fences removed for display */
  cleanedText: string;
}

/**
 * Removes markdown/JSON code fence markers from AI-generated content.
 *
 * Handles patterns like:
 * - Start: ```markdown\n, ```markdown, ```json\n, ```json
 * - End: ```\n, ```
 *
 * @param text - The text content to clean
 * @returns Cleaned text without code fence markers
 *
 * @example
 * cleanCodeFences("```markdown\n# Title\nContent\n```")
 * // Returns: "# Title\nContent"
 */
export function cleanCodeFences(text: string): string {
  if (!text) return text;

  let cleaned = text;

  // Remove leading code fences (```markdown, ```json at start)
  // Matches: ``` followed by optional language identifier, followed by optional newline
  cleaned = cleaned.replace(/^```(?:markdown|json)?\n?/, '');

  // Remove trailing code fences (``` at end)
  // Matches: optional newline followed by ``` at the end of string
  cleaned = cleaned.replace(/\n?```\s*$/, '');

  return cleaned.trim();
}

/**
 * Extracts raw text from OpenAI response without any cleaning.
 * Used for content extraction that needs to find code fence blocks.
 *
 * @param resp - OpenAI API response object
 * @returns Raw text content preserving all formatting
 */
export function extractRawOutputText(resp: any): string {
  let text = '';

  if (resp?.output_text) {
    text = String(resp.output_text);
  } else {
    const texts: string[] = [];
    const items = resp?.output ?? resp?.content ?? [];

    for (const item of items) {
      if (Array.isArray(item?.content)) {
        for (const contentItem of item.content) {
          if (typeof contentItem?.text === 'string') {
            texts.push(contentItem.text);
          }
        }
      } else if (typeof item?.text === 'string') {
        texts.push(item.text);
      }
    }

    text = texts.join('\n').trim();
  }

  return text;
}

/**
 * Extracts output text from OpenAI response with both raw and cleaned versions.
 * Use rawText for content extraction, cleanedText for display.
 *
 * @param resp - OpenAI API response object
 * @returns Object with rawText and cleanedText properties
 */
export function extractOutputTextWithRaw(resp: any): ExtractedOutput {
  const rawText = extractRawOutputText(resp);
  return {
    rawText,
    cleanedText: cleanCodeFences(rawText)
  };
}

/**
 * Extracts output text from OpenAI response (cleaned version for display).
 * For content extraction that needs code fences, use extractRawOutputText or extractOutputTextWithRaw.
 *
 * @param resp - OpenAI API response object
 * @returns Cleaned text content for display
 */
export function extractOutputText(resp: any): string {
  const rawText = extractRawOutputText(resp);
  // Clean code fences from the extracted text
  return cleanCodeFences(rawText);
}

export function buildInputMessages(
  systemPrompt: string,
  userPrompt: string,
  content: string
): InputMsg[] {
  return [
    {
      role: 'system',
      content: [{ type: 'input_text', text: systemPrompt }]
    },
    {
      role: 'user',
      content: [{ type: 'input_text', text: `${userPrompt}\n\n${content}` }]
    }
  ];
}
