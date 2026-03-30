import { MarkdownFormatter, ServiceCallMetadata } from '../types.ts';

/**
 * Base abstract class for all markdown formatters
 * Provides common utility methods for markdown generation
 */
export abstract class BaseFormatter implements MarkdownFormatter {
  /**
   * Abstract method that must be implemented by all formatters
   */
  abstract format(responseBody: any, metadata: ServiceCallMetadata): string;

  /**
   * Generates a markdown header section
   */
  protected generateHeader(
    title: string,
    url: string,
    score: number,
    timestamp: string,
    metadata: ServiceCallMetadata
  ): string {
    return `# ${title}\n\n` +
      `**URL**: ${url}\n` +
      `**Score**: ${score}/100\n` +
      `**Tested**: ${timestamp}\n` +
      `**Service**: ${metadata.serviceName} (${metadata.serviceCategory})\n\n`;
  }

  /**
   * Generates a score indicator with visual emoji
   */
  protected getScoreIndicator(score: number | null): string {
    if (score === null) return '⚪ N/A';
    if (score === 0) return '❌ Failed';
    if (score >= 0.9) return '✅ Passed';
    if (score >= 0.5) return '⚠️ Warning';
    return '❌ Failed';
  }

  /**
   * Generates impact level badge
   */
  protected getImpactBadge(impact: string): string {
    switch (impact.toLowerCase()) {
      case 'critical':
        return '🔴 Critical';
      case 'serious':
        return '🟠 Serious';
      case 'moderate':
        return '🟡 Moderate';
      case 'minor':
        return '🔵 Minor';
      default:
        return impact;
    }
  }

  /**
   * Escapes markdown special characters
   */
  protected escapeMarkdown(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/\*/g, '\\*')
      .replace(/\_/g, '\\_')
      .replace(/\{/g, '\\{')
      .replace(/\}/g, '\\}')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/\#/g, '\\#')
      .replace(/\+/g, '\\+')
      .replace(/\-/g, '\\-')
      .replace(/\./g, '\\.')
      .replace(/\!/g, '\\!');
  }

  /**
   * Truncates text to specified length
   */
  protected truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * Formats a timestamp to readable format
   */
  protected formatTimestamp(timestamp: string): string {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short',
      });
    } catch {
      return timestamp;
    }
  }

  /**
   * Generates a summary section
   */
  protected generateSummary(score: number, totalItems: number, description: string): string {
    return `## Summary\n\n` +
      `Overall score: **${score}%** ${this.getScoreIndicator(score / 100)}\n\n` +
      `${description}\n\n` +
      `Total items analyzed: **${totalItems}**\n\n`;
  }

  /**
   * Generates a table of contents
   */
  protected generateTableOfContents(sections: string[]): string {
    let toc = '## Table of Contents\n\n';
    sections.forEach(section => {
      const anchor = section.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
      toc += `- [${section}](#${anchor})\n`;
    });
    return toc + '\n';
  }

  /**
   * Generates a horizontal rule
   */
  protected generateDivider(): string {
    return '\n---\n\n';
  }
}
