import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL'
}

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: any;
  timestamp: string;
  correlationId?: string;
  userId?: string;
  duration?: number;
  error?: any;
}

interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: string;
  correlationId: string;
  metadata?: any;
}

export class MonitoringLogger {
  private logs: LogEntry[] = [];
  private metrics: PerformanceMetric[] = [];
  private correlationId: string;
  private startTime: number;
  private supabase?: SupabaseClient;
  private enableRemoteLogging: boolean = false;

  constructor(correlationId?: string, supabase?: SupabaseClient) {
    this.correlationId = correlationId || this.generateCorrelationId();
    this.startTime = Date.now();
    this.supabase = supabase;
    this.enableRemoteLogging = Deno.env.get('ENABLE_REMOTE_LOGGING') === 'true';
  }

  /**
   * Generate unique correlation ID for request tracking
   */
  private generateCorrelationId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log message with specified level
   */
  log(level: LogLevel, message: string, context?: any): void {
    const entry: LogEntry = {
      level,
      message,
      context,
      timestamp: new Date().toISOString(),
      correlationId: this.correlationId
    };

    this.logs.push(entry);
    
    // Console output with formatting
    this.consoleOutput(entry);
    
    // Remote logging if enabled
    if (this.enableRemoteLogging && this.supabase) {
      this.sendToRemote(entry).catch(err => 
        console.error('Failed to send log to remote:', err)
      );
    }
  }

  /**
   * Convenience methods for different log levels
   */
  debug(message: string, context?: any): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: any): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: any): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, error?: any, context?: any): void {
    this.log(LogLevel.ERROR, message, { ...context, error: this.serializeError(error) });
  }

  critical(message: string, error?: any, context?: any): void {
    this.log(LogLevel.CRITICAL, message, { ...context, error: this.serializeError(error) });
    // Critical errors might trigger alerts
    this.triggerAlert(message, error);
  }

  /**
   * Log request details
   */
  logRequest(method: string, path: string, headers: Headers, body?: any): void {
    const sanitizedHeaders = this.sanitizeHeaders(headers);
    const sanitizedBody = this.sanitizeBody(body);
    
    this.info('Incoming request', {
      method,
      path,
      headers: sanitizedHeaders,
      body: sanitizedBody,
      correlationId: this.correlationId
    });
  }

  /**
   * Log response details
   */
  logResponse(status: number, body?: any, duration?: number): void {
    const sanitizedBody = this.sanitizeBody(body);
    
    this.info('Outgoing response', {
      status,
      body: sanitizedBody,
      duration: duration || (Date.now() - this.startTime),
      correlationId: this.correlationId
    });
  }

  /**
   * Record performance metric
   */
  recordMetric(operation: string, duration: number, metadata?: any): void {
    const metric: PerformanceMetric = {
      operation,
      duration,
      timestamp: new Date().toISOString(),
      correlationId: this.correlationId,
      metadata
    };

    this.metrics.push(metric);
    
    // Log slow operations
    if (duration > 5000) {
      this.warn(`Slow operation detected: ${operation}`, { duration, metadata });
    }
  }

  /**
   * Start timing an operation
   */
  startTimer(operation: string): () => void {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      this.recordMetric(operation, duration);
      return duration;
    };
  }

  /**
   * Execute function with automatic timing
   */
  async timeOperation<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    const stopTimer = this.startTimer(operation);
    try {
      const result = await fn();
      stopTimer();
      return result;
    } catch (error) {
      stopTimer();
      this.error(`Operation failed: ${operation}`, error);
      throw error;
    }
  }

  /**
   * Console output with color coding
   */
  private consoleOutput(entry: LogEntry): void {
    const colors = {
      DEBUG: '\x1b[36m',    // Cyan
      INFO: '\x1b[32m',     // Green
      WARN: '\x1b[33m',     // Yellow
      ERROR: '\x1b[31m',    // Red
      CRITICAL: '\x1b[35m'  // Magenta
    };

    const reset = '\x1b[0m';
    const color = colors[entry.level] || reset;
    
    const output = `${color}[${entry.timestamp}] [${entry.level}] [${entry.correlationId}]${reset} ${entry.message}`;
    
    if (entry.context) {
      console.log(output, entry.context);
    } else {
      console.log(output);
    }
  }

  /**
   * Sanitize headers for logging (remove sensitive data)
   */
  private sanitizeHeaders(headers: Headers): Record<string, string> {
    const sanitized: Record<string, string> = {};
    const sensitiveHeaders = ['authorization', 'x-api-key', 'cookie'];
    
    headers.forEach((value, key) => {
      if (sensitiveHeaders.includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    });
    
    return sanitized;
  }

  /**
   * Sanitize body for logging (remove sensitive data)
   */
  private sanitizeBody(body: any): any {
    if (!body) return body;
    
    const sensitiveFields = ['password', 'token', 'apiKey', 'secret'];
    
    if (typeof body === 'object') {
      const sanitized = { ...body };
      
      for (const field of sensitiveFields) {
        if (field in sanitized) {
          sanitized[field] = '[REDACTED]';
        }
      }
      
      return sanitized;
    }
    
    return body;
  }

  /**
   * Serialize error for logging
   */
  private serializeError(error: any): any {
    if (!error) return null;
    
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
        cause: error.cause
      };
    }
    
    return error;
  }

  /**
   * Send log entry to remote storage
   */
  private async sendToRemote(entry: LogEntry): Promise<void> {
    if (!this.supabase) return;
    
    try {
      await this.supabase
        .from('application_logs')
        .insert({
          level: entry.level,
          message: entry.message,
          context: entry.context,
          correlation_id: entry.correlationId,
          timestamp: entry.timestamp
        });
    } catch (error) {
      // Fail silently to avoid infinite loop
      console.error('Remote logging failed:', error);
    }
  }

  /**
   * Trigger alert for critical errors
   */
  private triggerAlert(message: string, error?: any): void {
    // In production, this would send to alerting service
    console.error('🚨 CRITICAL ALERT:', message, error);
    
    // Could integrate with services like:
    // - PagerDuty
    // - Slack
    // - Email
    // - SMS
  }

  /**
   * Get summary of logs and metrics
   */
  getSummary(): {
    correlationId: string;
    duration: number;
    logCounts: Record<LogLevel, number>;
    metrics: PerformanceMetric[];
    errors: LogEntry[];
  } {
    const logCounts = this.logs.reduce((acc, log) => {
      acc[log.level] = (acc[log.level] || 0) + 1;
      return acc;
    }, {} as Record<LogLevel, number>);

    const errors = this.logs.filter(log => 
      log.level === LogLevel.ERROR || log.level === LogLevel.CRITICAL
    );

    return {
      correlationId: this.correlationId,
      duration: Date.now() - this.startTime,
      logCounts,
      metrics: this.metrics,
      errors
    };
  }

  /**
   * Export logs for analysis
   */
  exportLogs(): string {
    return JSON.stringify({
      correlationId: this.correlationId,
      startTime: new Date(this.startTime).toISOString(),
      duration: Date.now() - this.startTime,
      logs: this.logs,
      metrics: this.metrics
    }, null, 2);
  }

  /**
   * Health check for monitoring
   */
  healthCheck(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    errorRate: number;
    avgResponseTime: number;
    lastError?: LogEntry;
  } {
    const errorCount = this.logs.filter(log => 
      log.level === LogLevel.ERROR || log.level === LogLevel.CRITICAL
    ).length;
    
    const errorRate = this.logs.length > 0 ? errorCount / this.logs.length : 0;
    
    const avgResponseTime = this.metrics.length > 0
      ? this.metrics.reduce((sum, m) => sum + m.duration, 0) / this.metrics.length
      : 0;
    
    const lastError = this.logs
      .filter(log => log.level === LogLevel.ERROR || log.level === LogLevel.CRITICAL)
      .pop();
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (errorRate > 0.5) status = 'unhealthy';
    else if (errorRate > 0.1) status = 'degraded';
    
    return {
      status,
      errorRate,
      avgResponseTime,
      lastError
    };
  }
}

// Export singleton instance for easy use
export const createLogger = (correlationId?: string, supabase?: SupabaseClient) => {
  return new MonitoringLogger(correlationId, supabase);
};