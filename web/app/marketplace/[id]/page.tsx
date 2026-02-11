'use client';

import dynamic from 'next/dynamic';

// Dynamic import to avoid Walrus WASM loading during SSR/static generation
const SkillDetailContent = dynamic(() => import('./SkillDetailContent'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-white/10 rounded w-1/3 mb-4" />
          <div className="h-4 bg-white/10 rounded w-2/3 mb-8" />
          <div className="glass-panel rounded-2xl p-6 h-64" />
        </div>
      </div>
    </div>
  ),
});

export default function SkillDetailPage() {
  return <SkillDetailContent />;
}
