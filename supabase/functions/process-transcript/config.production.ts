/**
 * Production configuration for process-transcript Edge Function
 */

export interface ProductionConfig {
  // OpenAI Configuration
  openai: {
    apiKey: string;
    organizationId?: string;
    model: string;
    maxTokens: number;
    temperature: number;
    maxRetries: number;
    timeout: number;
  };
  
  // Rate Limiting
  rateLimit: {
    windowMs: number;
    maxRequests: number;
    maxRequestsPerIP: number;
  };
  
  // Performance
  performance: {
    enableCaching: boolean;
    cacheMaxSize: number;
    cacheTTL: number;
    maxTranscriptSize: number;
    requestTimeout: number;
  };
  
  // Monitoring
  monitoring: {
    enableRemoteLogging: boolean;
    logLevel: string;
    enableMetrics: boolean;
    alertThresholds: {
      errorRate: number;
      responseTime: number;
      tokenUsage: number;
    };
  };
  
  // Security
  security: {
    enableRateLimiting: boolean;
    enableInputValidation: boolean;
    maxRequestSize: number;
    allowedOrigins: string[];
  };
  
  // Database
  database: {
    maxRetries: number;
    retryDelay: number;
    connectionTimeout: number;
    statementTimeout: number;
  };
}

export const productionConfig: ProductionConfig = {
  openai: {
    apiKey: Deno.env.get('OPENAI_API_KEY') || '',
    organizationId: Deno.env.get('OPENAI_ORGANIZATION_ID'),
    model: Deno.env.get('OPENAI_MODEL') || 'gpt-4-turbo-preview',
    maxTokens: parseInt(Deno.env.get('OPENAI_MAX_TOKENS') || '4000'),
    temperature: parseFloat(Deno.env.get('OPENAI_TEMPERATURE') || '0.7'),
    maxRetries: parseInt(Deno.env.get('OPENAI_MAX_RETRIES') || '3'),
    timeout: parseInt(Deno.env.get('OPENAI_TIMEOUT') || '120000')
  },
  
  rateLimit: {
    windowMs: parseInt(Deno.env.get('RATE_LIMIT_WINDOW_MS') || '3600000'), // 1 hour
    maxRequests: parseInt(Deno.env.get('RATE_LIMIT_MAX_REQUESTS') || '1000'),
    maxRequestsPerIP: parseInt(Deno.env.get('RATE_LIMIT_MAX_PER_IP') || '100')
  },
  
  performance: {
    enableCaching: Deno.env.get('ENABLE_CACHING') === 'true',
    cacheMaxSize: parseInt(Deno.env.get('CACHE_MAX_SIZE') || '100'),
    cacheTTL: parseInt(Deno.env.get('CACHE_TTL') || '3600000'), // 1 hour
    maxTranscriptSize: parseInt(Deno.env.get('MAX_TRANSCRIPT_SIZE') || '51200'), // 50KB
    requestTimeout: parseInt(Deno.env.get('REQUEST_TIMEOUT') || '300000') // 5 minutes
  },
  
  monitoring: {
    enableRemoteLogging: Deno.env.get('ENABLE_REMOTE_LOGGING') === 'true',
    logLevel: Deno.env.get('LOG_LEVEL') || 'INFO',
    enableMetrics: Deno.env.get('ENABLE_METRICS') === 'true',
    alertThresholds: {
      errorRate: parseFloat(Deno.env.get('ALERT_ERROR_RATE') || '0.05'), // 5%
      responseTime: parseInt(Deno.env.get('ALERT_RESPONSE_TIME') || '10000'), // 10s
      tokenUsage: parseInt(Deno.env.get('ALERT_TOKEN_USAGE') || '100000') // 100k tokens
    }
  },
  
  security: {
    enableRateLimiting: Deno.env.get('ENABLE_RATE_LIMITING') !== 'false',
    enableInputValidation: Deno.env.get('ENABLE_INPUT_VALIDATION') !== 'false',
    maxRequestSize: parseInt(Deno.env.get('MAX_REQUEST_SIZE') || '1048576'), // 1MB
    // allowedOrigins: (Deno.env.get('ALLOWED_ORIGINS') || '*').split(',')
  },
  
  database: {
    maxRetries: parseInt(Deno.env.get('DB_MAX_RETRIES') || '3'),
    retryDelay: parseInt(Deno.env.get('DB_RETRY_DELAY') || '1000'),
    connectionTimeout: parseInt(Deno.env.get('DB_CONNECTION_TIMEOUT') || '10000'),
    statementTimeout: parseInt(Deno.env.get('DB_STATEMENT_TIMEOUT') || '30000')
  }
};

/**
 * Validate production configuration
 */
export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // OpenAI validation
  if (!productionConfig.openai.apiKey) {
    errors.push('OPENAI_API_KEY is required');
  }
  
  if (productionConfig.openai.maxTokens < 100 || productionConfig.openai.maxTokens > 8000) {
    errors.push('OPENAI_MAX_TOKENS must be between 100 and 8000');
  }
  
  if (productionConfig.openai.temperature < 0 || productionConfig.openai.temperature > 2) {
    errors.push('OPENAI_TEMPERATURE must be between 0 and 2');
  }
  
  // Rate limit validation
  if (productionConfig.rateLimit.maxRequests < 1) {
    errors.push('RATE_LIMIT_MAX_REQUESTS must be at least 1');
  }
  
  // Performance validation
  if (productionConfig.performance.maxTranscriptSize < 1024) {
    errors.push('MAX_TRANSCRIPT_SIZE must be at least 1024 bytes');
  }
  
  // Security validation
  if (productionConfig.security.allowedOrigins.length === 0) {
    errors.push('At least one allowed origin must be specified');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get configuration summary for logging
 */
export function getConfigSummary(): Record<string, any> {
  return {
    environment: 'production',
    openai: {
      model: productionConfig.openai.model,
      maxTokens: productionConfig.openai.maxTokens,
      temperature: productionConfig.openai.temperature
    },
    rateLimit: {
      windowMs: productionConfig.rateLimit.windowMs,
      maxRequests: productionConfig.rateLimit.maxRequests
    },
    performance: {
      caching: productionConfig.performance.enableCaching,
      maxTranscriptSize: productionConfig.performance.maxTranscriptSize
    },
    monitoring: {
      remoteLogging: productionConfig.monitoring.enableRemoteLogging,
      logLevel: productionConfig.monitoring.logLevel
    },
    security: {
      rateLimiting: productionConfig.security.enableRateLimiting,
      inputValidation: productionConfig.security.enableInputValidation
    }
  };
}