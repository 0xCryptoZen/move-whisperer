'use client';

import dynamic from 'next/dynamic';

// Dynamic import to avoid Walrus WASM loading during SSR/static generation
const SubmitSkillContent = dynamic(() => import('./SubmitSkillContent'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-16 text-center">
        <div className="w-12 h-12 mx-auto border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    </div>
  ),
});

export default function SubmitSkillPage() {
  return <SubmitSkillContent />;
}
