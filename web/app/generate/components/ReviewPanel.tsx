'use client';

import { useState } from 'react';

interface GenericMapping {
  [key: string]: {
    name: string;
    description: string;
    commonTypes: string[];
  };
}

interface ErrorCode {
  name: string;
  code: number;
  description: string;
  possibleCauses: string[];
  solutions: string[];
  category: 'permission' | 'validation' | 'state' | 'math' | 'other';
}

interface ContractAnalysis {
  purpose: {
    summary: string;
    category: string;
    protocols: string[];
  };
  functions: Array<{
    name: string;
    purpose: string;
    category: 'admin' | 'user' | 'query' | 'internal';
    risk: 'high' | 'medium' | 'low';
  }>;
  generics: {
    mapping: GenericMapping;
    confidence: number;
  };
  errorCodes: ErrorCode[];
  security: {
    riskLevel: 'high' | 'medium' | 'low';
    concerns: string[];
    adminFunctions: string[];
  };
  suggestedName: string;
  confidence: number;
  fallbackUsed: boolean;
  analysisSource: 'claude' | 'regex' | 'hybrid';
}

interface UserFeedback {
  purpose: {
    confirmed: boolean;
    correction?: string;
    category?: string;
  };
  generics: {
    confirmed: boolean;
    corrections?: GenericMapping;
  };
  adminFunctions: {
    highlightRisks: boolean;
    addPermissionDocs: boolean;
  };
  errorCodes: {
    generateErrorsMd: boolean;
    includeInSkillMd: boolean;
  };
  businessContext: string;
}

interface ReviewPanelProps {
  analysis: ContractAnalysis;
  onConfirm: (feedback: UserFeedback) => void;
  onCancel: () => void;
}

const CATEGORY_OPTIONS = [
  { value: 'dex', label: 'DEX', labelZh: '去中心化交易所' },
  { value: 'nft', label: 'NFT', labelZh: 'NFT市场' },
  { value: 'defi', label: 'DeFi', labelZh: '去中心化金融' },
  { value: 'lending', label: 'Lending', labelZh: '借贷协议' },
  { value: 'staking', label: 'Staking', labelZh: '质押' },
  { value: 'gaming', label: 'Gaming', labelZh: '游戏' },
  { value: 'governance', label: 'Governance', labelZh: '治理' },
  { value: 'utility', label: 'Utility', labelZh: '工具' },
  { value: 'unknown', label: 'Unknown', labelZh: '未知' },
];

export default function ReviewPanel({ analysis, onConfirm, onCancel }: ReviewPanelProps) {
  const [feedback, setFeedback] = useState<UserFeedback>({
    purpose: {
      confirmed: true,
      category: analysis.purpose.category,
    },
    generics: {
      confirmed: true,
    },
    adminFunctions: {
      highlightRisks: true,
      addPermissionDocs: true,
    },
    errorCodes: {
      generateErrorsMd: true,
      includeInSkillMd: true,
    },
    businessContext: '',
  });

  const [purposeCorrection, setPurposeCorrection] = useState('');
  const [genericCorrections, setGenericCorrections] = useState<GenericMapping>({});

  const handlePurposeToggle = (confirmed: boolean) => {
    setFeedback(prev => ({
      ...prev,
      purpose: {
        ...prev.purpose,
        confirmed,
        correction: confirmed ? undefined : purposeCorrection,
      },
    }));
  };

  const handleGenericToggle = (confirmed: boolean) => {
    setFeedback(prev => ({
      ...prev,
      generics: {
        confirmed,
        corrections: confirmed ? undefined : genericCorrections,
      },
    }));
  };

  const handleSubmit = () => {
    const finalFeedback: UserFeedback = {
      ...feedback,
      purpose: {
        ...feedback.purpose,
        correction: !feedback.purpose.confirmed ? purposeCorrection : undefined,
      },
      generics: {
        ...feedback.generics,
        corrections: !feedback.generics.confirmed ? genericCorrections : undefined,
      },
    };
    onConfirm(finalFeedback);
  };

  const adminFuncCount = analysis.security.adminFunctions.length;
  const errorCodeCount = analysis.errorCodes.length;
  const genericCount = Object.keys(analysis.generics.mapping).length;

  return (
    <div className="glass-panel rounded-2xl p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold">AI 分析结果确认</h2>
            <p className="text-sm text-muted-foreground">
              请确认或修正以下 AI 推断的信息
            </p>
          </div>
        </div>

        {/* Analysis Source Badge */}
        <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${
          analysis.analysisSource === 'claude'
            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
            : analysis.analysisSource === 'hybrid'
            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
            : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
        }`}>
          {analysis.analysisSource === 'claude' ? '🤖 Claude AI' :
           analysis.analysisSource === 'hybrid' ? '🔄 Hybrid' : '📝 Pattern Match'}
          <span className="ml-1.5 opacity-70">
            ({Math.round(analysis.confidence * 100)}% confidence)
          </span>
        </div>
      </div>

      {/* Q1: Contract Purpose */}
      <div className="border border-white/10 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs flex items-center justify-center">1</span>
            合约用途
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => handlePurposeToggle(true)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                feedback.purpose.confirmed
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'border border-white/10 text-muted-foreground hover:border-white/20'
              }`}
            >
              ✓ 正确
            </button>
            <button
              onClick={() => handlePurposeToggle(false)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                !feedback.purpose.confirmed
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'border border-white/10 text-muted-foreground hover:border-white/20'
              }`}
            >
              ✗ 修正
            </button>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-white/5">
          <div className="flex items-center gap-3 mb-2">
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
              analysis.purpose.category === 'dex' ? 'bg-blue-500/20 text-blue-400' :
              analysis.purpose.category === 'nft' ? 'bg-purple-500/20 text-purple-400' :
              analysis.purpose.category === 'defi' ? 'bg-green-500/20 text-green-400' :
              'bg-white/10 text-white/70'
            }`}>
              {CATEGORY_OPTIONS.find(c => c.value === analysis.purpose.category)?.label || analysis.purpose.category}
            </span>
          </div>
          <p className="text-sm">{analysis.purpose.summary}</p>
        </div>

        {!feedback.purpose.confirmed && (
          <div className="space-y-2">
            <select
              value={feedback.purpose.category || analysis.purpose.category}
              onChange={(e) => setFeedback(prev => ({
                ...prev,
                purpose: { ...prev.purpose, category: e.target.value }
              }))}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-primary/50"
            >
              {CATEGORY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} - {opt.labelZh}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="修正合约用途描述..."
              value={purposeCorrection}
              onChange={(e) => setPurposeCorrection(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-primary/50"
            />
          </div>
        )}
      </div>

      {/* Q2: Generic Parameters */}
      {genericCount > 0 && (
        <div className="border border-white/10 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 text-xs flex items-center justify-center">2</span>
              泛型参数语义
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => handleGenericToggle(true)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                  feedback.generics.confirmed
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'border border-white/10 text-muted-foreground hover:border-white/20'
                }`}
              >
                ✓ 正确
              </button>
              <button
                onClick={() => handleGenericToggle(false)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                  !feedback.generics.confirmed
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'border border-white/10 text-muted-foreground hover:border-white/20'
                }`}
              >
                ✗ 修正
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {Object.entries(analysis.generics.mapping).map(([key, value]) => (
              <div key={key} className="flex items-center gap-3 p-2 rounded-lg bg-white/5">
                <code className="px-2 py-1 rounded bg-purple-500/20 text-purple-400 text-sm font-mono">
                  {key}
                </code>
                <span className="text-sm">→</span>
                <span className="text-sm font-medium">{value.name}</span>
                {value.commonTypes.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    (e.g., {value.commonTypes.join(', ')})
                  </span>
                )}
              </div>
            ))}
          </div>

          {!feedback.generics.confirmed && (
            <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <p className="text-xs text-yellow-400">
                修正泛型语义：请在下方业务上下文中补充正确的泛型含义
              </p>
            </div>
          )}
        </div>
      )}

      {/* Q3: Admin Functions */}
      {adminFuncCount > 0 && (
        <div className="border border-white/10 rounded-xl p-4 space-y-3">
          <h3 className="font-medium flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-red-500/20 text-red-400 text-xs flex items-center justify-center">3</span>
            管理员函数 ({adminFuncCount} 个)
          </h3>

          <div className="flex flex-wrap gap-2">
            {analysis.security.adminFunctions.map(func => (
              <code key={func} className="px-2 py-1 rounded bg-red-500/10 text-red-400 text-xs">
                {func}
              </code>
            ))}
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={feedback.adminFunctions.highlightRisks}
                onChange={(e) => setFeedback(prev => ({
                  ...prev,
                  adminFunctions: { ...prev.adminFunctions, highlightRisks: e.target.checked }
                }))}
                className="rounded border-white/20"
              />
              <span className="text-sm">在文档中特别标注风险</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={feedback.adminFunctions.addPermissionDocs}
                onChange={(e) => setFeedback(prev => ({
                  ...prev,
                  adminFunctions: { ...prev.adminFunctions, addPermissionDocs: e.target.checked }
                }))}
                className="rounded border-white/20"
              />
              <span className="text-sm">添加权限说明</span>
            </label>
          </div>
        </div>
      )}

      {/* Q4: Error Codes */}
      {errorCodeCount > 0 && (
        <div className="border border-white/10 rounded-xl p-4 space-y-3">
          <h3 className="font-medium flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-yellow-500/20 text-yellow-400 text-xs flex items-center justify-center">4</span>
            错误码 ({errorCodeCount} 个)
          </h3>

          <div className="max-h-32 overflow-y-auto space-y-1">
            {analysis.errorCodes.slice(0, 5).map(err => (
              <div key={err.name} className="flex items-center gap-2 text-sm">
                <code className="px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400 text-xs font-mono">
                  {err.name}
                </code>
                <span className="text-muted-foreground text-xs">
                  ({err.code}) - {err.description}
                </span>
              </div>
            ))}
            {errorCodeCount > 5 && (
              <p className="text-xs text-muted-foreground">... 及 {errorCodeCount - 5} 个更多</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={feedback.errorCodes.generateErrorsMd}
                onChange={(e) => setFeedback(prev => ({
                  ...prev,
                  errorCodes: { ...prev.errorCodes, generateErrorsMd: e.target.checked }
                }))}
                className="rounded border-white/20"
              />
              <span className="text-sm">生成故障排除指南 (errors.md)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={feedback.errorCodes.includeInSkillMd}
                onChange={(e) => setFeedback(prev => ({
                  ...prev,
                  errorCodes: { ...prev.errorCodes, includeInSkillMd: e.target.checked }
                }))}
                className="rounded border-white/20"
              />
              <span className="text-sm">在 SKILL.md 中包含常见错误处理</span>
            </label>
          </div>
        </div>
      )}

      {/* Business Context */}
      <div className="border border-white/10 rounded-xl p-4 space-y-3">
        <h3 className="font-medium flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 text-xs flex items-center justify-center">+</span>
          补充业务上下文 (可选)
        </h3>
        <textarea
          placeholder="添加任何 AI 未能推断的业务信息，如：协议名称、业务逻辑、特殊说明等..."
          value={feedback.businessContext}
          onChange={(e) => setFeedback(prev => ({ ...prev, businessContext: e.target.value }))}
          rows={3}
          className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-primary/50 resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-3 rounded-xl text-sm font-medium border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all"
        >
          取消
        </button>
        <button
          onClick={handleSubmit}
          className="flex-1 px-4 py-3 rounded-xl text-sm font-medium bg-gradient-to-r from-primary to-accent text-primary-foreground hover:shadow-glow-sm transition-all flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          确认并生成
        </button>
      </div>
    </div>
  );
}
