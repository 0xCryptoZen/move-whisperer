'use client';

export const runtime = 'edge';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

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
  content?: string;
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

// Mock skill data - will be replaced with API call
const MOCK_SKILLS: Record<string, Skill> = {
  '1': {
    id: '1',
    title: 'Cetus AMM Integration',
    description: 'Complete skill for integrating with Cetus AMM - swap, liquidity, and position management. This skill provides comprehensive guidance for interacting with the Cetus protocol on Sui.',
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
  },
  '2': {
    id: '2',
    title: 'DeepBook Trading Bot',
    description: 'Skill for building trading bots on DeepBook CLOB. Covers order placement, market making strategies, and real-time order book monitoring.',
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
  },
  '3': {
    id: '3',
    title: 'Scallop Lending Audit',
    description: 'Security audit skill for Scallop lending protocol. Includes vulnerability patterns, permission analysis, and risk assessment frameworks.',
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
  },
};

export default function SkillDetailPage() {
  const params = useParams();
  const skillId = params.id as string;
  const [skill, setSkill] = useState<Skill | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [starred, setStarred] = useState(false);

  useEffect(() => {
    // TODO: Replace with actual API call
    setLoading(true);
    setTimeout(() => {
      const found = MOCK_SKILLS[skillId];
      if (found) {
        setSkill(found);
      } else {
        setError('Skill not found');
      }
      setLoading(false);
    }, 300);
  }, [skillId]);

  const handleCopyUrl = () => {
    if (!skill) return;
    navigator.clipboard.writeText(skill.githubUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStar = () => {
    // TODO: Implement with auth
    setStarred(!starred);
  };

  const handleDownload = () => {
    if (!skill) return;
    // TODO: Track download count via API
    window.open(skill.githubUrl, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-6 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-white/10 rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-white/10 rounded w-2/3 mb-8"></div>
            <div className="glass-panel rounded-2xl p-6 h-64"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !skill) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-6 py-16 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold mb-2">Skill Not Found</h2>
          <p className="text-muted-foreground mb-6">The skill you're looking for doesn't exist or has been removed.</p>
          <Link href="/marketplace" className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors">
            Back to Marketplace
          </Link>
        </div>
      </div>
    );
  }

  const sceneInfo = SCENE_INFO[skill.scene] || { label: skill.scene, color: 'bg-white/10', description: '' };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-white/10">
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-start gap-4">
            <Link
              href="/marketplace"
              className="p-2 rounded-lg hover:bg-white/5 transition-colors mt-1"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold">{skill.title}</h1>
                {skill.isFromAwesome && (
                  <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 text-xs">
                    Featured
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
            {/* Quick Info */}
            <div className="glass-panel rounded-2xl p-6">
              <h2 className="font-semibold text-lg mb-4">About This Skill</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-white/5">
                  <div className="text-sm text-muted-foreground mb-1">Scene</div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-lg text-xs ${sceneInfo.color}`}>
                      {sceneInfo.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{sceneInfo.description}</p>
                </div>

                <div className="p-4 rounded-xl bg-white/5">
                  <div className="text-sm text-muted-foreground mb-1">Network</div>
                  <div className="font-medium capitalize">{skill.network}</div>
                </div>

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

                <div className="p-4 rounded-xl bg-white/5">
                  <div className="text-sm text-muted-foreground mb-1">Created</div>
                  <div>{new Date(skill.createdAt).toLocaleDateString()}</div>
                </div>
              </div>

              {skill.packageId && (
                <div className="mt-4 p-4 rounded-xl bg-white/5">
                  <div className="text-sm text-muted-foreground mb-1">Package ID</div>
                  <div className="flex items-center gap-2">
                    <code className="font-mono text-sm break-all">{skill.packageId}</code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(skill.packageId!);
                      }}
                      className="p-1 rounded hover:bg-white/10 transition-colors flex-shrink-0"
                      title="Copy package ID"
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
                  <div className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <div className="font-medium mb-1">Add to Claude</div>
                    <p className="text-sm text-muted-foreground">
                      Copy the skill URL and add it to your Claude Code skills configuration.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <div className="font-medium mb-1">Reference in Prompts</div>
                    <p className="text-sm text-muted-foreground">
                      Mention the skill name in your prompts to activate context-aware assistance.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    <div className="font-medium mb-1">Start Building</div>
                    <p className="text-sm text-muted-foreground">
                      Claude will use the skill documentation to guide you through integration.
                    </p>
                  </div>
                </div>
              </div>

              {/* Skill URL Copy */}
              <div className="mt-6 p-4 rounded-xl bg-black/30 font-mono text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="break-all text-muted-foreground">{skill.githubUrl}</span>
                  <button
                    onClick={handleCopyUrl}
                    className="p-2 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0"
                  >
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
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Actions */}
            <div className="glass-panel rounded-2xl p-6">
              <div className="space-y-3">
                <button
                  onClick={handleDownload}
                  className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  View on GitHub
                </button>

                <button
                  onClick={handleStar}
                  className={`w-full py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 ${
                    starred
                      ? 'bg-yellow-500/20 text-yellow-400'
                      : 'bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <svg className="w-5 h-5" fill={starred ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                  {starred ? 'Starred' : 'Star'}
                </button>
              </div>
            </div>

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
              <p className="text-sm text-muted-foreground mb-4">
                Generate a similar skill for a different contract
              </p>
              <Link
                href="/generate"
                className="block w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-center font-medium transition-colors"
              >
                Generate Skill
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
