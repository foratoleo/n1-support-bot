import { OpenAI } from 'npm:openai';
import { InputMsg, OpenAIConfig } from './types.ts';

export class OpenAIService {
  private client: OpenAI;
  private operation: string;

  constructor(apiKey: string, operation: string) {
    this.client = new OpenAI({ apiKey });
    this.operation = operation;
  }

  async generateDocument(
    input: InputMsg[],
    projectId: string,
    previousResponseId?: string,
    config?: Partial<OpenAIConfig>
  ): Promise<any> {
    if (!config) {
      throw new Error('OpenAI configuration is required');
    }

    const requestPayload = {
      model: config.model!,
      input,
      previous_response_id: previousResponseId || undefined,
      max_output_tokens: config.max_output_tokens!,
      temperature: config.temperature!,
      store: config.store!,
      metadata: {
        project_id: projectId,
        operation: this.operation
      }
    };

    try {
      const response = await this.client.responses.create(requestPayload);
      return response;
    } catch (error) {
      console.error('[OpenAIService] API error:', (error as Error)?.message);
      throw error;
    }
  }
}
