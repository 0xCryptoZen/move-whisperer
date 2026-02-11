'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type Locale = 'en' | 'zh';

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: 'en',
  setLocale: () => {},
});

const STORAGE_KEY = 'movewhisperer-locale';

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'zh') {
      setLocaleState(stored);
    }
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem(STORAGE_KEY, l);
  }, []);

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}

const translations: Record<string, { en: string; zh: string }> = {
  // ReviewPanel header
  'review.title': { en: 'AI Analysis Confirmation', zh: 'AI 分析结果确认' },
  'review.subtitle': { en: 'Please confirm or correct the AI-inferred information below', zh: '请确认或修正以下 AI 推断的信息' },

  // ReviewPanel Q1: Contract Purpose
  'review.purpose.title': { en: 'Contract Purpose', zh: '合约用途' },
  'review.correct': { en: 'Correct', zh: '正确' },
  'review.incorrect': { en: 'Incorrect', zh: '修正' },
  'review.purpose.placeholder': { en: 'Correct the contract purpose description...', zh: '修正合约用途描述...' },

  // ReviewPanel Q2: Generic Parameters
  'review.generics.title': { en: 'Generic Parameter Semantics', zh: '泛型参数语义' },
  'review.generics.correction': { en: 'Correct generic semantics: please supplement the correct generic meaning in the business context below', zh: '修正泛型语义：请在下方业务上下文中补充正确的泛型含义' },

  // ReviewPanel Q3: Admin Functions
  'review.admin.title': { en: 'Admin Functions', zh: '管理员函数' },
  'review.admin.count': { en: '{count} total', zh: '{count} 个' },
  'review.admin.highlightRisks': { en: 'Highlight risks in documentation', zh: '在文档中特别标注风险' },
  'review.admin.addPermissions': { en: 'Add permission documentation', zh: '添加权限说明' },

  // ReviewPanel Q4: Error Codes
  'review.errors.title': { en: 'Error Codes', zh: '错误码' },
  'review.errors.count': { en: '{count} total', zh: '{count} 个' },
  'review.errors.more': { en: '... and {count} more', zh: '... 及 {count} 个更多' },
  'review.errors.generateGuide': { en: 'Generate troubleshooting guide (errors.md)', zh: '生成故障排除指南 (errors.md)' },
  'review.errors.includeInSkill': { en: 'Include common error handling in SKILL.md', zh: '在 SKILL.md 中包含常见错误处理' },

  // ReviewPanel: Business Context
  'review.context.title': { en: 'Business Context (Optional)', zh: '补充业务上下文 (可选)' },
  'review.context.placeholder': { en: 'Add any business information AI could not infer, e.g.: protocol name, business logic, special notes...', zh: '添加任何 AI 未能推断的业务信息，如：协议名称、业务逻辑、特殊说明等...' },

  // ReviewPanel: Actions
  'review.cancel': { en: 'Cancel', zh: '取消' },
  'review.confirm': { en: 'Confirm & Generate', zh: '确认并生成' },

  // ReviewPanel: Category options
  'category.dex': { en: 'DEX', zh: 'DEX - 去中心化交易所' },
  'category.nft': { en: 'NFT', zh: 'NFT - NFT市场' },
  'category.defi': { en: 'DeFi', zh: 'DeFi - 去中心化金融' },
  'category.lending': { en: 'Lending', zh: '借贷协议' },
  'category.staking': { en: 'Staking', zh: '质押' },
  'category.gaming': { en: 'Gaming', zh: '游戏' },
  'category.governance': { en: 'Governance', zh: '治理' },
  'category.utility': { en: 'Utility', zh: '工具' },
  'category.unknown': { en: 'Unknown', zh: '未知' },

  // Scene names
  'scene.sdk': { en: 'SDK Integration', zh: 'SDK 集成' },
  'scene.learn': { en: 'Protocol Learning', zh: '原理学习' },
  'scene.audit': { en: 'Security Audit', zh: '安全审计' },
  'scene.frontend': { en: 'Frontend Dev', zh: '前端开发' },
  'scene.bot': { en: 'Trading Bot', zh: '交易机器人' },
  'scene.docs': { en: 'Documentation', zh: '文档生成' },
  'scene.custom': { en: 'Custom Scene', zh: '自定义场景' },

  // Scene descriptions
  'scene.sdk.desc': { en: 'Function signatures, code examples, PTB patterns', zh: '函数签名、代码示例、PTB 模式' },
  'scene.learn.desc': { en: 'Architecture, concepts, state transitions', zh: '架构原理、核心概念、状态转换' },
  'scene.audit.desc': { en: 'Permission model, asset flows, risk analysis', zh: '权限模型、资产流向、风险分析' },
  'scene.frontend.desc': { en: 'User flows, data queries, event handling', zh: '用户交互流程、数据查询、事件处理' },
  'scene.bot.desc': { en: 'Entry functions, gas optimization, monitoring', zh: '入口函数、Gas 优化、监控策略' },
  'scene.docs.desc': { en: 'API reference, terminology, FAQ', zh: 'API 参考文档、术语定义、常见问题' },
  'scene.custom.desc': { en: 'Define your own focus areas', zh: '自定义你的关注领域' },

  // Scene use-case hints
  'scene.sdk.hint': { en: 'Best for: building dApps & integrations', zh: '适用于：构建 dApp 与集成开发' },
  'scene.learn.hint': { en: 'Best for: understanding protocol design', zh: '适用于：理解协议设计原理' },
  'scene.audit.hint': { en: 'Best for: security review & risk assessment', zh: '适用于：安全审查与风险评估' },
  'scene.frontend.hint': { en: 'Best for: UI development & user interaction', zh: '适用于：前端界面开发与用户交互' },
  'scene.bot.hint': { en: 'Best for: automated trading & MEV', zh: '适用于：自动化交易与 MEV 策略' },
  'scene.docs.hint': { en: 'Best for: generating API docs & guides', zh: '适用于：生成 API 文档与使用指南' },
  'scene.custom.hint': { en: 'Best for: specific needs not covered above', zh: '适用于：以上场景未覆盖的特定需求' },
};

export function useTranslation() {
  const { locale } = useLocale();

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    const entry = translations[key];
    if (!entry) return key;
    let text = entry[locale];
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(`{${k}}`, String(v));
      }
    }
    return text;
  }, [locale]);

  return { t, locale };
}
