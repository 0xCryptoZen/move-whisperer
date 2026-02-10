'use client';

import { useLocale } from '@/lib/i18n';

export function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();

  return (
    <button
      onClick={() => setLocale(locale === 'en' ? 'zh' : 'en')}
      className="px-2.5 py-1 rounded text-xs font-mono-cyber tracking-wider border border-[rgba(var(--neon-cyan-rgb),0.2)] hover:border-[rgba(var(--neon-cyan-rgb),0.5)] bg-[rgba(var(--neon-cyan-rgb),0.05)] hover:bg-[rgba(var(--neon-cyan-rgb),0.1)] text-muted-foreground hover:text-[var(--neon-cyan)] transition-all duration-300"
      title={locale === 'en' ? 'Switch to Chinese' : '切换到英文'}
    >
      {locale === 'en' ? 'ZH' : 'EN'}
    </button>
  );
}
