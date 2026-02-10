'use client';

import { useState } from 'react';
import { useTranslation } from '@/lib/i18n';

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

const CATEGORY_VALUES = ['dex', 'nft', 'defi', 'lending', 'staking', 'gaming', 'governance', 'utility', 'unknown'] as const;

export default function ReviewPanel({ analysis, onConfirm, onCancel }: ReviewPanelProps) {
  const { t } = useTranslation();

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
    <div className="glass-panel rounded p-6 space-y-6 hud-corners">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded border border-[rgba(var(--neon-cyan-rgb),0.3)] bg-[rgba(var(--neon-cyan-rgb),0.1)] flex items-center justify-center">
            <svg className="w-5 h-5 text-[var(--neon-cyan)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold font-mono-cyber neon-text">{t('review.title')}</h2>
            <p className="text-sm text-muted-foreground font-mono-cyber">
              {t('review.subtitle')}
            </p>
          </div>
        </div>

        {/* Analysis Source Badge */}
        <div className={`px-3 py-1.5 rounded text-xs font-mono-cyber ${
          analysis.analysisSource === 'claude'
            ? 'bg-[rgba(var(--neon-green-rgb),0.15)] text-[var(--neon-green)] border border-[rgba(var(--neon-green-rgb),0.3)]'
            : analysis.analysisSource === 'hybrid'
            ? 'bg-[rgba(var(--neon-cyan-rgb),0.15)] text-[var(--neon-cyan)] border border-[rgba(var(--neon-cyan-rgb),0.3)]'
            : 'bg-[rgba(var(--neon-amber-rgb),0.15)] text-[var(--neon-amber)] border border-[rgba(var(--neon-amber-rgb),0.3)]'
        }`}>
          {analysis.analysisSource === 'claude' ? 'AI Claude' :
           analysis.analysisSource === 'hybrid' ? 'Hybrid' : 'Pattern Match'}
          <span className="ml-1.5 opacity-70">
            ({Math.round(analysis.confidence * 100)}% confidence)
          </span>
        </div>
      </div>

      {/* Q1: Contract Purpose */}
      <div className="border border-[rgba(var(--neon-cyan-rgb),0.1)] rounded p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium font-mono-cyber flex items-center gap-2">
            <span className="w-6 h-6 rounded border border-[rgba(var(--neon-cyan-rgb),0.3)] bg-[rgba(var(--neon-cyan-rgb),0.1)] text-[var(--neon-cyan)] text-xs flex items-center justify-center font-mono-cyber">1</span>
            {t('review.purpose.title')}
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => handlePurposeToggle(true)}
              className={`px-3 py-1.5 rounded text-sm font-mono-cyber transition-all ${
                feedback.purpose.confirmed
                  ? 'bg-[rgba(var(--neon-green-rgb),0.15)] text-[var(--neon-green)] border border-[rgba(var(--neon-green-rgb),0.3)]'
                  : 'border border-[rgba(var(--neon-cyan-rgb),0.1)] text-muted-foreground hover:border-[rgba(var(--neon-cyan-rgb),0.2)]'
              }`}
            >
              &#10003; {t('review.correct')}
            </button>
            <button
              onClick={() => handlePurposeToggle(false)}
              className={`px-3 py-1.5 rounded text-sm font-mono-cyber transition-all ${
                !feedback.purpose.confirmed
                  ? 'bg-[rgba(var(--neon-red-rgb),0.15)] text-[var(--neon-red)] border border-[rgba(var(--neon-red-rgb),0.3)]'
                  : 'border border-[rgba(var(--neon-cyan-rgb),0.1)] text-muted-foreground hover:border-[rgba(var(--neon-cyan-rgb),0.2)]'
              }`}
            >
              &#10007; {t('review.incorrect')}
            </button>
          </div>
        </div>

        <div className="p-3 rounded bg-[rgba(var(--neon-cyan-rgb),0.03)] border border-[rgba(var(--neon-cyan-rgb),0.08)]">
          <div className="flex items-center gap-3 mb-2">
            <span className={`px-2.5 py-1 rounded text-xs font-mono-cyber ${
              analysis.purpose.category === 'dex' ? 'bg-[rgba(var(--neon-cyan-rgb),0.15)] text-[var(--neon-cyan)]' :
              analysis.purpose.category === 'nft' ? 'bg-[rgba(var(--neon-purple-rgb),0.15)] text-[var(--neon-purple)]' :
              analysis.purpose.category === 'defi' ? 'bg-[rgba(var(--neon-green-rgb),0.15)] text-[var(--neon-green)]' :
              'bg-[rgba(var(--neon-cyan-rgb),0.08)] text-[rgba(var(--neon-cyan-rgb),0.6)]'
            }`}>
              {t(`category.${analysis.purpose.category}`) || analysis.purpose.category}
            </span>
          </div>
          <p className="text-sm font-mono-cyber">{analysis.purpose.summary}</p>
        </div>

        {!feedback.purpose.confirmed && (
          <div className="space-y-2">
            <select
              value={feedback.purpose.category || analysis.purpose.category}
              onChange={(e) => setFeedback(prev => ({
                ...prev,
                purpose: { ...prev.purpose, category: e.target.value }
              }))}
              className="cyber-input w-full px-3 py-2 rounded text-sm"
            >
              {CATEGORY_VALUES.map(value => (
                <option key={value} value={value}>
                  {t(`category.${value}`)}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder={t('review.purpose.placeholder')}
              value={purposeCorrection}
              onChange={(e) => setPurposeCorrection(e.target.value)}
              className="cyber-input w-full px-3 py-2 rounded text-sm"
            />
          </div>
        )}
      </div>

      {/* Q2: Generic Parameters */}
      {genericCount > 0 && (
        <div className="border border-[rgba(var(--neon-cyan-rgb),0.1)] rounded p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium font-mono-cyber flex items-center gap-2">
              <span className="w-6 h-6 rounded border border-[rgba(var(--neon-purple-rgb),0.3)] bg-[rgba(var(--neon-purple-rgb),0.1)] text-[var(--neon-purple)] text-xs flex items-center justify-center font-mono-cyber">2</span>
              {t('review.generics.title')}
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => handleGenericToggle(true)}
                className={`px-3 py-1.5 rounded text-sm font-mono-cyber transition-all ${
                  feedback.generics.confirmed
                    ? 'bg-[rgba(var(--neon-green-rgb),0.15)] text-[var(--neon-green)] border border-[rgba(var(--neon-green-rgb),0.3)]'
                    : 'border border-[rgba(var(--neon-cyan-rgb),0.1)] text-muted-foreground hover:border-[rgba(var(--neon-cyan-rgb),0.2)]'
                }`}
              >
                &#10003; {t('review.correct')}
              </button>
              <button
                onClick={() => handleGenericToggle(false)}
                className={`px-3 py-1.5 rounded text-sm font-mono-cyber transition-all ${
                  !feedback.generics.confirmed
                    ? 'bg-[rgba(var(--neon-red-rgb),0.15)] text-[var(--neon-red)] border border-[rgba(var(--neon-red-rgb),0.3)]'
                    : 'border border-[rgba(var(--neon-cyan-rgb),0.1)] text-muted-foreground hover:border-[rgba(var(--neon-cyan-rgb),0.2)]'
                }`}
              >
                &#10007; {t('review.incorrect')}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {Object.entries(analysis.generics.mapping).map(([key, value]) => (
              <div key={key} className="flex items-center gap-3 p-2 rounded bg-[rgba(var(--neon-cyan-rgb),0.03)] border border-[rgba(var(--neon-cyan-rgb),0.08)]">
                <code className="px-2 py-1 rounded bg-[rgba(var(--neon-purple-rgb),0.15)] text-[var(--neon-purple)] text-sm font-mono-cyber">
                  {key}
                </code>
                <span className="text-sm text-muted-foreground">&rarr;</span>
                <span className="text-sm font-mono-cyber">{value.name}</span>
                {value.commonTypes.length > 0 && (
                  <span className="text-xs text-muted-foreground font-mono-cyber">
                    (e.g., {value.commonTypes.join(', ')})
                  </span>
                )}
              </div>
            ))}
          </div>

          {!feedback.generics.confirmed && (
            <div className="p-3 rounded bg-[rgba(var(--neon-amber-rgb),0.08)] border border-[rgba(var(--neon-amber-rgb),0.2)]">
              <p className="text-xs neon-text-amber font-mono-cyber">
                {t('review.generics.correction')}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Q3: Admin Functions */}
      {adminFuncCount > 0 && (
        <div className="border border-[rgba(var(--neon-cyan-rgb),0.1)] rounded p-4 space-y-3">
          <h3 className="font-medium font-mono-cyber flex items-center gap-2">
            <span className="w-6 h-6 rounded border border-[rgba(var(--neon-red-rgb),0.3)] bg-[rgba(var(--neon-red-rgb),0.1)] text-[var(--neon-red)] text-xs flex items-center justify-center font-mono-cyber">3</span>
            {t('review.admin.title')} ({t('review.admin.count', { count: adminFuncCount })})
          </h3>

          <div className="flex flex-wrap gap-2">
            {analysis.security.adminFunctions.map(func => (
              <code key={func} className="px-2 py-1 rounded bg-[rgba(var(--neon-red-rgb),0.08)] border border-[rgba(var(--neon-red-rgb),0.15)] text-[var(--neon-red)] text-xs font-mono-cyber">
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
                className="rounded border-[rgba(var(--neon-cyan-rgb),0.2)]"
              />
              <span className="text-sm font-mono-cyber">{t('review.admin.highlightRisks')}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={feedback.adminFunctions.addPermissionDocs}
                onChange={(e) => setFeedback(prev => ({
                  ...prev,
                  adminFunctions: { ...prev.adminFunctions, addPermissionDocs: e.target.checked }
                }))}
                className="rounded border-[rgba(var(--neon-cyan-rgb),0.2)]"
              />
              <span className="text-sm font-mono-cyber">{t('review.admin.addPermissions')}</span>
            </label>
          </div>
        </div>
      )}

      {/* Q4: Error Codes */}
      {errorCodeCount > 0 && (
        <div className="border border-[rgba(var(--neon-cyan-rgb),0.1)] rounded p-4 space-y-3">
          <h3 className="font-medium font-mono-cyber flex items-center gap-2">
            <span className="w-6 h-6 rounded border border-[rgba(var(--neon-amber-rgb),0.3)] bg-[rgba(var(--neon-amber-rgb),0.1)] text-[var(--neon-amber)] text-xs flex items-center justify-center font-mono-cyber">4</span>
            {t('review.errors.title')} ({t('review.errors.count', { count: errorCodeCount })})
          </h3>

          <div className="max-h-32 overflow-y-auto space-y-1">
            {analysis.errorCodes.slice(0, 5).map(err => (
              <div key={err.name} className="flex items-center gap-2 text-sm">
                <code className="px-1.5 py-0.5 rounded bg-[rgba(var(--neon-amber-rgb),0.08)] border border-[rgba(var(--neon-amber-rgb),0.15)] text-[var(--neon-amber)] text-xs font-mono-cyber">
                  {err.name}
                </code>
                <span className="text-muted-foreground text-xs font-mono-cyber">
                  ({err.code}) - {err.description}
                </span>
              </div>
            ))}
            {errorCodeCount > 5 && (
              <p className="text-xs text-muted-foreground font-mono-cyber">{t('review.errors.more', { count: errorCodeCount - 5 })}</p>
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
                className="rounded border-[rgba(var(--neon-cyan-rgb),0.2)]"
              />
              <span className="text-sm font-mono-cyber">{t('review.errors.generateGuide')}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={feedback.errorCodes.includeInSkillMd}
                onChange={(e) => setFeedback(prev => ({
                  ...prev,
                  errorCodes: { ...prev.errorCodes, includeInSkillMd: e.target.checked }
                }))}
                className="rounded border-[rgba(var(--neon-cyan-rgb),0.2)]"
              />
              <span className="text-sm font-mono-cyber">{t('review.errors.includeInSkill')}</span>
            </label>
          </div>
        </div>
      )}

      {/* Business Context */}
      <div className="border border-[rgba(var(--neon-cyan-rgb),0.1)] rounded p-4 space-y-3">
        <h3 className="font-medium font-mono-cyber flex items-center gap-2">
          <span className="w-6 h-6 rounded border border-[rgba(var(--neon-cyan-rgb),0.3)] bg-[rgba(var(--neon-cyan-rgb),0.1)] text-[var(--neon-cyan)] text-xs flex items-center justify-center font-mono-cyber">+</span>
          {t('review.context.title')}
        </h3>
        <textarea
          placeholder={t('review.context.placeholder')}
          value={feedback.businessContext}
          onChange={(e) => setFeedback(prev => ({ ...prev, businessContext: e.target.value }))}
          rows={3}
          className="cyber-input w-full px-3 py-2 rounded text-sm resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onCancel}
          className="flex-1 cyber-btn px-4 py-3 rounded text-sm font-mono-cyber"
        >
          {t('review.cancel')}
        </button>
        <button
          onClick={handleSubmit}
          className="flex-1 px-4 py-3 rounded text-sm font-mono-cyber bg-[rgba(var(--neon-cyan-rgb),0.15)] border border-[var(--neon-cyan)] text-[var(--neon-cyan)] hover:bg-[rgba(var(--neon-cyan-rgb),0.25)] hover:shadow-[0_0_15px_rgba(var(--neon-cyan-rgb),0.3)] transition-all flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {t('review.confirm')}
        </button>
      </div>
    </div>
  );
}
