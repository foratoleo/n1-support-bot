import { MarkdownFormatter } from '../types.ts';
import { AccessibilityFormatter } from './accessibility-formatter.ts';
import { PerformanceFormatter } from './performance-formatter.ts';
import { UnsupportedServiceError } from '../utils/validation.ts';

/**
 * Factory for creating appropriate markdown formatters based on service type
 */
export class FormatterFactory {
  private static formatters: Map<string, () => MarkdownFormatter> = new Map([
    ['accessibility:pagespeed', () => new AccessibilityFormatter()],
    ['performance:pagespeed', () => new PerformanceFormatter()],
    // Future formatters can be registered here:
    // ['seo:pagespeed', () => new SEOFormatter()],
  ]);

  /**
   * Gets the appropriate formatter for a service
   * @param serviceCategory - The category of the service (e.g., 'accessibility', 'performance')
   * @param serviceName - The name of the service (e.g., 'pagespeed', 'lighthouse')
   * @returns MarkdownFormatter instance
   * @throws UnsupportedServiceError if no formatter exists for the service
   */
  static getFormatter(serviceCategory: string, serviceName: string): MarkdownFormatter {
    const key = `${serviceCategory}:${serviceName}`;
    const formatterFactory = this.formatters.get(key);

    if (!formatterFactory) {
      throw new UnsupportedServiceError(
        `No formatter available for service: ${serviceCategory}/${serviceName}. Supported services: ${this.getSupportedServices().join(', ')}`,
        serviceName,
        serviceCategory
      );
    }

    return formatterFactory();
  }

  /**
   * Checks if a formatter exists for a service
   */
  static hasFormatter(serviceCategory: string, serviceName: string): boolean {
    const key = `${serviceCategory}:${serviceName}`;
    return this.formatters.has(key);
  }

  /**
   * Gets list of supported service combinations
   */
  static getSupportedServices(): string[] {
    return Array.from(this.formatters.keys());
  }

  /**
   * Registers a new formatter (for extensibility)
   */
  static registerFormatter(
    serviceCategory: string,
    serviceName: string,
    formatterFactory: () => MarkdownFormatter
  ): void {
    const key = `${serviceCategory}:${serviceName}`;
    this.formatters.set(key, formatterFactory);
  }
}
