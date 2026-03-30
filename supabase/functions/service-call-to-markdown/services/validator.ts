import { ExternalServiceCall } from '../types.ts';
import { ValidationError } from '../utils/validation.ts';

export class ServiceCallValidator {
  validateFilters(
    serviceCall: ExternalServiceCall,
    expectedName?: string,
    expectedCategory?: string
  ): void {
    if (expectedName && expectedName !== serviceCall.service_name) {
      throw new ValidationError(
        `Service name mismatch. Expected: ${expectedName}, Found: ${serviceCall.service_name}`,
        'serviceName'
      );
    }

    if (expectedCategory && expectedCategory !== serviceCall.service_category) {
      throw new ValidationError(
        `Service category mismatch. Expected: ${expectedCategory}, Found: ${serviceCall.service_category}`,
        'serviceCategory'
      );
    }
  }
}
