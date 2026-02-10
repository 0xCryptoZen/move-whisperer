'use client';

import { useState, useEffect } from 'react';
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

// Mock data for now - will be replaced with API call
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
  },
];

export default function MarketplacePage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    scene: '',
    network: '',
    search: '',
  });

  useEffect(() => {
    const fetchSkills = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (filters.scene) params.set('scene', filters.scene);
        if (filters.network) params.set('network', filters.network);
        if (filters.search) params.set('search', filters.search);

        const response = await fetch(`/api/marketplace/skills?${params.toString()}`);
        if (response.ok) {
          const data = await response.json() as { skills?: Skill[] };
          setSkills(data.skills || []);
        } else {
          // Fallback to mock data if API fails
          let filtered = [...MOCK_SKILLS];
          if (filters.scene) filtered = filtered.filter(s => s.scene === filters.scene);
          if (filters.network) filtered = filtered.filter(s => s.network === filters.network);
          if (filters.search) {
            const search = filters.search.toLowerCase();
            filtered = filtered.filter(s =>
              s.title.toLowerCase().includes(search) ||
              s.description.toLowerCase().includes(search)
            );
          }
          setSkills(filtered);
        }
      } catch {
        // Fallback to mock data on error
        let filtered = [...MOCK_SKILLS];
        if (filters.scene) filtered = filtered.filter(s => s.scene === filters.scene);
        if (filters.network) filtered = filtered.filter(s => s.network === filters.network);
        if (filters.search) {
          const search = filters.search.toLowerCase();
          filtered = filtered.filter(s =>
            s.title.toLowerCase().includes(search) ||
            s.description.toLowerCase().includes(search)
          );
        }
        setSkills(filtered);
      } finally {
        setLoading(false);
      }
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
                Discover and share Claude skills for Sui Move contracts
              </p>
            </div>
            <Link
              href="/marketplace/submit"
              className="cyber-btn px-5 py-2.5 rounded font-mono-cyber text-sm"
            >
              Submit Skill
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
        </div>

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
  return (
    <Link href={`/marketplace/${skill.id}`}>
      <div className="glass-panel rounded p-6 h-full hover:border-[rgba(var(--neon-cyan-rgb),0.25)] transition-all cursor-pointer group hud-corners">
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-mono-cyber text-sm uppercase tracking-wider group-hover:text-[var(--neon-cyan)] transition-colors">
            {skill.title}
          </h3>
          {skill.isFromAwesome && (
            <span className="px-2 py-0.5 rounded text-[10px] font-mono-cyber bg-[rgba(var(--neon-amber-rgb),0.12)] text-[var(--neon-amber)] border border-[rgba(var(--neon-amber-rgb),0.25)]">
              Featured
            </span>
          )}
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
          <span className="font-mono-cyber text-xs text-[rgba(var(--neon-cyan-rgb),0.35)]">
            {skill.repoOwner}/{skill.repoName}
          </span>
        </div>
      </div>
    </Link>
  );
}
