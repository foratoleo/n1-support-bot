import { ServiceCallToMarkdownRequest } from '../types.ts';

export class Logger {
  logRequest(body: ServiceCallToMarkdownRequest): void {
    console.log('Service call to markdown request received:', {
      id: body.id,
      serviceName: body.serviceName,
      serviceCategory: body.serviceCategory,
      timestamp: new Date().toISOString(),
    });
  }

  logFetching(id: string): void {
    console.log('Fetching service call record...', { id });
  }

  logFound(id: string, serviceName: string, serviceCategory: string, status?: number): void {
    console.log('Service call found:', {
      id,
      serviceName,
      serviceCategory,
      status,
    });
  }

  logFormatterSelected(serviceCategory: string, serviceName: string): void {
    console.log('Formatter selected:', {
      serviceCategory,
      serviceName,
    });
  }

  logGenerating(): void {
    console.log('Generating markdown...');
  }

  logSuccess(id: string, length: number): void {
    console.log('Markdown generated successfully', {
      length,
      id,
    });
  }

  logCompletion(id: string, executionTime: number, markdownLength: number): void {
    console.log('Service call to markdown completed successfully', {
      id,
      executionTime,
      markdownLength,
    });
  }

  logError(error: Error, executionTime: number): void {
    console.error('Edge function error:', {
      error: error.message,
      stack: error.stack,
      executionTime,
    });
  }
}
