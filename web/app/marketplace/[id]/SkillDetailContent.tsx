'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useSkillMarketplace } from '@/hooks/useSkillMarketplace';
import { mistToSui } from '@/lib/contracts/skill-marketplace';
import { useAuth } from '@/lib/auth/context';

interface SkillDetail {
  id: string;
  title: string;
  description: string;
  githubUrl: string;
  packageId: string | null;
  scene: string;
  network: string;
  starsCount: number;
  downloadsCount: number;
  repoOwner: string;
  repoName: string;
  createdAt: number;
  isFromAwesome: boolean;
  blobId: string | null;
  onChainId: string | null;
  priceMist: number;
  creatorAddress: string | null;
  isEncrypted: boolean;
}

const SCENE_INFO: Record<string, { label: string; color: string; description: string }> = {
  sdk: { label: 'SDK Integration', color: 'bg-blue-500/20 text-blue-400', description: 'Function references, code examples, PTB patterns' },
  learn: { label: 'Learning', color: 'bg-purple-500/20 text-purple-400', description: 'Architecture, concepts, design patterns' },
  audit: { label: 'Security Audit', color: 'bg-red-500/20 text-red-400', description: 'Permissions, risks, vulnerability checks' },
  frontend: { label: 'Frontend', color: 'bg-green-500/20 text-green-400', description: 'User flows, data queries, UX patterns' },
  bot: { label: 'Trading Bot', color: 'bg-yellow-500/20 text-yellow-400', description: 'Gas optimization, batch operations, monitoring' },
  docs: { label: 'Documentation', color: 'bg-cyan-500/20 text-cyan-400', description: 'API reference, type definitions' },
  transaction: { label: 'Transaction', color: 'bg-orange-500/20 text-orange-400', description: 'Transaction patterns and replication' },
};

type ViewState = 'loading' | 'preview' | 'full' | 'purchasing' | 'error';

export default function SkillDetailContent() {
  const params = useParams();
  const skillId = params.id as string;
  const { user } = useAuth();

  const [skill, setSkill] = useState<SkillDetail | null>(null);
  const [viewState, setViewState] = useState<ViewState>('loading');
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  const {
    purchaseSkill,
    claimFreeSkill,
    getSkillContent,
    getFreeSkillContent,
    hasAccess,
    purchasing,
    loading: contentLoading,
    connected,
    address,
  } = useSkillMarketplace();

  // Fetch skill metadata from API
  useEffect(() => {
    setViewState('loading');
    setError(null);

    fetch(`/api/marketplace/skills/${skillId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Skill not found');
        return res.json();
      })
      .then((data) => {
        const result = data as { skill: SkillDetail };
        setSkill(result.skill);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load skill');
        setViewState('error');
      });
  }, [skillId]);

  // Determine view state based on skill data and user access
  useEffect(() => {
    if (!skill) return;

    const isFree = skill.priceMist === 0;
    const isOnChain = !!skill.blobId && !!skill.onChainId;
    const isCreator = address && skill.creatorAddress === address;
    const userHasAccess = skill.onChainId ? !!hasAccess(skill.onChainId) : false;

    if (!isOnChain) {
      setViewState('full');
    } else if (isFree || isCreator || userHasAccess) {
      setViewState('full');
    } else {
      setViewState('preview');
    }
  }, [skill, address, hasAccess]);

  // Auto-load content for accessible on-chain skills
  useEffect(() => {
    if (viewState !== 'full' || !skill?.blobId || !skill?.onChainId || content) return;

    const loadContent = async () => {
      try {
        const isFree = skill.priceMist === 0;
        let text: string;

        if (isFree || !skill.isEncrypted) {
          text = await getFreeSkillContent({
            blobId: skill.blobId!,
            objectId: skill.onChainId!,
          });
        } else {
          text = await getSkillContent({
            blobId: skill.blobId!,
            objectId: skill.onChainId!,
            isEncrypted: skill.isEncrypted,
            price: BigInt(skill.priceMist),
          });
        }
        setContent(text);
      } catch (err) {
        console.error('Failed to load content:', err);
      }
    };

    loadContent();
  }, [viewState, skill, content, getFreeSkillContent, getSkillContent]);

  const handlePurchase = useCallback(async () => {
    if (!skill?.onChainId) return;
    setPurchaseError(null);
    setViewState('purchasing');

    try {
      const isFree = skill.priceMist === 0;

      if (isFree) {
        await claimFreeSkill(skill.onChainId);
      } else {
        const result = await purchaseSkill(skill.onChainId, BigInt(skill.priceMist));

        // Record purchase in D1 for tracking (non-critical)
        try {
          await fetch('/api/marketplace/purchases', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              skillId: skill.id,
              accessCapId: result.accessCapId,
              txDigest: result.txDigest,
              priceMist: skill.priceMist,
              buyerAddress: address,
            }),
          });
        } catch {
          // D1 sync failure is non-critical
        }
      }

      setViewState('full');
    } catch (err) {
      setPurchaseError(err instanceof Error ? err.message : 'Purchase failed');
      setViewState('preview');
    }
  }, [skill, purchaseSkill, claimFreeSkill, address]);

  const handleCopyUrl = () => {
    if (!skill) return;
    const url = skill.blobId
      ? `${window.location.origin}/marketplace/${skill.id}`
      : skill.githubUrl;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Loading state
  if (viewState === 'loading' && !skill) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-6 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-white/10 rounded w-1/3 mb-4" />
            <div className="h-4 bg-white/10 rounded w-2/3 mb-8" />
            <div className="glass-panel rounded-2xl p-6 h-64" />
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (viewState === 'error' || !skill) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-6 py-16 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold mb-2">Skill Not Found</h2>
          <p className="text-muted-foreground mb-6">{error || "The skill you're looking for doesn't exist or has been removed."}</p>
          <Link href="/marketplace" className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors">
            Back to Marketplace
          </Link>
        </div>
      </div>
    );
  }

  const sceneInfo = SCENE_INFO[skill.scene] || { label: skill.scene, color: 'bg-white/10', description: '' };
  const isOnChain = !!skill.blobId && !!skill.onChainId;
  const isFree = skill.priceMist === 0;
  const isCreator = address && skill.creatorAddress === address;
  const priceDisplay = isFree ? 'Free' : mistToSui(BigInt(skill.priceMist));

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-white/10">
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-start gap-4">
            <Link href="/marketplace" className="p-2 rounded-lg hover:bg-white/5 transition-colors mt-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <h1 className="text-2xl font-bold">{skill.title}</h1>
                {skill.isFromAwesome && (
                  <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 text-xs">Featured</span>
                )}
                {isOnChain && (
                  <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 text-xs">On-Chain</span>
                )}
                {isOnChain && (
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${isFree ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}>
                    {priceDisplay}
                  </span>
                )}
              </div>
              <p className="text-muted-foreground">{skill.description}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Paywall */}
            {viewState === 'preview' && (
              <div className="glass-panel rounded-2xl p-6">
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Premium Skill</h3>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    This skill is encrypted and requires purchase to access the full content.
                    Once purchased, you&apos;ll have permanent access.
                  </p>
                  <div className="text-3xl font-bold text-amber-400 mb-6">{priceDisplay}</div>

                  {purchaseError && (
                    <div className="mb-4 p-3 rounded-xl bg-red-500/10 text-red-400 text-sm">{purchaseError}</div>
                  )}

                  {!connected ? (
                    <p className="text-sm text-muted-foreground">Connect your wallet to purchase this skill.</p>
                  ) : (
                    <button
                      onClick={handlePurchase}
                      disabled={purchasing}
                      className="px-8 py-3 rounded-xl bg-amber-500 text-black font-semibold hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {purchasing ? 'Processing...' : `Purchase for ${priceDisplay}`}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Purchasing state */}
            {viewState === 'purchasing' && (
              <div className="glass-panel rounded-2xl p-6">
                <div className="text-center py-12">
                  <div className="w-12 h-12 mx-auto border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-6" />
                  <h3 className="text-lg font-semibold mb-2">Processing Purchase</h3>
                  <p className="text-muted-foreground">Please confirm the transaction in your wallet...</p>
                </div>
              </div>
            )}

            {/* Full content from Walrus */}
            {viewState === 'full' && isOnChain && (
              <div className="glass-panel rounded-2xl p-6">
                {contentLoading && !content ? (
                  <div className="text-center py-8">
                    <div className="w-10 h-10 mx-auto border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
                    <p className="text-muted-foreground text-sm">Loading content from Walrus...</p>
                  </div>
                ) : content ? (
                  <div className="prose prose-invert prose-sm max-w-none prose-headings:text-foreground prose-headings:font-semibold prose-p:text-muted-foreground prose-p:leading-relaxed prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-code:text-cyan-400 prose-code:bg-white/5 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-pre:bg-black/40 prose-pre:border prose-pre:border-white/10 prose-pre:rounded-xl prose-strong:text-foreground prose-li:text-muted-foreground prose-blockquote:border-primary/50 prose-blockquote:text-muted-foreground prose-hr:border-white/10 prose-table:text-muted-foreground prose-th:text-foreground prose-td:border-white/10 prose-th:border-white/10">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground text-sm">Content could not be loaded. The blob may be temporarily unavailable.</p>
                    <button
                      onClick={() => setContent(null)}
                      className="mt-3 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm transition-colors"
                    >
                      Retry
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* About */}
            <div className="glass-panel rounded-2xl p-6">
              <h2 className="font-semibold text-lg mb-4">About This Skill</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-white/5">
                  <div className="text-sm text-muted-foreground mb-1">Scene</div>
                  <span className={`px-2 py-1 rounded-lg text-xs ${sceneInfo.color}`}>{sceneInfo.label}</span>
                  <p className="text-xs text-muted-foreground mt-2">{sceneInfo.description}</p>
                </div>

                <div className="p-4 rounded-xl bg-white/5">
                  <div className="text-sm text-muted-foreground mb-1">Network</div>
                  <div className="font-medium capitalize">{skill.network}</div>
                </div>

                {!isOnChain && (
                  <div className="p-4 rounded-xl bg-white/5">
                    <div className="text-sm text-muted-foreground mb-1">Repository</div>
                    <a
                      href={`https://github.com/${skill.repoOwner}/${skill.repoName}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-sm text-primary hover:underline"
                    >
                      {skill.repoOwner}/{skill.repoName}
                    </a>
                  </div>
                )}

                {isOnChain && skill.creatorAddress && (
                  <div className="p-4 rounded-xl bg-white/5">
                    <div className="text-sm text-muted-foreground mb-1">Creator</div>
                    <div className="font-mono text-sm break-all">
                      {skill.creatorAddress.slice(0, 8)}...{skill.creatorAddress.slice(-6)}
                      {isCreator && <span className="ml-2 text-xs text-primary">(You)</span>}
                    </div>
                  </div>
                )}

                <div className="p-4 rounded-xl bg-white/5">
                  <div className="text-sm text-muted-foreground mb-1">Created</div>
                  <div>{new Date(skill.createdAt).toLocaleDateString()}</div>
                </div>
              </div>

              {skill.packageId && (
                <div className="mt-4 p-4 rounded-xl bg-white/5">
                  <div className="text-sm text-muted-foreground mb-1">Analyzed Package ID</div>
                  <div className="flex items-center gap-2">
                    <code className="font-mono text-sm break-all">{skill.packageId}</code>
                    <button
                      onClick={() => navigator.clipboard.writeText(skill.packageId!)}
                      className="p-1 rounded hover:bg-white/10 transition-colors flex-shrink-0"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              {isOnChain && skill.onChainId && (
                <div className="mt-4 p-4 rounded-xl bg-white/5">
                  <div className="text-sm text-muted-foreground mb-1">On-Chain Object ID</div>
                  <div className="flex items-center gap-2">
                    <code className="font-mono text-sm break-all">{skill.onChainId}</code>
                    <button
                      onClick={() => navigator.clipboard.writeText(skill.onChainId!)}
                      className="p-1 rounded hover:bg-white/10 transition-colors flex-shrink-0"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* How to Use */}
            <div className="glass-panel rounded-2xl p-6">
              <h2 className="font-semibold text-lg mb-4">How to Use</h2>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center flex-shrink-0 mt-0.5">1</div>
                  <div>
                    <div className="font-medium mb-1">{isOnChain && !isFree ? 'Purchase Access' : 'Get the Skill'}</div>
                    <p className="text-sm text-muted-foreground">
                      {isOnChain && !isFree
                        ? 'Purchase this skill with SUI to get permanent access to the encrypted content.'
                        : isOnChain
                          ? 'This skill is freely available on Walrus decentralized storage.'
                          : 'Copy the skill URL and add it to your Claude Code skills configuration.'}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center flex-shrink-0 mt-0.5">2</div>
                  <div>
                    <div className="font-medium mb-1">Add to Claude</div>
                    <p className="text-sm text-muted-foreground">Copy the skill content and add it as a SKILL.md to your Claude Code configuration.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center flex-shrink-0 mt-0.5">3</div>
                  <div>
                    <div className="font-medium mb-1">Start Building</div>
                    <p className="text-sm text-muted-foreground">Claude will use the skill documentation to guide you through integration.</p>
                  </div>
                </div>
              </div>

              {!isOnChain && (
                <div className="mt-6 p-4 rounded-xl bg-black/30 font-mono text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="break-all text-muted-foreground">{skill.githubUrl}</span>
                    <button onClick={handleCopyUrl} className="p-2 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0">
                      {copied ? (
                        <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Actions */}
            <div className="glass-panel rounded-2xl p-6">
              <div className="space-y-3">
                {isOnChain && viewState === 'preview' && (
                  <button
                    onClick={handlePurchase}
                    disabled={purchasing || !connected}
                    className="w-full py-3 rounded-xl bg-amber-500 text-black font-semibold hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    {purchasing ? 'Processing...' : `Purchase for ${priceDisplay}`}
                  </button>
                )}

                {isOnChain && viewState === 'full' && (
                  <div className="w-full py-3 rounded-xl bg-green-500/20 text-green-400 font-medium flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    {isFree ? 'Free Access' : isCreator ? 'Your Skill' : 'Purchased'}
                  </div>
                )}

                {content && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(content);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                  >
                    {copied ? (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Copied!
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copy SKILL.md Content
                      </>
                    )}
                  </button>
                )}

                {!isOnChain && (
                  <a
                    href={skill.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    View on GitHub
                  </a>
                )}
              </div>
            </div>

            {/* Pricing info */}
            {isOnChain && (
              <div className="glass-panel rounded-2xl p-6">
                <h3 className="font-semibold mb-4">Pricing</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Price</span>
                    <span className={`font-semibold ${isFree ? 'text-green-400' : 'text-amber-400'}`}>{priceDisplay}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Storage</span>
                    <span className="text-cyan-400 text-sm">Walrus</span>
                  </div>
                  {skill.isEncrypted && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Encryption</span>
                      <span className="text-purple-400 text-sm">Seal</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Access</span>
                    <span className="text-sm">Permanent</span>
                  </div>
                </div>
              </div>
            )}

            {/* Stats */}
            <div className="glass-panel rounded-2xl p-6">
              <h3 className="font-semibold mb-4">Statistics</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                    Stars
                  </span>
                  <span className="font-medium">{skill.starsCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Downloads
                  </span>
                  <span className="font-medium">{skill.downloadsCount}</span>
                </div>
              </div>
            </div>

            {/* Generate Similar */}
            <div className="glass-panel rounded-2xl p-6">
              <h3 className="font-semibold mb-2">Create Your Own</h3>
              <p className="text-sm text-muted-foreground mb-4">Generate a similar skill for a different contract</p>
              <Link href="/generate" className="block w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-center font-medium transition-colors">
                Generate Skill
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
