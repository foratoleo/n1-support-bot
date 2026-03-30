/**
 * JIRA Alerting System
 *
 * Provides alerting rules, conditions, and delivery mechanisms
 * for monitoring JIRA synchronization health and performance.
 *
 * @module jira-alerts
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// Alert severity levels
export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

// Alert types
export enum AlertType {
  SYNC_FAILURE_RATE = 'sync_failure_rate',
  API_ERROR_RATE = 'api_error_rate',
  DATABASE_CONNECTION_FAILURE = 'database_connection_failure',
  HEALTH_CHECK_FAILURE = 'health_check_failure',
  SYNC_LATENCY_HIGH = 'sync_latency_high',
  RATE_LIMIT_APPROACHING = 'rate_limit_approaching',
  QUEUE_LENGTH_HIGH = 'queue_length_high',
  ERROR_RATE_HIGH = 'error_rate_high',
  CONFIG_CREATED = 'config_created',
  CONFIG_CHANGED = 'config_changed',
  BULK_SYNC_STARTED = 'bulk_sync_started',
}

export interface AlertRule {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  name: string;
  description: string;
  condition: AlertCondition;
  enabled: boolean;
  cooldown_minutes?: number; // Minimum time between alerts
  last_triggered?: string;
}

export interface AlertCondition {
  metric: string;
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq';
  threshold: number;
  window_minutes?: number; // Time window for evaluation
  consecutive_periods?: number; // Number of consecutive periods threshold must be breached
}

export interface Alert {
  id?: string;
  rule_id: string;
  project_id?: string;
  severity: AlertSeverity;
  type: AlertType;
  title: string;
  message: string;
  context?: Record<string, any>;
  triggered_at: string;
  resolved_at?: string;
  acknowledged_at?: string;
  acknowledged_by?: string;
}

export interface AlertDestination {
  send(alert: Alert): Promise<void>;
}

// Webhook destination
class WebhookDestination implements AlertDestination {
  private webhookUrl: string;
  private headers: Record<string, string>;

  constructor(webhookUrl: string, headers?: Record<string, string>) {
    this.webhookUrl = webhookUrl;
    this.headers = headers || {
      'Content-Type': 'application/json',
    };
  }

  async send(alert: Alert): Promise<void> {
    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          severity: alert.severity,
          type: alert.type,
          title: alert.title,
          message: alert.message,
          context: alert.context,
          triggered_at: alert.triggered_at,
          project_id: alert.project_id,
        }),
      });

      if (!response.ok) {
        throw new Error(`Webhook failed with status ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to send webhook alert:', error);
      throw error;
    }
  }
}

// Email destination
class EmailDestination implements AlertDestination {
  private supabase: SupabaseClient;
  private recipients: string[];

  constructor(recipients: string[]) {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.recipients = recipients;
  }

  async send(alert: Alert): Promise<void> {
    try {
      // Send email using Supabase Edge Function or external service
      const emailSubject = `[${alert.severity.toUpperCase()}] ${alert.title}`;
      const emailBody = this.formatEmailBody(alert);

      for (const recipient of this.recipients) {
        // TODO: Implement actual email sending
        // This would integrate with an email service like SendGrid, AWS SES, etc.
        console.log(`Would send email to ${recipient}: ${emailSubject}`);
      }
    } catch (error) {
      console.error('Failed to send email alert:', error);
      throw error;
    }
  }

  private formatEmailBody(alert: Alert): string {
    return `
Alert Details:
--------------
Severity: ${alert.severity}
Type: ${alert.type}
Triggered: ${alert.triggered_at}
${alert.project_id ? `Project ID: ${alert.project_id}` : ''}

Message:
${alert.message}

Context:
${JSON.stringify(alert.context, null, 2)}
    `.trim();
  }
}

// Database destination
class DatabaseAlertDestination implements AlertDestination {
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async send(alert: Alert): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('jira_alerts')
        .insert({
          rule_id: alert.rule_id,
          project_id: alert.project_id,
          severity: alert.severity,
          type: alert.type,
          title: alert.title,
          message: alert.message,
          context: alert.context || {},
          triggered_at: alert.triggered_at,
        });

      if (error) {
        throw new Error(`Failed to store alert: ${error.message}`);
      }
    } catch (error) {
      console.error('Failed to store alert in database:', error);
      throw error;
    }
  }
}

// Predefined alert rules
export const ALERT_RULES: AlertRule[] = [
  // Critical alerts
  {
    id: 'sync_failure_rate_critical',
    type: AlertType.SYNC_FAILURE_RATE,
    severity: AlertSeverity.CRITICAL,
    name: 'High Sync Failure Rate',
    description: 'Sync failure rate exceeds 10% in a 5-minute window',
    condition: {
      metric: 'sync_failure_rate',
      operator: 'gt',
      threshold: 0.10,
      window_minutes: 5,
    },
    enabled: true,
    cooldown_minutes: 15,
  },
  {
    id: 'api_error_rate_critical',
    type: AlertType.API_ERROR_RATE,
    severity: AlertSeverity.CRITICAL,
    name: 'High API Error Rate',
    description: 'JIRA API errors exceed 50 in a 1-minute window',
    condition: {
      metric: 'api_error_count',
      operator: 'gt',
      threshold: 50,
      window_minutes: 1,
    },
    enabled: true,
    cooldown_minutes: 10,
  },
  {
    id: 'db_connection_failure',
    type: AlertType.DATABASE_CONNECTION_FAILURE,
    severity: AlertSeverity.CRITICAL,
    name: 'Database Connection Failures',
    description: 'Database connection failures exceed 3 in a 1-minute window',
    condition: {
      metric: 'db_connection_errors',
      operator: 'gt',
      threshold: 3,
      window_minutes: 1,
    },
    enabled: true,
    cooldown_minutes: 5,
  },
  {
    id: 'health_check_failure',
    type: AlertType.HEALTH_CHECK_FAILURE,
    severity: AlertSeverity.CRITICAL,
    name: 'Health Check Failures',
    description: 'Health check has failed 2 consecutive times',
    condition: {
      metric: 'health_check_status',
      operator: 'eq',
      threshold: 0, // 0 = unhealthy
      consecutive_periods: 2,
    },
    enabled: true,
    cooldown_minutes: 5,
  },

  // Warning alerts
  {
    id: 'sync_latency_high',
    type: AlertType.SYNC_LATENCY_HIGH,
    severity: AlertSeverity.WARNING,
    name: 'High Sync Latency',
    description: 'Sync latency p95 exceeds 2 seconds',
    condition: {
      metric: 'sync_latency_p95',
      operator: 'gt',
      threshold: 2000, // milliseconds
      window_minutes: 5,
    },
    enabled: true,
    cooldown_minutes: 30,
  },
  {
    id: 'rate_limit_approaching',
    type: AlertType.RATE_LIMIT_APPROACHING,
    severity: AlertSeverity.WARNING,
    name: 'JIRA Rate Limit Approaching',
    description: 'JIRA API rate limit usage exceeds 80%',
    condition: {
      metric: 'rate_limit_usage_percent',
      operator: 'gt',
      threshold: 80,
    },
    enabled: true,
    cooldown_minutes: 15,
  },
  {
    id: 'queue_length_high',
    type: AlertType.QUEUE_LENGTH_HIGH,
    severity: AlertSeverity.WARNING,
    name: 'High Queue Length',
    description: 'Sync queue length exceeds 100 tasks',
    condition: {
      metric: 'sync_queue_length',
      operator: 'gt',
      threshold: 100,
    },
    enabled: true,
    cooldown_minutes: 20,
  },
  {
    id: 'error_rate_warning',
    type: AlertType.ERROR_RATE_HIGH,
    severity: AlertSeverity.WARNING,
    name: 'Elevated Error Rate',
    description: 'Error rate exceeds 5% in a 15-minute window',
    condition: {
      metric: 'error_rate',
      operator: 'gt',
      threshold: 0.05,
      window_minutes: 15,
    },
    enabled: true,
    cooldown_minutes: 30,
  },

  // Info alerts
  {
    id: 'config_created',
    type: AlertType.CONFIG_CREATED,
    severity: AlertSeverity.INFO,
    name: 'New JIRA Configuration',
    description: 'A new JIRA configuration has been created',
    condition: {
      metric: 'config_created_count',
      operator: 'gt',
      threshold: 0,
    },
    enabled: true,
    cooldown_minutes: 0,
  },
  {
    id: 'bulk_sync_started',
    type: AlertType.BULK_SYNC_STARTED,
    severity: AlertSeverity.INFO,
    name: 'Large Bulk Sync Started',
    description: 'A bulk sync operation with more than 100 tasks has started',
    condition: {
      metric: 'bulk_sync_task_count',
      operator: 'gt',
      threshold: 100,
    },
    enabled: true,
    cooldown_minutes: 0,
  },
];

export class JiraAlertManager {
  private supabase: SupabaseClient;
  private destinations: AlertDestination[];
  private rules: Map<string, AlertRule>;
  private metricCache: Map<string, number[]> = new Map();

  constructor(destinations?: AlertDestination[]) {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);

    // Initialize default destinations
    this.destinations = destinations || [
      new DatabaseAlertDestination(),
    ];

    // Add webhook if configured
    const webhookUrl = Deno.env.get('ALERT_WEBHOOK_URL');
    if (webhookUrl) {
      this.destinations.push(new WebhookDestination(webhookUrl));
    }

    // Add email if configured
    const emailRecipients = Deno.env.get('ALERT_EMAIL_RECIPIENTS');
    if (emailRecipients) {
      this.destinations.push(new EmailDestination(emailRecipients.split(',')));
    }

    // Load rules
    this.rules = new Map(ALERT_RULES.map(rule => [rule.id, rule]));
  }

  // Evaluate a metric against all rules
  async evaluateMetric(
    metric: string,
    value: number,
    projectId?: string,
    context?: Record<string, any>
  ) {
    for (const rule of this.rules.values()) {
      if (!rule.enabled || rule.condition.metric !== metric) {
        continue;
      }

      // Check cooldown
      if (rule.last_triggered && rule.cooldown_minutes) {
        const lastTriggered = new Date(rule.last_triggered).getTime();
        const cooldownMs = rule.cooldown_minutes * 60 * 1000;
        if (Date.now() - lastTriggered < cooldownMs) {
          continue;
        }
      }

      // Check if condition is met
      const shouldAlert = await this.evaluateCondition(rule.condition, value, projectId);

      if (shouldAlert) {
        await this.triggerAlert(rule, value, projectId, context);
      }
    }
  }

  private async evaluateCondition(
    condition: AlertCondition,
    value: number,
    projectId?: string
  ): Promise<boolean> {
    // Handle window-based evaluation
    if (condition.window_minutes) {
      const cacheKey = `${condition.metric}_${projectId || 'global'}`;
      if (!this.metricCache.has(cacheKey)) {
        this.metricCache.set(cacheKey, []);
      }

      const cache = this.metricCache.get(cacheKey)!;
      cache.push(value);

      // Clean old values outside window
      const cutoff = Date.now() - (condition.window_minutes * 60 * 1000);
      // Note: In production, you'd track timestamps with values
      if (cache.length > 100) {
        cache.splice(0, cache.length - 100);
      }

      // Use average or max depending on metric type
      const aggregateValue = cache.reduce((sum, v) => sum + v, 0) / cache.length;
      return this.checkOperator(condition.operator, aggregateValue, condition.threshold);
    }

    // Handle consecutive periods
    if (condition.consecutive_periods) {
      const cacheKey = `${condition.metric}_consecutive_${projectId || 'global'}`;
      if (!this.metricCache.has(cacheKey)) {
        this.metricCache.set(cacheKey, []);
      }

      const cache = this.metricCache.get(cacheKey)!;
      const meetsCondition = this.checkOperator(condition.operator, value, condition.threshold);

      if (meetsCondition) {
        cache.push(1);
      } else {
        cache.length = 0; // Reset on non-match
      }

      return cache.length >= condition.consecutive_periods;
    }

    // Simple threshold check
    return this.checkOperator(condition.operator, value, condition.threshold);
  }

  private checkOperator(operator: string, value: number, threshold: number): boolean {
    switch (operator) {
      case 'gt': return value > threshold;
      case 'gte': return value >= threshold;
      case 'lt': return value < threshold;
      case 'lte': return value <= threshold;
      case 'eq': return value === threshold;
      case 'neq': return value !== threshold;
      default: return false;
    }
  }

  private async triggerAlert(
    rule: AlertRule,
    value: number,
    projectId?: string,
    context?: Record<string, any>
  ) {
    const alert: Alert = {
      rule_id: rule.id,
      project_id: projectId,
      severity: rule.severity,
      type: rule.type,
      title: rule.name,
      message: this.formatAlertMessage(rule, value),
      context: {
        ...context,
        metric: rule.condition.metric,
        value,
        threshold: rule.condition.threshold,
      },
      triggered_at: new Date().toISOString(),
    };

    // Send to all destinations
    await Promise.all(
      this.destinations.map(dest =>
        dest.send(alert).catch(err =>
          console.error('Failed to send alert to destination:', err)
        )
      )
    );

    // Update last triggered time
    rule.last_triggered = alert.triggered_at;
  }

  private formatAlertMessage(rule: AlertRule, value: number): string {
    const { condition } = rule;
    return `${rule.description}. Current value: ${value}, Threshold: ${condition.threshold}${condition.window_minutes ? ` (${condition.window_minutes}min window)` : ''}`;
  }

  // Acknowledge an alert
  async acknowledgeAlert(alertId: string, userId: string) {
    const { error } = await this.supabase
      .from('jira_alerts')
      .update({
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: userId,
      })
      .eq('id', alertId);

    if (error) {
      throw new Error(`Failed to acknowledge alert: ${error.message}`);
    }
  }

  // Resolve an alert
  async resolveAlert(alertId: string) {
    const { error } = await this.supabase
      .from('jira_alerts')
      .update({
        resolved_at: new Date().toISOString(),
      })
      .eq('id', alertId);

    if (error) {
      throw new Error(`Failed to resolve alert: ${error.message}`);
    }
  }

  // Get active alerts
  async getActiveAlerts(projectId?: string): Promise<Alert[]> {
    let query = this.supabase
      .from('jira_alerts')
      .select('*')
      .is('resolved_at', null)
      .order('triggered_at', { ascending: false });

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get active alerts: ${error.message}`);
    }

    return data as Alert[];
  }

  // Get alert history
  async getAlertHistory(
    projectId?: string,
    limit: number = 50
  ): Promise<Alert[]> {
    let query = this.supabase
      .from('jira_alerts')
      .select('*')
      .order('triggered_at', { ascending: false })
      .limit(limit);

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get alert history: ${error.message}`);
    }

    return data as Alert[];
  }

  // Add custom rule
  addRule(rule: AlertRule) {
    this.rules.set(rule.id, rule);
  }

  // Remove rule
  removeRule(ruleId: string) {
    this.rules.delete(ruleId);
  }

  // Enable/disable rule
  setRuleEnabled(ruleId: string, enabled: boolean) {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = enabled;
    }
  }
}

// Export singleton instance
let sharedAlertManager: JiraAlertManager | null = null;

export function getAlertManager(): JiraAlertManager {
  if (!sharedAlertManager) {
    sharedAlertManager = new JiraAlertManager();
  }
  return sharedAlertManager;
}