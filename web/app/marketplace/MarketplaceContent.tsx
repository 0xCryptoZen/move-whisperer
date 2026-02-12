'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/context';
import { mistToSui, suiToMist } from '@/lib/contracts/skill-marketplace';
import { useSkillMarketplace } from '@/hooks/useSkillMarketplace';

interface UserSkillItem {
  id: string;
  title: string;
  packageId: string;
  moduleName: string | null;
  network: string;
  scene: string;
  createdAt: number;
  updatedAt: number;
}

interface Skill {
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
  // Walrus + Seal fields
  blobId: string | null;
  onChainId: string | null;
  priceMist: number;
  creatorAddress: string | null;
  isEncrypted: boolean;
}

const SCENES = [
  { value: '', label: 'All Scenes' },
  { value: 'sdk', label: 'SDK Integration' },
  { value: 'learn', label: 'Learning' },
  { value: 'audit', label: 'Security Audit' },
  { value: 'frontend', label: 'Frontend' },
  { value: 'bot', label: 'Trading Bot' },
  { value: 'docs', label: 'Documentation' },
  { value: 'transaction', label: 'Transaction' },
];

const NETWORKS = [
  { value: '', label: 'All Networks' },
  { value: 'mainnet', label: 'Mainnet' },
  { value: 'testnet', label: 'Testnet' },
  { value: 'devnet', label: 'Devnet' },
];

const PRICING = [
  { value: '', label: 'All Prices' },
  { value: 'free', label: 'Free Only' },
  { value: 'paid', label: 'Paid Only' },
];

// Mock data - will be replaced with API call
const MOCK_SKILLS: Skill[] = [
  {
    id: '1',
    title: 'Cetus AMM Integration',
    description: 'Complete skill for integrating with Cetus AMM - swap, liquidity, and position management',
    githubUrl: 'https://github.com/example/cetus-skill/blob/main/SKILL.md',
    packageId: '0x1eabed72c53feb73c83f8fbf7a5557e5e7b8e7e3d1c6f5e8a',
    scene: 'sdk',
    network: 'mainnet',
    starsCount: 42,
    downloadsCount: 156,
    repoOwner: 'example',
    repoName: 'cetus-skill',
    createdAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
    isFromAwesome: true,
    blobId: null,
    onChainId: null,
    priceMist: 0,
    creatorAddress: null,
    isEncrypted: false,
  },
  {
    id: '2',
    title: 'DeepBook Trading Bot',
    description: 'Skill for building trading bots on DeepBook CLOB',
    githubUrl: 'https://github.com/example/deepbook-bot/blob/main/SKILL.md',
    packageId: '0xdee9',
    scene: 'bot',
    network: 'mainnet',
    starsCount: 28,
    downloadsCount: 89,
    repoOwner: 'example',
    repoName: 'deepbook-bot',
    createdAt: Date.now() - 14 * 24 * 60 * 60 * 1000,
    isFromAwesome: true,
    blobId: 'blob-example-2',
    onChainId: '0xabc123',
    priceMist: 500000000, // 0.5 SUI
    creatorAddress: '0xdef456',
    isEncrypted: true,
  },
  {
    id: '3',
    title: 'Scallop Lending Audit',
    description: 'Security audit skill for Scallop lending protocol',
    githubUrl: 'https://github.com/example/scallop-audit/blob/main/SKILL.md',
    packageId: '0xefe8b36d5b2e43728cc323298626b83177803521d195cfb11e15b910e892fddf',
    scene: 'audit',
    network: 'mainnet',
    starsCount: 15,
    downloadsCount: 34,
    repoOwner: 'example',
    repoName: 'scallop-audit',
    createdAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
    isFromAwesome: false,
    blobId: null,
    onChainId: null,
    priceMist: 0,
    creatorAddress: null,
    isEncrypted: false,
  },
];

export default function MarketplacePage() {
  const { user } = useAuth();
  const { publishSkill, publishing, connected, address } = useSkillMarketplace();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    scene: '',
    network: '',
    search: '',
    pricing: '',
  });

  // User saved skills
  const [userSkills, setUserSkills] = useState<UserSkillItem[]>([]);
  const [loadingUserSkills, setLoadingUserSkills] = useState(false);
  const [showMySkills, setShowMySkills] = useState(true);
  const [loadingPublishId, setLoadingPublishId] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  // Publish dialog state
  const [publishDialog, setPublishDialog] = useState<{
    skill: UserSkillItem;
    content: string;
  } | null>(null);
  const [publishPricing, setPublishPricing] = useState<'free' | 'paid'>('free');
  const [publishPriceSui, setPublishPriceSui] = useState('');
  const [publishDescription, setPublishDescription] = useState('');
  const [publishStep, setPublishStep] = useState<'choose' | 'publishing' | 'done'>('choose');
  const [publishResult, setPublishResult] = useState<{
    blobId: string;
    skillObjectId: string;
    txDigest: string;
    dbSkillId?: string;
  } | null>(null);

  // Fetch user saved skills
  const fetchUserSkills = useCallback(async () => {
    if (!user) { setUserSkills([]); return; }
    setLoadingUserSkills(true);
    try {
      const res = await fetch('/api/user/skills');
      if (res.ok) {
        const data = await res.json() as { skills: UserSkillItem[] };
        setUserSkills(data.skills || []);
      }
    } catch { /* ignore */ } finally {
      setLoadingUserSkills(false);
    }
  }, [user]);

  useEffect(() => { fetchUserSkills(); }, [fetchUserSkills]);

  // Open publish dialog with skill content
  const handlePublish = async (skill: UserSkillItem) => {
    setLoadingPublishId(skill.id);
    setPublishError(null);
    try {
      const res = await fetch(`/api/user/skills/${skill.id}`);
      if (!res.ok) throw new Error('Failed to load skill content');
      const data = await res.json() as { skill: { skillMd: string } };

      // Open dialog instead of navigating
      setPublishDialog({ skill, content: data.skill.skillMd });
      setPublishPricing('free');
      setPublishPriceSui('');
      setPublishDescription('');
      setPublishStep('choose');
      setPublishResult(null);
    } catch {
      setPublishError('Failed to load skill content');
    } finally {
      setLoadingPublishId(null);
    }
  };

  const closePublishDialog = () => {
    if (publishing) return; // Don't close while publishing
    const wasPublished = publishStep === 'done';
    setPublishDialog(null);
    setPublishStep('choose');
    setPublishResult(null);
    // Refresh the marketplace list if a skill was just published
    if (wasPublished) {
      setFilters(f => ({ ...f }));
    }
  };

  const handleConfirmPublish = async () => {
    if (!publishDialog || !connected || !address) return;

    const { skill, content } = publishDialog;
    const isFree = publishPricing === 'free';
    const priceMist = isFree ? BigInt(0) : suiToMist(parseFloat(publishPriceSui) || 0);

    setPublishError(null);
    setPublishStep('publishing');

    try {
      const result = await publishSkill({
        content,
        title: skill.title,
        description: publishDescription.trim(),
        price: priceMist,
        scene: skill.scene,
        network: skill.network,
        suiPackageId: skill.packageId || undefined,
      });

      setPublishResult(result);

      // Sync to D1 database only after successful on-chain transaction
      let dbSkillId: string | undefined;
      try {
        const syncRes = await fetch('/api/marketplace/skills', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: skill.title,
            description: publishDescription.trim(),
            scene: skill.scene,
            network: skill.network,
            packageId: skill.packageId || null,
            blobId: result.blobId,
            onChainId: result.skillObjectId,
            priceMist: Number(priceMist),
            creatorAddress: address,
            isEncrypted: !isFree,
          }),
        });
        if (syncRes.ok) {
          const syncData = await syncRes.json() as { skill?: { id: string } };
          dbSkillId = syncData.skill?.id;
        }
      } catch {
        console.warn('Failed to sync skill to database index');
      }

      setPublishResult({ ...result, dbSkillId });
      setPublishStep('done');
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : 'Publishing failed');
      setPublishStep('choose');
    }
  };

  useEffect(() => {
    const fetchSkills = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (filters.scene) params.set('scene', filters.scene);
        if (filters.network) params.set('network', filters.network);
        if (filters.search) params.set('search', filters.search);
        if (filters.pricing) params.set('pricing', filters.pricing);

        const response = await fetch(`/api/marketplace/skills?${params.toString()}`);
        if (response.ok) {
          const data = await response.json() as { skills?: Skill[] };
          setSkills(data.skills || []);
        } else {
          applyMockFallback();
        }
      } catch {
        applyMockFallback();
      } finally {
        setLoading(false);
      }
    };

    const applyMockFallback = () => {
      let filtered = [...MOCK_SKILLS];
      if (filters.scene) filtered = filtered.filter(s => s.scene === filters.scene);
      if (filters.network) filtered = filtered.filter(s => s.network === filters.network);
      if (filters.pricing === 'free') filtered = filtered.filter(s => !s.priceMist);
      if (filters.pricing === 'paid') filtered = filtered.filter(s => s.priceMist > 0);
      if (filters.search) {
        const search = filters.search.toLowerCase();
        filtered = filtered.filter(s =>
          s.title.toLowerCase().includes(search) ||
          s.description.toLowerCase().includes(search)
        );
      }
      setSkills(filtered);
    };

    fetchSkills();
  }, [filters]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-[rgba(var(--neon-cyan-rgb),0.1)]">
        <div className="mx-auto px-6 sm:px-10 lg:px-16 py-8 max-w-[1680px]">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold font-mono-cyber neon-text tracking-wide uppercase">Skill Marketplace</h1>
              <p className="text-muted-foreground mt-1 font-mono-cyber text-sm">
                Browse, publish, and trade Claude skills for Sui Move contracts
              </p>
            </div>
            <Link
              href="/marketplace/submit"
              className="cyber-btn px-5 py-2.5 rounded font-mono-cyber text-sm"
            >
              Publish Skill
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto px-6 sm:px-10 lg:px-16 py-8 max-w-[1680px]">
        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-8">
          <input
            type="text"
            placeholder="Search skills..."
            value={filters.search}
            onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
            className="cyber-input flex-1 min-w-[200px] px-4 py-2.5 rounded font-mono-cyber text-sm"
          />
          <select
            value={filters.scene}
            onChange={(e) => setFilters(f => ({ ...f, scene: e.target.value }))}
            className="cyber-input px-4 py-2.5 rounded font-mono-cyber text-sm"
          >
            {SCENES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <select
            value={filters.network}
            onChange={(e) => setFilters(f => ({ ...f, network: e.target.value }))}
            className="cyber-input px-4 py-2.5 rounded font-mono-cyber text-sm"
          >
            {NETWORKS.map(n => (
              <option key={n.value} value={n.value}>{n.label}</option>
            ))}
          </select>
          <select
            value={filters.pricing}
            onChange={(e) => setFilters(f => ({ ...f, pricing: e.target.value }))}
            className="cyber-input px-4 py-2.5 rounded font-mono-cyber text-sm"
          >
            {PRICING.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        {/* My Saved Skills */}
        {user && (userSkills.length > 0 || loadingUserSkills) && (
          <div className="glass-panel rounded mb-8 overflow-hidden hud-corners">
            <button
              onClick={() => setShowMySkills(!showMySkills)}
              className="w-full flex items-center justify-between px-6 py-4 hover:bg-[rgba(var(--neon-cyan-rgb),0.02)] transition-colors"
            >
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-[var(--neon-purple)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                <span className="font-mono-cyber text-sm tracking-wide text-[var(--neon-purple)]">My Saved Skills</span>
                <span className="text-xs font-mono-cyber text-muted-foreground px-2 py-0.5 rounded-full bg-[rgba(var(--neon-purple-rgb),0.08)] border border-[rgba(var(--neon-purple-rgb),0.15)]">
                  {userSkills.length}
                </span>
              </div>
              <svg className={`w-4 h-4 text-muted-foreground transition-transform ${showMySkills ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showMySkills && (
              <div className="border-t border-[rgba(var(--neon-cyan-rgb),0.06)] px-6 py-4">
                {publishError && (
                  <div className="mb-4 px-4 py-2 rounded bg-[rgba(var(--neon-red-rgb),0.08)] border border-[rgba(var(--neon-red-rgb),0.2)] text-[var(--neon-red)] text-xs font-mono-cyber">
                    {publishError}
                  </div>
                )}
                {loadingUserSkills ? (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2].map(i => (
                      <div key={i} className="glass-panel rounded p-4 animate-pulse">
                        <div className="h-5 bg-[rgba(var(--neon-purple-rgb),0.06)] rounded w-3/4 mb-3"></div>
                        <div className="h-4 bg-[rgba(var(--neon-purple-rgb),0.04)] rounded w-1/2"></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {userSkills.map(skill => (
                      <UserSkillCard
                        key={skill.id}
                        skill={skill}
                        loading={loadingPublishId === skill.id}
                        onPublish={() => handlePublish(skill)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Skills Grid */}
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="glass-panel rounded p-6 animate-pulse hud-corners">
                <div className="h-6 bg-[rgba(var(--neon-cyan-rgb),0.06)] rounded w-3/4 mb-3"></div>
                <div className="h-4 bg-[rgba(var(--neon-cyan-rgb),0.04)] rounded w-full mb-2"></div>
                <div className="h-4 bg-[rgba(var(--neon-cyan-rgb),0.04)] rounded w-2/3"></div>
              </div>
            ))}
          </div>
        ) : skills.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto rounded border border-[rgba(var(--neon-cyan-rgb),0.15)] bg-[rgba(var(--neon-cyan-rgb),0.03)] flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-[rgba(var(--neon-cyan-rgb),0.3)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-mono-cyber neon-text mb-1">No skills found</h3>
            <p className="text-muted-foreground font-mono-cyber text-sm">Try adjusting your filters or search query</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {skills.map(skill => (
              <SkillCard key={skill.id} skill={skill} />
            ))}
          </div>
        )}
      </div>

      {/* Publish Dialog */}
      {publishDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closePublishDialog}
          />

          {/* Dialog */}
          <div className="relative glass-panel rounded-lg w-full max-w-lg mx-4 hud-corners border border-[rgba(var(--neon-cyan-rgb),0.2)] shadow-[0_0_30px_rgba(var(--neon-cyan-rgb),0.1)]">
            {/* Close button */}
            {publishStep !== 'publishing' && (
              <button
                onClick={closePublishDialog}
                className="absolute top-4 right-4 text-[rgba(var(--neon-cyan-rgb),0.4)] hover:text-[var(--neon-cyan)] transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}

            <div className="p-6">
              {/* Step: Choose pricing */}
              {publishStep === 'choose' && (
                <>
                  <h2 className="font-mono-cyber text-sm uppercase tracking-wider neon-text mb-1">
                    Publish Skill
                  </h2>
                  <p className="text-[rgba(var(--neon-cyan-rgb),0.4)] font-mono-cyber text-xs mb-5">
                    {publishDialog.skill.title}
                  </p>

                  {publishError && (
                    <div className="mb-4 px-4 py-2 rounded bg-[rgba(var(--neon-red-rgb),0.08)] border border-[rgba(var(--neon-red-rgb),0.2)] text-[var(--neon-red)] text-xs font-mono-cyber">
                      {publishError}
                    </div>
                  )}

                  {/* Pricing selection */}
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    <button
                      onClick={() => { setPublishPricing('free'); setPublishPriceSui(''); }}
                      className={`p-4 rounded border text-left transition-all ${
                        publishPricing === 'free'
                          ? 'border-[var(--neon-green)] bg-[rgba(var(--neon-green-rgb),0.08)]'
                          : 'border-[rgba(var(--neon-cyan-rgb),0.1)] hover:border-[rgba(var(--neon-cyan-rgb),0.25)]'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          publishPricing === 'free'
                            ? 'border-[var(--neon-green)]'
                            : 'border-[rgba(var(--neon-cyan-rgb),0.2)]'
                        }`}>
                          {publishPricing === 'free' && (
                            <div className="w-2 h-2 rounded-full bg-[var(--neon-green)]" />
                          )}
                        </div>
                        <span className="font-mono-cyber text-sm text-[var(--neon-green)]">Free</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground font-mono-cyber pl-6">
                        Anyone can access without payment
                      </p>
                    </button>

                    <button
                      onClick={() => setPublishPricing('paid')}
                      className={`p-4 rounded border text-left transition-all ${
                        publishPricing === 'paid'
                          ? 'border-[var(--neon-magenta)] bg-[rgba(var(--neon-magenta-rgb),0.08)]'
                          : 'border-[rgba(var(--neon-cyan-rgb),0.1)] hover:border-[rgba(var(--neon-cyan-rgb),0.25)]'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          publishPricing === 'paid'
                            ? 'border-[var(--neon-magenta)]'
                            : 'border-[rgba(var(--neon-cyan-rgb),0.2)]'
                        }`}>
                          {publishPricing === 'paid' && (
                            <div className="w-2 h-2 rounded-full bg-[var(--neon-magenta)]" />
                          )}
                        </div>
                        <span className="font-mono-cyber text-sm text-[var(--neon-magenta)]">Paid</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground font-mono-cyber pl-6">
                        Encrypted with Seal, buyers pay SUI
                      </p>
                    </button>
                  </div>

                  {/* Price input (only for paid) */}
                  {publishPricing === 'paid' && (
                    <div className="mb-4">
                      <label className="block text-xs font-mono-cyber uppercase tracking-wider text-[rgba(var(--neon-cyan-rgb),0.6)] mb-1.5">
                        Price (SUI)
                      </label>
                      <input
                        type="number"
                        value={publishPriceSui}
                        onChange={(e) => setPublishPriceSui(e.target.value)}
                        placeholder="e.g. 0.5"
                        min="0.001"
                        step="0.01"
                        className="w-full cyber-input px-4 py-2.5 rounded font-mono-cyber text-sm"
                      />
                      {publishPriceSui && parseFloat(publishPriceSui) > 0 && (
                        <p className="text-[rgba(var(--neon-magenta-rgb),0.5)] font-mono-cyber text-[10px] mt-1">
                          {mistToSui(suiToMist(parseFloat(publishPriceSui)))} per access
                        </p>
                      )}
                    </div>
                  )}

                  {/* Description */}
                  <div className="mb-5">
                    <label className="block text-xs font-mono-cyber uppercase tracking-wider text-[rgba(var(--neon-cyan-rgb),0.6)] mb-1.5">
                      Description (optional)
                    </label>
                    <textarea
                      value={publishDescription}
                      onChange={(e) => setPublishDescription(e.target.value)}
                      placeholder="Brief description of what this skill does..."
                      rows={2}
                      className="w-full cyber-input px-4 py-2.5 rounded font-mono-cyber text-sm resize-none"
                    />
                  </div>

                  {/* Wallet status */}
                  {!connected && (
                    <div className="mb-4 p-3 rounded bg-[rgba(var(--neon-amber-rgb),0.08)] border border-[rgba(var(--neon-amber-rgb),0.2)]">
                      <p className="text-[var(--neon-amber)] font-mono-cyber text-xs">
                        Connect your Sui wallet to publish on-chain.
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={closePublishDialog}
                      className="px-4 py-2.5 rounded font-mono-cyber text-sm text-[rgba(var(--neon-cyan-rgb),0.5)] hover:text-[var(--neon-cyan)] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmPublish}
                      disabled={
                        !connected ||
                        publishing ||
                        (publishPricing === 'paid' && (!publishPriceSui || parseFloat(publishPriceSui) <= 0))
                      }
                      className="cyber-btn px-5 py-2.5 rounded font-mono-cyber text-sm disabled:opacity-30"
                    >
                      {!connected
                        ? 'Connect Wallet'
                        : publishPricing === 'free'
                          ? 'Publish Free'
                          : `Publish for ${publishPriceSui && parseFloat(publishPriceSui) > 0 ? mistToSui(suiToMist(parseFloat(publishPriceSui))) : '...'}`}
                    </button>
                  </div>
                </>
              )}

              {/* Step: Publishing */}
              {publishStep === 'publishing' && (
                <div className="text-center py-4">
                  <div className="w-12 h-12 mx-auto mb-4 rounded-full border border-[rgba(var(--neon-cyan-rgb),0.2)] bg-[rgba(var(--neon-cyan-rgb),0.05)] flex items-center justify-center">
                    <svg className="w-6 h-6 text-[var(--neon-cyan)] animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  </div>
                  <h2 className="font-mono-cyber neon-text text-sm uppercase tracking-wider mb-2">Publishing...</h2>
                  <p className="text-muted-foreground font-mono-cyber text-xs">
                    {publishPricing === 'paid' ? 'Encrypting with Seal → ' : ''}
                    Uploading to Walrus → Registering on Sui
                  </p>
                  <p className="text-[rgba(var(--neon-cyan-rgb),0.3)] font-mono-cyber text-[10px] mt-4">
                    Please approve the wallet transactions when prompted
                  </p>
                </div>
              )}

              {/* Step: Done */}
              {publishStep === 'done' && publishResult && (
                <div className="py-2">
                  <div className="text-center mb-5">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-full border border-[rgba(var(--neon-green-rgb),0.3)] bg-[rgba(var(--neon-green-rgb),0.08)] flex items-center justify-center">
                      <svg className="w-6 h-6 text-[var(--neon-green)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h2 className="font-mono-cyber text-[var(--neon-green)] text-sm uppercase tracking-wider mb-1">Published Successfully</h2>
                    <p className="text-muted-foreground font-mono-cyber text-[10px]">
                      Your skill is now live on the decentralized marketplace
                    </p>
                  </div>

                  <div className="space-y-2 text-sm font-mono-cyber mb-5">
                    <div className="flex justify-between items-center p-2.5 rounded bg-[rgba(var(--neon-cyan-rgb),0.03)] border border-[rgba(var(--neon-cyan-rgb),0.08)]">
                      <span className="text-[rgba(var(--neon-cyan-rgb),0.5)] text-[10px] uppercase">Blob ID</span>
                      <span className="text-[10px] truncate max-w-[250px]">{publishResult.blobId}</span>
                    </div>
                    <div className="flex justify-between items-center p-2.5 rounded bg-[rgba(var(--neon-cyan-rgb),0.03)] border border-[rgba(var(--neon-cyan-rgb),0.08)]">
                      <span className="text-[rgba(var(--neon-cyan-rgb),0.5)] text-[10px] uppercase">On-Chain ID</span>
                      <span className="text-[10px] truncate max-w-[250px]">{publishResult.skillObjectId}</span>
                    </div>
                    <div className="flex justify-between items-center p-2.5 rounded bg-[rgba(var(--neon-cyan-rgb),0.03)] border border-[rgba(var(--neon-cyan-rgb),0.08)]">
                      <span className="text-[rgba(var(--neon-cyan-rgb),0.5)] text-[10px] uppercase">TX Digest</span>
                      <span className="text-[10px] truncate max-w-[250px]">{publishResult.txDigest}</span>
                    </div>
                  </div>

                  <div className="flex justify-center gap-3">
                    {publishResult.dbSkillId && (
                      <Link
                        href={`/marketplace/${publishResult.dbSkillId}`}
                        className="cyber-btn px-5 py-2.5 rounded font-mono-cyber text-sm"
                        onClick={() => { setPublishDialog(null); setPublishStep('choose'); setPublishResult(null); }}
                      >
                        View Skill
                      </Link>
                    )}
                    <button
                      onClick={closePublishDialog}
                      className="px-5 py-2.5 rounded font-mono-cyber text-sm text-[rgba(var(--neon-cyan-rgb),0.5)] hover:text-[var(--neon-cyan)] border border-[rgba(var(--neon-cyan-rgb),0.15)] hover:border-[rgba(var(--neon-cyan-rgb),0.3)] transition-colors"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const SCENE_COLORS: Record<string, string> = {
  sdk: 'bg-[rgba(var(--neon-cyan-rgb),0.1)] text-[var(--neon-cyan)] border border-[rgba(var(--neon-cyan-rgb),0.2)]',
  learn: 'bg-[rgba(var(--neon-purple-rgb),0.1)] text-[var(--neon-purple)] border border-[rgba(var(--neon-purple-rgb),0.2)]',
  audit: 'bg-[rgba(var(--neon-red-rgb),0.1)] text-[var(--neon-red)] border border-[rgba(var(--neon-red-rgb),0.2)]',
  frontend: 'bg-[rgba(var(--neon-green-rgb),0.1)] text-[var(--neon-green)] border border-[rgba(var(--neon-green-rgb),0.2)]',
  bot: 'bg-[rgba(var(--neon-amber-rgb),0.1)] text-[var(--neon-amber)] border border-[rgba(var(--neon-amber-rgb),0.2)]',
  docs: 'bg-[rgba(var(--neon-cyan-rgb),0.1)] text-[var(--neon-cyan)] border border-[rgba(var(--neon-cyan-rgb),0.2)]',
  transaction: 'bg-[rgba(var(--neon-magenta-rgb),0.1)] text-[var(--neon-magenta)] border border-[rgba(var(--neon-magenta-rgb),0.2)]',
};

function SkillCard({ skill }: { skill: Skill }) {
  const isFree = !skill.priceMist || skill.priceMist === 0;
  const isOnChain = !!skill.blobId;

  return (
    <Link href={`/marketplace/${skill.id}`}>
      <div className="glass-panel rounded p-6 h-full hover:border-[rgba(var(--neon-cyan-rgb),0.25)] transition-all cursor-pointer group hud-corners">
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-mono-cyber text-sm uppercase tracking-wider group-hover:text-[var(--neon-cyan)] transition-colors flex-1 mr-2">
            {skill.title}
          </h3>
          <div className="flex items-center gap-1.5 shrink-0">
            {skill.isFromAwesome && (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono-cyber bg-[rgba(var(--neon-amber-rgb),0.12)] text-[var(--neon-amber)] border border-[rgba(var(--neon-amber-rgb),0.25)]">
                Featured
              </span>
            )}
            {/* Price badge */}
            {isFree ? (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono-cyber bg-[rgba(var(--neon-green-rgb),0.1)] text-[var(--neon-green)] border border-[rgba(var(--neon-green-rgb),0.25)]">
                Free
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono-cyber bg-[rgba(var(--neon-magenta-rgb),0.1)] text-[var(--neon-magenta)] border border-[rgba(var(--neon-magenta-rgb),0.25)]">
                {mistToSui(BigInt(skill.priceMist))}
              </span>
            )}
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-4 line-clamp-2 font-mono-cyber">
          {skill.description}
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          <span className={`px-2 py-1 rounded text-xs font-mono-cyber uppercase tracking-wider ${SCENE_COLORS[skill.scene] || 'bg-[rgba(var(--neon-cyan-rgb),0.05)] text-[rgba(var(--neon-cyan-rgb),0.5)]'}`}>
            {skill.scene}
          </span>
          <span className="px-2 py-1 rounded text-xs font-mono-cyber uppercase tracking-wider bg-[rgba(var(--neon-cyan-rgb),0.05)] text-[rgba(var(--neon-cyan-rgb),0.5)] border border-[rgba(var(--neon-cyan-rgb),0.1)]">
            {skill.network}
          </span>
          {isOnChain && (
            <span className="px-2 py-1 rounded text-xs font-mono-cyber uppercase tracking-wider bg-[rgba(var(--neon-purple-rgb),0.05)] text-[rgba(var(--neon-purple-rgb),0.5)] border border-[rgba(var(--neon-purple-rgb),0.1)]">
              on-chain
            </span>
          )}
        </div>

        <div className="flex items-center justify-between text-sm text-muted-foreground font-mono-cyber">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-[rgba(var(--neon-amber-rgb),0.6)]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
              {skill.starsCount}
            </span>
            <span className="flex items-center gap-1 text-[rgba(var(--neon-cyan-rgb),0.5)]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {skill.downloadsCount}
            </span>
          </div>
          {skill.repoOwner === 'direct' ? (
            <span className="font-mono-cyber text-xs text-[rgba(var(--neon-purple-rgb),0.5)]">
              Direct Upload
            </span>
          ) : skill.creatorAddress ? (
            <span className="font-mono-cyber text-xs text-[rgba(var(--neon-cyan-rgb),0.35)]">
              {skill.creatorAddress.slice(0, 6)}...{skill.creatorAddress.slice(-4)}
            </span>
          ) : (
            <span className="font-mono-cyber text-xs text-[rgba(var(--neon-cyan-rgb),0.35)]">
              {skill.repoOwner}/{skill.repoName}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function UserSkillCard({ skill, loading, onPublish }: {
  skill: UserSkillItem;
  loading: boolean;
  onPublish: () => void;
}) {
  return (
    <div className="glass-panel rounded p-4 border border-[rgba(var(--neon-purple-rgb),0.15)] hover:border-[rgba(var(--neon-purple-rgb),0.3)] transition-all hud-corners">
      <h3 className="font-mono-cyber text-sm truncate mb-2" title={skill.title}>
        {skill.title}
      </h3>

      <div className="flex flex-wrap gap-2 mb-3">
        <span className={`px-2 py-0.5 rounded text-[10px] font-mono-cyber uppercase tracking-wider ${SCENE_COLORS[skill.scene] || 'bg-[rgba(var(--neon-cyan-rgb),0.05)] text-[rgba(var(--neon-cyan-rgb),0.5)]'}`}>
          {skill.scene}
        </span>
        <span className="px-2 py-0.5 rounded text-[10px] font-mono-cyber uppercase tracking-wider bg-[rgba(var(--neon-cyan-rgb),0.05)] text-[rgba(var(--neon-cyan-rgb),0.5)] border border-[rgba(var(--neon-cyan-rgb),0.1)]">
          {skill.network}
        </span>
      </div>

      {skill.packageId && (
        <p className="text-[10px] text-muted-foreground font-mono truncate mb-3" title={skill.packageId}>
          {skill.packageId.slice(0, 10)}...{skill.packageId.slice(-6)}
        </p>
      )}

      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground font-mono-cyber">
          {new Date(skill.createdAt).toLocaleDateString()}
        </span>
        <button
          onClick={(e) => { e.preventDefault(); onPublish(); }}
          disabled={loading}
          className="cyber-btn px-3 py-1.5 rounded text-xs font-mono-cyber disabled:opacity-50"
        >
          {loading ? (
            <span className="flex items-center gap-1.5">
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading...
            </span>
          ) : (
            'Publish'
          )}
        </button>
      </div>
    </div>
  );
}
