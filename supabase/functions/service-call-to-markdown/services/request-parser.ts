import { ServiceCallToMarkdownRequest } from '../types.ts';
import { ValidationError } from '../utils/validation.ts';

export class RequestParser {
  async parse(req: Request): Promise<ServiceCallToMarkdownRequest> {
    try {
      return await req.json();
    } catch (error) {
      throw new ValidationError('Invalid JSON in request body', 'body');
    }
  }
}
