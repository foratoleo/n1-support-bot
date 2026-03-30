/**
 * JIRA Structured Logging System
 *
 * Provides structured logging with multiple destinations, log levels,
 * sensitive data redaction, and distributed tracing support.
 *
 * @module jira-logger
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// Log levels
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  FATAL = 'FATAL',
}

// Log level priority for filtering
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.WARN]: 2,
  [LogLevel.ERROR]: 3,
  [LogLevel.FATAL]: 4,
};

export interface LogContext {
  operation_id?: string;
  project_id?: string;
  task_id?: string;
  jira_issue_key?: string;
  duration_ms?: number;
  user_id?: string;
  [key: string]: any;
}

export interface LogMetadata {
  function: string;
  version: string;
  environment?: string;
  region?: string;
  request_id?: string;
  correlation_id?: string;
  parent_span_id?: string;
  trace_id?: string;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  metadata?: LogMetadata;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export interface LogDestination {
  log(entry: LogEntry): Promise<void>;
}

// Console destination
class ConsoleDestination implements LogDestination {
  private useColors: boolean;

  constructor(useColors: boolean = true) {
    this.useColors = useColors;
  }

  async log(entry: LogEntry): Promise<void> {
    const color = this.getColor(entry.level);
    const prefix = this.useColors ? color : '';
    const suffix = this.useColors ? '\x1b[0m' : '';

    const output = {
      timestamp: entry.timestamp,
      level: entry.level,
      message: entry.message,
      ...entry.context,
      ...entry.metadata,
      error: entry.error,
    };

    console.log(`${prefix}${JSON.stringify(output)}${suffix}`);
  }

  private getColor(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG: return '\x1b[36m'; // Cyan
      case LogLevel.INFO: return '\x1b[32m'; // Green
      case LogLevel.WARN: return '\x1b[33m'; // Yellow
      case LogLevel.ERROR: return '\x1b[31m'; // Red
      case LogLevel.FATAL: return '\x1b[35m'; // Magenta
    }
  }
}

// Database destination
class DatabaseDestination implements LogDestination {
  private supabase: SupabaseClient;
  private buffer: LogEntry[] = [];
  private bufferSize: number = 10;
  private flushInterval: number = 5000;
  private flushTimer?: number;

  constructor(bufferSize?: number, flushInterval?: number) {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);

    if (bufferSize) this.bufferSize = bufferSize;
    if (flushInterval) this.flushInterval = flushInterval;

    this.startFlushTimer();
  }

  async log(entry: LogEntry): Promise<void> {
    this.buffer.push(entry);

    if (this.buffer.length >= this.bufferSize) {
      await this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const entries = [...this.buffer];
    this.buffer = [];

    try {
      const { error } = await this.supabase
        .from('jira_sync_log')
        .insert(
          entries.map(entry => ({
            project_id: entry.context?.project_id,
            task_id: entry.context?.task_id,
            jira_issue_key: entry.context?.jira_issue_key,
            operation: entry.context?.operation || 'log',
            direction: entry.context?.direction || 'dr_to_jira',
            status: this.mapLevelToStatus(entry.level),
            error_message: entry.level === LogLevel.ERROR || entry.level === LogLevel.FATAL
              ? entry.message
              : undefined,
            metadata: {
              level: entry.level,
              message: entry.message,
              context: entry.context,
              metadata: entry.metadata,
              error: entry.error,
              timestamp: entry.timestamp,
            },
          }))
        );

      if (error) {
        console.error('Failed to write logs to database:', error);
      }
    } catch (error) {
      console.error('Database log flush failed:', error);
    }
  }

  private mapLevelToStatus(level: LogLevel): 'success' | 'error' | 'pending' {
    switch (level) {
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        return 'error';
      case LogLevel.WARN:
        return 'pending';
      default:
        return 'success';
    }
  }

  private startFlushTimer() {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  stopFlushTimer() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
  }

  async close() {
    this.stopFlushTimer();
    await this.flush();
  }
}

// Sensitive data patterns
const SENSITIVE_PATTERNS = [
  /api[_-]?token/i,
  /auth[_-]?token/i,
  /password/i,
  /secret/i,
  /credentials?/i,
  /apikey/i,
  /bearer\s+\w+/i,
  /basic\s+\w+/i,
];

// Data redaction utility
function redactSensitiveData(obj: any): any {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    // Redact if the string looks like a token or password
    if (obj.length > 20 && /^[A-Za-z0-9+/=_-]{20,}$/.test(obj)) {
      return '[REDACTED]';
    }
    return obj;
  }

  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => redactSensitiveData(item));
  }

  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    // Check if key matches sensitive patterns
    const isSensitive = SENSITIVE_PATTERNS.some(pattern => pattern.test(key));

    if (isSensitive) {
      result[key] = '[REDACTED]';
    } else {
      result[key] = redactSensitiveData(value);
    }
  }

  return result;
}

// Request ID generator
function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Logger configuration
export interface JiraLoggerConfig {
  minLevel?: LogLevel;
  destinations?: LogDestination[];
  defaultMetadata?: Partial<LogMetadata>;
  enableRedaction?: boolean;
  enableSampling?: boolean;
  samplingRate?: number; // 0.0 to 1.0
}

export class JiraLogger {
  private minLevel: LogLevel;
  private destinations: LogDestination[];
  private defaultMetadata: Partial<LogMetadata>;
  private enableRedaction: boolean;
  private enableSampling: boolean;
  private samplingRate: number;
  private requestId: string;
  private correlationId?: string;
  private traceId?: string;

  constructor(config?: JiraLoggerConfig) {
    this.minLevel = config?.minLevel || LogLevel.INFO;
    this.destinations = config?.destinations || [
      new ConsoleDestination(),
      new DatabaseDestination(),
    ];
    this.defaultMetadata = config?.defaultMetadata || {};
    this.enableRedaction = config?.enableRedaction ?? true;
    this.enableSampling = config?.enableSampling ?? false;
    this.samplingRate = config?.samplingRate ?? 1.0;
    this.requestId = generateRequestId();
  }

  // Set correlation ID for distributed tracing
  setCorrelationId(id: string) {
    this.correlationId = id;
  }

  // Set trace ID for distributed tracing
  setTraceId(id: string) {
    this.traceId = id;
  }

  // Get current request ID
  getRequestId(): string {
    return this.requestId;
  }

  // Core logging method
  private async log(level: LogLevel, message: string, context?: LogContext, error?: Error) {
    // Check log level
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[this.minLevel]) {
      return;
    }

    // Apply sampling for non-error logs
    if (this.enableSampling && level < LogLevel.ERROR) {
      if (Math.random() > this.samplingRate) {
        return;
      }
    }

    // Prepare log entry
    let processedContext = context;
    if (this.enableRedaction && context) {
      processedContext = redactSensitiveData(context);
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: processedContext,
      metadata: {
        ...this.defaultMetadata,
        request_id: this.requestId,
        correlation_id: this.correlationId,
        trace_id: this.traceId,
      },
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
    };

    // Send to all destinations
    await Promise.all(
      this.destinations.map(dest =>
        dest.log(entry).catch(err =>
          console.error('Failed to write to log destination:', err)
        )
      )
    );
  }

  // Convenience methods
  debug(message: string, context?: LogContext) {
    return this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: LogContext) {
    return this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: LogContext) {
    return this.log(LogLevel.WARN, message, context);
  }

  error(message: string, context?: LogContext, error?: Error) {
    return this.log(LogLevel.ERROR, message, context, error);
  }

  fatal(message: string, context?: LogContext, error?: Error) {
    return this.log(LogLevel.FATAL, message, context, error);
  }

  // Timing helper
  async time<T>(
    name: string,
    operation: () => Promise<T>,
    context?: LogContext
  ): Promise<T> {
    const startTime = Date.now();
    const operationId = generateRequestId();

    await this.debug(`Starting ${name}`, {
      ...context,
      operation_id: operationId,
    });

    try {
      const result = await operation();
      const duration = Date.now() - startTime;

      await this.info(`Completed ${name}`, {
        ...context,
        operation_id: operationId,
        duration_ms: duration,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      await this.error(`Failed ${name}`, {
        ...context,
        operation_id: operationId,
        duration_ms: duration,
      }, error instanceof Error ? error : new Error(String(error)));

      throw error;
    }
  }

  // Create child logger with additional context
  child(additionalMetadata: Partial<LogMetadata>): JiraLogger {
    return new JiraLogger({
      minLevel: this.minLevel,
      destinations: this.destinations,
      defaultMetadata: {
        ...this.defaultMetadata,
        ...additionalMetadata,
      },
      enableRedaction: this.enableRedaction,
      enableSampling: this.enableSampling,
      samplingRate: this.samplingRate,
    });
  }

  // Flush all destinations
  async flush() {
    await Promise.all(
      this.destinations.map(dest => {
        if (dest instanceof DatabaseDestination) {
          return dest.flush();
        }
        return Promise.resolve();
      })
    );
  }

  // Close all destinations
  async close() {
    await Promise.all(
      this.destinations.map(dest => {
        if (dest instanceof DatabaseDestination) {
          return dest.close();
        }
        return Promise.resolve();
      })
    );
  }
}

// Export singleton instance
let sharedLogger: JiraLogger | null = null;

export function getLogger(metadata?: Partial<LogMetadata>): JiraLogger {
  if (!sharedLogger) {
    sharedLogger = new JiraLogger({
      minLevel: Deno.env.get('LOG_LEVEL') as LogLevel || LogLevel.INFO,
      defaultMetadata: {
        function: 'jira-sync',
        version: '1.0.0',
        environment: Deno.env.get('ENVIRONMENT') || 'production',
        ...metadata,
      },
    });
  }
  return sharedLogger;
}

export async function closeLogger() {
  if (sharedLogger) {
    await sharedLogger.close();
    sharedLogger = null;
  }
}