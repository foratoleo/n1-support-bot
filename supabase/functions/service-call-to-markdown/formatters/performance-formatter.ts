import { BaseFormatter } from './base.ts';
import { ServiceCallMetadata } from '../types.ts';

/**
 * Performance test result structure from PageSpeed Insights
 */
interface PerformanceResult {
  score: number;
  metrics: {
    lcp: CoreWebVitalMetric;
    fid: CoreWebVitalMetric;
    cls: CoreWebVitalMetric;
    fcp: CoreWebVitalMetric;
    si: CoreWebVitalMetric;
    tbt: CoreWebVitalMetric;
    tti: CoreWebVitalMetric;
  };
  audits: Record<string, PerformanceAudit>;
  resourceSummary?: {
    items: Array<{
      resourceType: string;
      label: string;
      requestCount: number;
      transferSize: number;
    }>;
  };
  opportunities?: Array<{
    id: string;
    title: string;
    description: string;
    score: number;
    numericValue: number;
    numericUnit: string;
    overallSavingsMs?: number;
    details?: Record<string, unknown>;
  }>;
  fetchTime: string;
  requestedUrl: string;
  finalUrl: string;
  warnings?: string[];
  timestamp: string;
}

interface CoreWebVitalMetric {
  numericValue: number;
  score: number;
  displayValue: string;
  description: string;
}

interface PerformanceAudit {
  id: string;
  title: string;
  description: string;
  score: number | null;
  scoreDisplayMode?: string;
  displayValue?: string;
  details?: {
    type?: string;
    items?: unknown[];
    headings?: Array<{ key: string; label: string; itemType?: string }>;
    summary?: Record<string, unknown>;
    debugData?: unknown;
    [key: string]: unknown;
  };
  numericValue?: number;
  numericUnit?: string;
  warnings?: string[];
  errorMessage?: string;
}

/**
 * Core Web Vitals thresholds based on Google's recommendations
 */
const CORE_WEB_VITALS_THRESHOLDS = {
  lcp: { good: 2500, needsImprovement: 4000 }, // milliseconds
  fid: { good: 100, needsImprovement: 300 }, // milliseconds
  cls: { good: 0.1, needsImprovement: 0.25 }, // score
  fcp: { good: 1800, needsImprovement: 3000 }, // milliseconds
  si: { good: 3400, needsImprovement: 5800 }, // milliseconds
  tbt: { good: 200, needsImprovement: 600 }, // milliseconds
  tti: { good: 3800, needsImprovement: 7300 }, // milliseconds
};

export class PerformanceFormatter extends BaseFormatter {
  /**
   * Formats performance test results into markdown
   */
  format(responseBody: any, metadata: ServiceCallMetadata): string {
    const result = responseBody as PerformanceResult;
    const score = Math.round(result.score || 0);
    const performanceCategory = this.getPerformanceCategory(score);

    let markdown = '';

    // Header
    markdown += this.generateHeader(
      'Relatório de Teste de Performance',
      result.finalUrl || metadata.requestUrl || 'N/A',
      score,
      this.formatTimestamp(result.timestamp || result.fetchTime || metadata.generatedAt),
      metadata
    );

    // Executive Summary
    markdown += `## Resumo Executivo\n\n`;
    markdown += `**Categoria de Performance**: ${performanceCategory.label} ${performanceCategory.emoji}\n\n`;
    markdown += this.getScoreInterpretation(score);
    markdown += '\n\n';

    // Core Web Vitals
    markdown += `## Core Web Vitals\n\n`;
    markdown += `As Core Web Vitals são métricas essenciais que refletem a experiência real do usuário:\n\n`;
    markdown += this.generateCoreWebVitalsTable(result.metrics);

    // Metrics Statistics
    const metricsStats = this.calculateMetricsStats(result.metrics);
    markdown += `### Resumo das Métricas\n\n`;
    markdown += `- ✅ **Bom**: ${metricsStats.good} métricas\n`;
    markdown += `- ⚠️ **Precisa Melhorar**: ${metricsStats.needsImprovement} métricas\n`;
    markdown += `- ❌ **Ruim**: ${metricsStats.poor} métricas\n\n`;

    // Performance Opportunities
    if (result.opportunities && result.opportunities.length > 0) {
      markdown += `## Oportunidades de Otimização\n\n`;
      markdown += `As seguintes melhorias podem acelerar significativamente o carregamento da página:\n\n`;
      markdown += this.generateOpportunitiesSection(result.opportunities);
    }

    // Resource Summary
    if (result.resourceSummary && result.resourceSummary.items.length > 0) {
      markdown += `## Resumo de Recursos\n\n`;
      markdown += this.generateResourceSummaryTable(result.resourceSummary.items);
    }

    // Detailed Audits
    markdown += `## Análise Detalhada\n\n`;
    markdown += this.generateDetailedAudits(result.audits);

    // Recommendations
    markdown += this.generateRecommendations(score, metricsStats, result.opportunities);

    // Footer
    markdown += this.generateDivider();
    markdown += `**Serviço**: ${metadata.serviceName}\n`;
    markdown += `**ID do Relatório**: ${metadata.id}\n`;
    markdown += `**Data da Análise**: ${this.formatTimestamp(metadata.generatedAt)}\n`;

    return markdown;
  }

  /**
   * Gets performance category based on score
   */
  private getPerformanceCategory(score: number): { label: string; emoji: string } {
    if (score >= 90) return { label: 'Excelente', emoji: '🟢' };
    if (score >= 50) return { label: 'Boa', emoji: '🟡' };
    return { label: 'Precisa Melhorar', emoji: '🔴' };
  }

  /**
   * Generates score interpretation text
   */
  private getScoreInterpretation(score: number): string {
    if (score >= 90) {
      return `Com uma pontuação de **${score}/100**, o site demonstra excelente performance. ` +
        `O tempo de carregamento está otimizado e proporciona uma experiência fluida aos usuários.`;
    }
    if (score >= 50) {
      return `Com uma pontuação de **${score}/100**, o site tem boa performance, mas existem oportunidades ` +
        `de melhoria. Algumas otimizações podem melhorar significativamente a experiência do usuário.`;
    }
    return `Com uma pontuação de **${score}/100**, o site apresenta problemas significativos de performance. ` +
      `É necessário implementar otimizações para melhorar a velocidade de carregamento e a experiência do usuário.`;
  }

  /**
   * Generates Core Web Vitals table with assessments
   */
  private generateCoreWebVitalsTable(metrics: PerformanceResult['metrics']): string {
    let table = `| Métrica | Valor | Avaliação | Descrição |\n`;
    table += `|---------|-------|-----------|------------|\n`;

    // LCP - Largest Contentful Paint
    const lcpAssessment = this.getMetricAssessment('lcp', metrics.lcp.numericValue);
    table += `| **LCP** | ${metrics.lcp.displayValue} | ${lcpAssessment.emoji} ${lcpAssessment.label} | Tempo até o maior elemento visível |\n`;

    // FID - First Input Delay
    const fidAssessment = this.getMetricAssessment('fid', metrics.fid.numericValue);
    table += `| **FID** | ${metrics.fid.displayValue} | ${fidAssessment.emoji} ${fidAssessment.label} | Tempo até a primeira interação |\n`;

    // CLS - Cumulative Layout Shift
    const clsAssessment = this.getMetricAssessment('cls', metrics.cls.numericValue);
    table += `| **CLS** | ${metrics.cls.displayValue} | ${clsAssessment.emoji} ${clsAssessment.label} | Estabilidade visual do layout |\n`;

    // FCP - First Contentful Paint
    const fcpAssessment = this.getMetricAssessment('fcp', metrics.fcp.numericValue);
    table += `| **FCP** | ${metrics.fcp.displayValue} | ${fcpAssessment.emoji} ${fcpAssessment.label} | Tempo até o primeiro conteúdo |\n`;

    // SI - Speed Index
    const siAssessment = this.getMetricAssessment('si', metrics.si.numericValue);
    table += `| **SI** | ${metrics.si.displayValue} | ${siAssessment.emoji} ${siAssessment.label} | Velocidade de carregamento visual |\n`;

    // TBT - Total Blocking Time
    const tbtAssessment = this.getMetricAssessment('tbt', metrics.tbt.numericValue);
    table += `| **TBT** | ${metrics.tbt.displayValue} | ${tbtAssessment.emoji} ${tbtAssessment.label} | Tempo total de bloqueio |\n`;

    // TTI - Time to Interactive
    const ttiAssessment = this.getMetricAssessment('tti', metrics.tti.numericValue);
    table += `| **TTI** | ${metrics.tti.displayValue} | ${ttiAssessment.emoji} ${ttiAssessment.label} | Tempo até interatividade completa |\n`;

    table += '\n';
    return table;
  }

  /**
   * Gets metric assessment based on thresholds
   */
  private getMetricAssessment(metric: string, value: number): { label: string; emoji: string } {
    const thresholds = CORE_WEB_VITALS_THRESHOLDS[metric as keyof typeof CORE_WEB_VITALS_THRESHOLDS];
    if (!thresholds) return { label: 'N/A', emoji: '⚪' };

    if (value <= thresholds.good) return { label: 'Bom', emoji: '✅' };
    if (value <= thresholds.needsImprovement) return { label: 'Precisa Melhorar', emoji: '⚠️' };
    return { label: 'Ruim', emoji: '❌' };
  }

  /**
   * Calculates metrics statistics
   */
  private calculateMetricsStats(metrics: PerformanceResult['metrics']): {
    good: number;
    needsImprovement: number;
    poor: number;
  } {
    const stats = { good: 0, needsImprovement: 0, poor: 0 };

    Object.entries(metrics).forEach(([key, metric]) => {
      const assessment = this.getMetricAssessment(key, metric.numericValue);
      if (assessment.emoji === '✅') stats.good++;
      else if (assessment.emoji === '⚠️') stats.needsImprovement++;
      else if (assessment.emoji === '❌') stats.poor++;
    });

    return stats;
  }

  /**
   * Generates opportunities section
   */
  private generateOpportunitiesSection(opportunities: NonNullable<PerformanceResult['opportunities']>): string {
    let section = '';

    // Sort by overall savings (highest first) - show ALL opportunities
    const sortedOpportunities = [...opportunities]
      .filter(opp => opp.overallSavingsMs && opp.overallSavingsMs > 0)
      .sort((a, b) => (b.overallSavingsMs || 0) - (a.overallSavingsMs || 0));

    if (sortedOpportunities.length === 0) {
      section += `*Nenhuma oportunidade significativa de otimização identificada.*\n\n`;
      return section;
    }

    sortedOpportunities.forEach((opportunity, index) => {
      section += `### ${index + 1}. ${opportunity.title}\n\n`;
      section += `**Economia Estimada**: ${this.formatMilliseconds(opportunity.overallSavingsMs || 0)}\n\n`;
      section += `${opportunity.description}\n\n`;

      if (opportunity.details?.items && Array.isArray(opportunity.details.items)) {
        const items = opportunity.details.items as any[];
        if (items.length > 0) {
          section += `**Recursos afetados** (${items.length} total):\n`;
          items.forEach(item => {
            if (item.url) {
              section += `- \`${this.truncateUrl(item.url)}\`\n`;
            }
          });
          section += '\n';
        }
      }
    });

    return section;
  }

  /**
   * Generates resource summary table
   */
  private generateResourceSummaryTable(items: NonNullable<PerformanceResult['resourceSummary']>['items']): string {
    let table = `| Tipo de Recurso | Quantidade | Tamanho | Percentual |\n`;
    table += `|-----------------|------------|---------|------------|\n`;

    const totalSize = items.reduce((sum, item) => sum + item.transferSize, 0);
    const totalCount = items.reduce((sum, item) => sum + item.requestCount, 0);

    // Sort by transfer size (largest first)
    const sortedItems = [...items].sort((a, b) => b.transferSize - a.transferSize);

    sortedItems.forEach(item => {
      const percentage = totalSize > 0 ? ((item.transferSize / totalSize) * 100).toFixed(1) : '0.0';
      table += `| ${item.label} | ${item.requestCount} | ${this.formatBytes(item.transferSize)} | ${percentage}% |\n`;
    });

    // Add totals row
    table += `| **Total** | **${totalCount}** | **${this.formatBytes(totalSize)}** | **100%** |\n`;

    table += '\n';
    return table;
  }

  /**
   * Generates detailed audits section - includes ALL audits with complete information
   */
  private generateDetailedAudits(audits: Record<string, PerformanceAudit>): string {
    let section = '';

    // Categorize audits - include ALL audits, even those marked as notApplicable
    const categories = {
      'Métricas de Performance': [] as PerformanceAudit[],
      'Diagnósticos': [] as PerformanceAudit[],
      'Oportunidades': [] as PerformanceAudit[],
      'Informações Adicionais': [] as PerformanceAudit[],
      'Outros': [] as PerformanceAudit[],
    };

    Object.values(audits).forEach(audit => {
      // Include audits marked as notApplicable in a separate category
      if (audit.scoreDisplayMode === 'notApplicable') {
        categories['Informações Adicionais'].push(audit);
        return;
      }

      if (audit.id.includes('metrics') || audit.id.includes('speed') || audit.id.includes('paint')) {
        categories['Métricas de Performance'].push(audit);
      } else if (audit.id.includes('diagnostics') || audit.id.includes('main-thread')) {
        categories['Diagnósticos'].push(audit);
      } else if (audit.numericUnit === 'millisecond' && audit.numericValue && audit.numericValue > 0) {
        categories['Oportunidades'].push(audit);
      } else {
        categories['Outros'].push(audit);
      }
    });

    // Generate sections for each category - show ALL audits
    Object.entries(categories).forEach(([categoryName, categoryAudits]) => {
      if (categoryAudits.length === 0) return;

      section += `### ${categoryName}\n\n`;

      // Sort audits by score (worst first)
      const sortedAudits = [...categoryAudits].sort((a, b) => {
        const scoreA = a.score !== null ? a.score : 1;
        const scoreB = b.score !== null ? b.score : 1;
        return scoreA - scoreB;
      });

      sortedAudits.forEach(audit => {
        const icon = this.getAuditIcon(audit.score);
        const scoreText = audit.score !== null ? `${Math.round(audit.score * 100)}/100` : 'N/A';

        section += `- ${icon} **${audit.title}**: ${scoreText}`;
        if (audit.displayValue) {
          section += ` (${audit.displayValue})`;
        }
        section += '\n';

        // Include full description for complete information
        if (audit.description) {
          section += `  - ${audit.description}\n`;
        }

        // Include warnings if present
        if (audit.warnings && audit.warnings.length > 0) {
          section += `  - ⚠️ Avisos: ${audit.warnings.join(', ')}\n`;
        }

        // Include error messages if present
        if (audit.errorMessage) {
          section += `  - ❌ Erro: ${audit.errorMessage}\n`;
        }
      });

      section += '\n';
    });

    return section;
  }

  /**
   * Gets icon for audit based on score
   */
  private getAuditIcon(score: number | null): string {
    if (score === null) return '⚪';
    if (score >= 0.9) return '✅';
    if (score >= 0.5) return '⚠️';
    return '❌';
  }

  /**
   * Generates recommendations based on results
   */
  private generateRecommendations(
    score: number,
    metricsStats: { good: number; needsImprovement: number; poor: number },
    opportunities?: PerformanceResult['opportunities']
  ): string {
    let section = `## Recomendações\n\n`;

    if (score >= 90 && metricsStats.poor === 0) {
      section += `### ✅ Performance Excelente\n\n`;
      section += `O site já apresenta excelente performance. Para manter este padrão:\n\n`;
      section += `- Monitore continuamente as métricas de performance\n`;
      section += `- Teste novas funcionalidades antes de publicar\n`;
      section += `- Mantenha as dependências atualizadas\n`;
      section += `- Implemente cache eficiente\n`;
      section += `- Use CDN para recursos estáticos\n\n`;
    } else if (score >= 50) {
      section += `### ⚠️ Melhorias Recomendadas\n\n`;
      section += `**Prioridade Alta:**\n\n`;

      if (metricsStats.poor > 0) {
        section += `- Foque nas métricas com avaliação "Ruim" (${metricsStats.poor} métricas)\n`;
      }
      if (opportunities && opportunities.length > 0) {
        const totalSavings = opportunities.reduce((sum, opp) => sum + (opp.overallSavingsMs || 0), 0);
        section += `- Implemente as otimizações sugeridas (economia potencial: ${this.formatMilliseconds(totalSavings)})\n`;
      }
      section += `- Otimize imagens (formatos modernos como WebP)\n`;
      section += `- Minimize JavaScript e CSS\n`;
      section += `- Implemente lazy loading para imagens\n`;
      section += `- Configure compressão GZIP/Brotli\n\n`;
    } else {
      section += `### ❌ Ação Urgente Necessária\n\n`;
      section += `A performance atual está impactando significativamente a experiência do usuário.\n\n`;
      section += `**Ações Imediatas:**\n\n`;
      section += `1. **Otimize recursos críticos**: Reduza o tamanho de JavaScript e CSS\n`;
      section += `2. **Melhore o tempo de resposta do servidor**: Use cache e CDN\n`;
      section += `3. **Otimize imagens**: Comprima e use formatos modernos\n`;
      section += `4. **Remova código não utilizado**: Faça tree-shaking e code splitting\n`;
      section += `5. **Minimize requisições**: Combine arquivos quando possível\n\n`;

      section += `**Considere:**\n`;
      section += `- Contratar especialista em performance web\n`;
      section += `- Realizar auditoria completa de infraestrutura\n`;
      section += `- Implementar monitoramento contínuo de performance\n\n`;
    }

    section += `### 📚 Recursos de Referência\n\n`;
    section += `- [Web.dev Performance](https://web.dev/performance/) - Guias do Google sobre performance\n`;
    section += `- [Core Web Vitals](https://web.dev/vitals/) - Métricas essenciais de performance\n`;
    section += `- [PageSpeed Insights](https://pagespeed.web.dev/) - Ferramenta de análise\n`;
    section += `- [Chrome DevTools](https://developer.chrome.com/docs/devtools/speed/get-started/) - Análise detalhada\n\n`;

    return section;
  }

  /**
   * Formats milliseconds to human-readable format
   */
  private formatMilliseconds(ms: number): string {
    if (ms < 1000) return `${Math.round(ms)} ms`;
    return `${(ms / 1000).toFixed(1)} s`;
  }

  /**
   * Formats bytes to human-readable format
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.floor(Math.log(bytes) / Math.log(1024));
    const value = bytes / Math.pow(1024, index);
    return `${value.toFixed(1)} ${units[index]}`;
  }

  /**
   * Truncates long URLs for display
   */
  private truncateUrl(url: string, maxLength: number = 60): string {
    if (url.length <= maxLength) return url;
    const start = url.substring(0, 25);
    const end = url.substring(url.length - 25);
    return `${start}...${end}`;
  }
}

/**
 * Export function for edge function usage
 */
export function formatPerformanceResultToMarkdown(serviceCall: any): string {
  const formatter = new PerformanceFormatter();
  const metadata: ServiceCallMetadata = {
    id: serviceCall.id,
    serviceName: serviceCall.service_name,
    serviceCategory: serviceCall.service_category,
    requestUrl: serviceCall.request_data?.targetUrl || '',
    generatedAt: serviceCall.created_at,
  };

  return formatter.format(serviceCall.response_body, metadata);
}