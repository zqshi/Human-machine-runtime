import type { Agent } from './Agent';
import type { CapabilityTemplate } from './CapabilityTemplate';
import type { CapabilityRegistry } from './CapabilityRegistry';
import type { AgentCapabilityProfile } from './AgentCapabilityProfile';
import type { TaskContract } from './TaskContract';
import { RoutingScorer, type AgentScore } from './RoutingScorer';

export type RouteResult =
  | { action: 'reuse'; agent: Agent; template: CapabilityTemplate }
  | { action: 'create'; template: CapabilityTemplate };

export interface DetectedIntent {
  templateId: string;
  confidence: number;
  matchedKeywords: string[];
}

export interface ScoredRouteResult {
  routeResult: RouteResult;
  agentScore: AgentScore | null;
  intent: DetectedIntent;
}

const INTENT_PATTERNS: Array<{ templateId: string; keywords: RegExp; domain: string }> = [
  {
    templateId: 'cap-security',
    keywords: /审计|漏洞|安全|CVE|扫描安全|渗透|合规/,
    domain: 'security',
  },
  {
    templateId: 'cap-dev',
    keywords: /代码|开发|编程|重构|debug|编译|函数|API|接口开发/,
    domain: 'development',
  },
  {
    templateId: 'cap-docs',
    keywords: /文档|写作|撰写|说明书|README|wiki/,
    domain: 'documentation',
  },
  {
    templateId: 'cap-data',
    keywords: /数据|分析|报表|统计|可视化|指标|SQL/,
    domain: 'data-analysis',
  },
  { templateId: 'cap-design', keywords: /设计|UI|UX|原型|界面|视觉|Figma/, domain: 'design' },
  { templateId: 'cap-test', keywords: /测试|单测|e2e|质量|QA|Bug|回归/, domain: 'testing' },
  { templateId: 'cap-ops', keywords: /部署|运维|监控|CI|CD|Docker|K8s|告警/, domain: 'operations' },
  {
    templateId: 'cap-translate',
    keywords: /翻译|本地化|i18n|多语言|国际化/,
    domain: 'translation',
  },
];

/**
 * AgentRoutingService — 纯域服务
 *
 * 从用户输入推断能力意图，通过 RoutingScorer 加权评分选择最优 Agent。
 * 评分维度：能力匹配度 × 历史成功率 × 成本效率。
 */
export class AgentRoutingService {
  static detectIntent(text: string): DetectedIntent | null {
    let bestMatch: DetectedIntent | null = null;
    let bestMatchCount = 0;

    for (const { templateId, keywords } of INTENT_PATTERNS) {
      const matches = text.match(new RegExp(keywords.source, 'g'));
      if (matches && matches.length > bestMatchCount) {
        bestMatchCount = matches.length;
        const confidence = Math.min(0.5 + bestMatchCount * 0.15, 0.95);
        bestMatch = { templateId, confidence, matchedKeywords: matches };
      }
    }
    return bestMatch;
  }

  static route(intent: DetectedIntent, registry: CapabilityRegistry): RouteResult | null {
    const template = registry.findTemplate(intent.templateId);
    if (!template) return null;

    const existing = registry.getActiveAgent(intent.templateId);
    if (existing) {
      return { action: 'reuse', agent: existing, template };
    }
    return { action: 'create', template };
  }

  static routeWithScoring(
    intent: DetectedIntent,
    registry: CapabilityRegistry,
    profiles: readonly AgentCapabilityProfile[],
    contract: TaskContract
  ): ScoredRouteResult | null {
    const template = registry.findTemplate(intent.templateId);
    if (!template) return null;

    const patternEntry = INTENT_PATTERNS.find((p) => p.templateId === intent.templateId);
    const domain = patternEntry?.domain ?? intent.templateId;

    const candidateProfiles = profiles.filter((p) => p.domains.some((d) => d.domain === domain));

    if (candidateProfiles.length === 0) {
      const basicResult = AgentRoutingService.route(intent, registry);
      if (!basicResult) return null;
      return { routeResult: basicResult, agentScore: null, intent };
    }

    const ranked = RoutingScorer.rankAgents(candidateProfiles, contract);
    const bestScore = ranked[0];
    if (!bestScore) {
      const basicResult = AgentRoutingService.route(intent, registry);
      if (!basicResult) return null;
      return { routeResult: basicResult, agentScore: null, intent };
    }

    const existing = registry.getActiveAgent(intent.templateId);
    if (existing) {
      return {
        routeResult: { action: 'reuse', agent: existing, template },
        agentScore: bestScore,
        intent,
      };
    }

    return {
      routeResult: { action: 'create', template },
      agentScore: bestScore,
      intent,
    };
  }

  static getDomainForTemplate(templateId: string): string | undefined {
    return INTENT_PATTERNS.find((p) => p.templateId === templateId)?.domain;
  }
}
