import { ExternalServiceCall, ServiceCallMetadata, ServiceType } from '../types.ts';
import { FormatterFactory } from '../formatters/factory.ts';

export class MarkdownGenerator {
  generate(serviceCall: ExternalServiceCall, resultType?: ServiceType): { markdown: string; metadata: ServiceCallMetadata } {
    // Use resultType to override service_category if provided (for services that handle multiple result types)
    const effectiveCategory = resultType === 'performance' ? 'performance' :
                             resultType === 'accessibility' ? 'quality' :
                             serviceCall.service_category;

    const formatter = FormatterFactory.getFormatter(
      effectiveCategory,
      serviceCall.service_name
    );

    const metadata: ServiceCallMetadata = {
      id: serviceCall.id,
      serviceName: serviceCall.service_name,
      serviceCategory: effectiveCategory,
      generatedAt: new Date().toISOString(),
      requestUrl: serviceCall.request_url,
      timestamp: serviceCall.created_at,
    };

    const markdown = formatter.format(serviceCall.response_body, metadata);

    return { markdown, metadata };
  }
}
