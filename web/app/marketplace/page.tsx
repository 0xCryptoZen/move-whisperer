'use client';

import dynamic from 'next/dynamic';

// Dynamic import to avoid Walrus WASM loading during SSR/static generation
const MarketplaceContent = dynamic(() => import('./MarketplaceContent'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-background">
      <div className="mx-auto px-6 sm:px-10 lg:px-16 py-16 max-w-[1680px] text-center">
        <div className="w-12 h-12 mx-auto border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
        <p className="text-muted-foreground text-sm font-mono-cyber">Loading marketplace...</p>
      </div>
    </div>
  ),
});

export default function MarketplacePage() {
  return <MarketplaceContent />;
}
