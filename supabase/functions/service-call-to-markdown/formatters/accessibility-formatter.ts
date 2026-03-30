import { BaseFormatter } from './base.ts';
import { AccessibilityResult, AccessibilityAudit, ServiceCallMetadata } from '../types.ts';
import {
  CRITICAL_SCORE_THRESHOLD,
  WARNING_SCORE_THRESHOLD,
  WCAG_LEVEL_AAA_THRESHOLD,
  WCAG_LEVEL_AA_THRESHOLD,
  WCAG_LEVEL_A_THRESHOLD,
  AUDIT_CATEGORIES,
} from '../config.ts';

export class AccessibilityFormatter extends BaseFormatter {
  format(responseBody: any, metadata: ServiceCallMetadata): string {
    const result = responseBody as AccessibilityResult;
    const score = Math.round(result.score || 0);
    const wcagLevel = this.getWCAGLevel(score / 100);

    let markdown = '';

    markdown += this.generateHeader(
      'Relatório de Teste de Acessibilidade',
      result.finalUrl || metadata.requestUrl || 'N/A',
      score,
      this.formatTimestamp(result.timestamp || result.fetchTime || metadata.generatedAt),
      metadata
    );

    markdown += `**Nível de Conformidade WCAG**: ${wcagLevel}\n\n`;

    const auditStats = this.calculateAuditStats(result.audits);
    markdown += `## Resumo da Análise\n\n`;
    markdown += `Pontuação geral de acessibilidade: **${score}%**\n\n`;
    markdown += `Este relatório apresenta a avaliação de acessibilidade da página web com base nos padrões WCAG (Web Content Accessibility Guidelines). A análise identifica barreiras que podem impedir ou dificultar o acesso ao conteúdo por pessoas com deficiência.\n\n`;
    markdown += `- Total de auditorias realizadas: **${auditStats.total}**\n`;
    markdown += `- Critérios atendidos: **${auditStats.passed}**\n`;
    markdown += `- Critérios não atendidos: **${auditStats.failed}**\n`;
    markdown += `- Pontos de atenção: **${auditStats.warnings}**\n`;
    markdown += `- Não aplicável ao contexto: **${auditStats.notApplicable}**\n`;
    markdown += `- Requer verificação manual: **${auditStats.manual}**\n\n`;

    const criticalAudits = this.filterAuditsByScore(result.audits, CRITICAL_SCORE_THRESHOLD, CRITICAL_SCORE_THRESHOLD);
    if (criticalAudits.length > 0) {
      markdown += `## Barreiras Críticas de Acessibilidade (${criticalAudits.length})\n\n`;
      markdown += `Barreiras críticas são problemas que impedem completamente o acesso ao conteúdo ou funcionalidade para usuários com deficiência. Estas questões violam requisitos fundamentais de acessibilidade e podem resultar em exclusão total de grupos de usuários.\n\n`;
      markdown += this.formatAuditSection(criticalAudits);
    }

    const warningAudits = this.filterAuditsByScore(result.audits, 0.01, WARNING_SCORE_THRESHOLD - 0.01);
    if (warningAudits.length > 0) {
      markdown += `## Pontos de Atenção (${warningAudits.length})\n\n`;
      markdown += `Pontos de atenção são questões que dificultam o acesso ou a experiência de uso, mas não impedem completamente a utilização do conteúdo. A correção destes pontos melhora significativamente a experiência de todos os usuários.\n\n`;
      markdown += this.formatAuditSection(warningAudits);
    }

    const passedAudits = this.filterAuditsByScore(result.audits, WARNING_SCORE_THRESHOLD, 1.0);
    if (passedAudits.length > 0) {
      markdown += `## Critérios Atendidos (${passedAudits.length})\n\n`;
      markdown += `Os seguintes critérios de acessibilidade foram atendidos na análise:\n\n`;
      passedAudits.forEach(audit => {
        markdown += `- ${audit.title}\n`;
      });
      markdown += '\n';
    }

    markdown += `## Análise Detalhada por Categoria\n\n`;
    markdown += this.generateDetailedResults(result.audits);

    markdown += this.generateGuidelines(criticalAudits, warningAudits, score);

    markdown += this.generateDivider();
    markdown += `**Serviço**: ${metadata.serviceName}\n`;
    markdown += `**ID do Relatório**: ${metadata.id}\n`;
    markdown += `**Data da Análise**: ${this.formatTimestamp(metadata.generatedAt)}\n`;

    return markdown;
  }

  private getWCAGLevel(score: number): string {
    if (score >= WCAG_LEVEL_AAA_THRESHOLD) return 'AAA (Nível Máximo de Conformidade)';
    if (score >= WCAG_LEVEL_AA_THRESHOLD) return 'AA (Conformidade Avançada)';
    if (score >= WCAG_LEVEL_A_THRESHOLD) return 'A (Conformidade Mínima)';
    return 'Abaixo do Nível A (Não Conforme)';
  }

  private calculateAuditStats(audits: Record<string, AccessibilityAudit>) {
    const stats = {
      total: 0,
      passed: 0,
      failed: 0,
      warnings: 0,
      notApplicable: 0,
      manual: 0,
    };

    Object.values(audits).forEach(audit => {
      stats.total++;

      if (audit.scoreDisplayMode === 'notApplicable') {
        stats.notApplicable++;
      } else if (audit.scoreDisplayMode === 'manual') {
        stats.manual++;
      } else if (audit.score === null) {
        stats.notApplicable++;
      } else if (audit.score === CRITICAL_SCORE_THRESHOLD) {
        stats.failed++;
      } else if (audit.score < WARNING_SCORE_THRESHOLD) {
        stats.warnings++;
      } else {
        stats.passed++;
      }
    });

    return stats;
  }

  private filterAuditsByScore(
    audits: Record<string, AccessibilityAudit>,
    minScore: number,
    maxScore: number
  ): AccessibilityAudit[] {
    return Object.values(audits).filter(audit => {
      if (audit.scoreDisplayMode === 'notApplicable' || audit.scoreDisplayMode === 'manual') {
        return false;
      }
      if (audit.score === null) return false;
      return audit.score >= minScore && audit.score <= maxScore;
    });
  }

  private formatAuditSection(audits: AccessibilityAudit[]): string {
    let section = '';

    audits.forEach(audit => {
      section += `### ${audit.title}\n\n`;
      section += `**Pontuação**: ${audit.score !== null ? Math.round(audit.score * 100) : 'N/A'}/100\n\n`;

      if (audit.details?.debugData?.impact) {
        const impactDescription = this.getImpactDescription(audit.details.debugData.impact);
        section += `**Nível de Impacto**: ${impactDescription}\n\n`;
      }

      section += `**Descrição**: ${audit.description}\n\n`;

      if (audit.details?.items && audit.details.items.length > 0) {
        section += `**Elementos identificados** (${audit.details.items.length}):\n\n`;

        audit.details.items.forEach((item, index) => {
          section += `${index + 1}. `;

          if (item.node) {
            if (item.node.selector) {
              section += `Seletor CSS: \`${item.node.selector}\`\n`;
            }
            if (item.node.snippet) {
              section += `   \`\`\`html\n   ${item.node.snippet}\n   \`\`\`\n`;
            }
            if (item.node.explanation) {
              section += `   Observação: ${item.node.explanation}\n`;
            }
          }

          if (item.subItems) {
            section += `   Detalhes adicionais:\n`;
            Object.entries(item.subItems).forEach(([key, value]) => {
              section += `   - ${key}: ${value}\n`;
            });
          }

          section += '\n';
        });
      }

      if (audit.details?.debugData?.tags && audit.details.debugData.tags.length > 0) {
        const wcagTags = audit.details.debugData.tags.filter((tag: string) =>
          tag.toLowerCase().includes('wcag')
        );
        if (wcagTags.length > 0) {
          section += `**Critérios WCAG relacionados**: ${wcagTags.join(', ')}\n\n`;
        }
      }

      section += this.generateDivider();
    });

    return section;
  }

  private getImpactDescription(impact: string): string {
    const impacts: Record<string, string> = {
      'critical': 'Crítico - Impede completamente o acesso ao conteúdo para usuários com deficiência específica',
      'serious': 'Grave - Causa dificuldades significativas no acesso ao conteúdo',
      'moderate': 'Moderado - Causa dificuldades no acesso, mas existem formas alternativas de uso',
      'minor': 'Menor - Causa pequenos inconvenientes que não impedem o acesso'
    };
    return impacts[impact.toLowerCase()] || impact;
  }

  private generateDetailedResults(audits: Record<string, AccessibilityAudit>): string {
    let section = '';
    const categorizedAudits = this.categorizeAudits(audits);

    Object.entries(categorizedAudits).forEach(([category, categoryAudits]) => {
      if (categoryAudits.length === 0) return;

      section += `### ${category}\n\n`;

      categoryAudits.forEach(audit => {
        const scoreText = audit.score !== null ? `${Math.round(audit.score * 100)}/100` : 'N/A';
        section += `- **${audit.title}**: ${scoreText}\n`;
      });

      section += '\n';
    });

    return section;
  }

  private categorizeAudits(audits: Record<string, AccessibilityAudit>): Record<string, AccessibilityAudit[]> {
    const categorized: Record<string, AccessibilityAudit[]> = {
      'Atributos ARIA': [],
      'Nomes e Rótulos': [],
      'Contraste de Cores': [],
      'Navegação': [],
      'Estrutura e Semântica': [],
      'Formulários': [],
      'Idioma': [],
      'Multimídia': [],
      'Melhores Práticas': [],
      'Outros': [],
    };

    Object.values(audits).forEach(audit => {
      if (audit.scoreDisplayMode === 'notApplicable' || audit.scoreDisplayMode === 'manual') {
        return;
      }

      let categoryFound = false;

      if (AUDIT_CATEGORIES.ARIA.some(keyword => audit.id.includes(keyword))) {
        categorized['Atributos ARIA'].push(audit);
        categoryFound = true;
      }
      else if (AUDIT_CATEGORIES.NAMES_LABELS.some(keyword => audit.id.includes(keyword))) {
        categorized['Nomes e Rótulos'].push(audit);
        categoryFound = true;
      }
      else if (AUDIT_CATEGORIES.COLOR_CONTRAST.some(keyword => audit.id.includes(keyword))) {
        categorized['Contraste de Cores'].push(audit);
        categoryFound = true;
      }
      else if (AUDIT_CATEGORIES.NAVIGATION.some(keyword => audit.id.includes(keyword))) {
        categorized['Navegação'].push(audit);
        categoryFound = true;
      }
      else if (AUDIT_CATEGORIES.STRUCTURE.some(keyword => audit.id.includes(keyword))) {
        categorized['Estrutura e Semântica'].push(audit);
        categoryFound = true;
      }
      else if (AUDIT_CATEGORIES.FORMS.some(keyword => audit.id.includes(keyword))) {
        categorized['Formulários'].push(audit);
        categoryFound = true;
      }
      else if (AUDIT_CATEGORIES.LANGUAGE.some(keyword => audit.id.includes(keyword))) {
        categorized['Idioma'].push(audit);
        categoryFound = true;
      }
      else if (AUDIT_CATEGORIES.MULTIMEDIA.some(keyword => audit.id.includes(keyword))) {
        categorized['Multimídia'].push(audit);
        categoryFound = true;
      }
      else if (AUDIT_CATEGORIES.BEST_PRACTICES.some(keyword => audit.id.includes(keyword))) {
        categorized['Melhores Práticas'].push(audit);
        categoryFound = true;
      }

      if (!categoryFound) {
        categorized['Outros'].push(audit);
      }
    });

    return categorized;
  }

  private generateGuidelines(
    criticalAudits: AccessibilityAudit[],
    warningAudits: AccessibilityAudit[],
    score: number
  ): string {
    let section = `## Orientações para Adequação\n\n`;

    if (criticalAudits.length === 0 && warningAudits.length === 0 && score >= 95) {
      section += `O site demonstra alto nível de conformidade com os padrões de acessibilidade WCAG. A manutenção deste padrão requer monitoramento contínuo, especialmente ao adicionar novos conteúdos ou funcionalidades.\n\n`;
      section += `### Manutenção da Conformidade\n\n`;
      section += `- Realizar auditorias periódicas de acessibilidade\n`;
      section += `- Incluir testes de acessibilidade no processo de desenvolvimento\n`;
      section += `- Validar novos componentes antes da publicação\n`;
      section += `- Manter a equipe atualizada sobre práticas de acessibilidade\n\n`;
      return section;
    }

    section += `### Processo de Adequação\n\n`;

    if (criticalAudits.length > 0) {
      section += `**Prioridade 1 - Barreiras Críticas**\n\n`;
      section += `Foram identificadas ${criticalAudits.length} barreiras críticas que impedem o acesso ao conteúdo. Estas questões violam requisitos fundamentais de acessibilidade e devem ser tratadas prioritariamente.\n\n`;
      section += `Impacto: Usuários com deficiência podem estar completamente impedidos de acessar funcionalidades ou conteúdos essenciais.\n\n`;
    }

    if (warningAudits.length > 0) {
      section += `**Prioridade 2 - Pontos de Atenção**\n\n`;
      section += `Foram identificados ${warningAudits.length} pontos de atenção que dificultam a experiência de uso. Embora não impeçam completamente o acesso, estas questões criam barreiras significativas.\n\n`;
      section += `Impacto: A experiência de navegação é comprometida, exigindo esforço adicional ou conhecimento técnico específico dos usuários.\n\n`;
    }

    section += `### Validação das Adequações\n\n`;
    section += `**Testes Automatizados**\n`;
    section += `- Executar ferramentas de análise automatizada após implementação das correções\n`;
    section += `- Validar se as mudanças não introduziram novos problemas\n`;
    section += `- Documentar as correções realizadas\n\n`;

    section += `**Testes com Tecnologias Assistivas**\n`;
    section += `- NVDA (Windows) - Leitor de tela gratuito e amplamente utilizado\n`;
    section += `- JAWS (Windows) - Leitor de tela comercial com ampla base de usuários\n`;
    section += `- VoiceOver (macOS/iOS) - Leitor de tela nativo da Apple\n`;
    section += `- Navegação por teclado - Testar todo o fluxo sem uso do mouse\n\n`;

    section += `**Testes com Usuários**\n`;
    section += `- Conduzir testes de usabilidade com pessoas com deficiência\n`;
    section += `- Coletar feedback sobre a experiência de navegação\n`;
    section += `- Identificar barreiras não detectadas por ferramentas automatizadas\n\n`;

    section += `### Recursos de Referência\n\n`;
    section += `**Documentação Oficial**\n`;
    section += `- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/) - Referência rápida dos critérios WCAG\n`;
    section += `- [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/) - Padrões de implementação ARIA\n\n`;

    section += `**Ferramentas e Recursos**\n`;
    section += `- [WebAIM](https://webaim.org/) - Recursos educacionais sobre acessibilidade web\n`;
    section += `- [A11Y Project](https://www.a11yproject.com/) - Guias práticos de implementação\n`;
    section += `- [Deque University](https://dequeuniversity.com/) - Treinamentos em acessibilidade digital\n\n`;

    section += `**Legislação e Normas**\n`;
    section += `- Lei Brasileira de Inclusão (LBI - Lei 13.146/2015)\n`;
    section += `- Modelo de Acessibilidade em Governo Eletrônico (eMAG)\n`;
    section += `- Section 508 (Estados Unidos)\n`;
    section += `- European Accessibility Act (União Europeia)\n\n`;

    return section;
  }
}
