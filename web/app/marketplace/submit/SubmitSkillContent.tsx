'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSkillMarketplace } from '@/hooks/useSkillMarketplace';
import { useAuth } from '@/lib/auth/context';
import { suiToMist, mistToSui } from '@/lib/contracts/skill-marketplace';

const SCENES = [
  { value: 'sdk', label: 'SDK Integration' },
  { value: 'learn', label: 'Learning' },
  { value: 'audit', label: 'Security Audit' },
  { value: 'frontend', label: 'Frontend' },
  { value: 'bot', label: 'Trading Bot' },
  { value: 'docs', label: 'Documentation' },
  { value: 'transaction', label: 'Transaction' },
];

const NETWORKS = [
  { value: 'mainnet', label: 'Mainnet' },
  { value: 'testnet', label: 'Testnet' },
  { value: 'devnet', label: 'Devnet' },
];

type Step = 'content' | 'metadata' | 'publishing' | 'done';

export default function SubmitSkillContent() {
  const router = useRouter();
  const { user } = useAuth();
  const { publishSkill, publishing, connected, address } = useSkillMarketplace();

  const [step, setStep] = useState<Step>('content');
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scene, setScene] = useState('sdk');
  const [network, setNetwork] = useState('mainnet');
  const [suiPackageId, setSuiPackageId] = useState('');
  const [priceSui, setPriceSui] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [publishResult, setPublishResult] = useState<{
    blobId: string;
    skillObjectId: string;
    txDigest: string;
  } | null>(null);

  const isFree = !priceSui || parseFloat(priceSui) === 0;
  const priceMist = isFree ? BigInt(0) : suiToMist(parseFloat(priceSui) || 0);

  const handleNext = () => {
    if (step === 'content') {
      if (!content.trim()) {
        setError('Please paste your SKILL.md content');
        return;
      }
      setError(null);
      setStep('metadata');
    }
  };

  const handlePublish = async () => {
    if (!connected || !address) {
      setError('Please connect your wallet first');
      return;
    }
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setError(null);
    setStep('publishing');

    try {
      const result = await publishSkill({
        content,
        title: title.trim(),
        description: description.trim(),
        price: priceMist,
        scene,
        network,
        suiPackageId: suiPackageId.trim() || undefined,
      });

      setPublishResult(result);

      // Sync to D1 database for indexing
      try {
        await fetch('/api/marketplace/skills', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim(),
            scene,
            network,
            packageId: suiPackageId.trim() || null,
            blobId: result.blobId,
            onChainId: result.skillObjectId,
            priceMist: Number(priceMist),
            creatorAddress: address,
            isEncrypted: !isFree,
          }),
        });
      } catch {
        // D1 sync failure is non-critical
        console.warn('Failed to sync skill to database index');
      }

      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publishing failed');
      setStep('metadata');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-[rgba(var(--neon-cyan-rgb),0.1)]">
        <div className="mx-auto px-6 sm:px-10 lg:px-16 py-8 max-w-[1680px]">
          <div className="flex items-center gap-4">
            <Link
              href="/marketplace"
              className="p-2 rounded hover:bg-[rgba(var(--neon-cyan-rgb),0.05)] transition-colors"
            >
              <svg className="w-5 h-5 text-[rgba(var(--neon-cyan-rgb),0.5)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-2xl font-bold font-mono-cyber neon-text tracking-wide uppercase">Publish Skill</h1>
              <p className="text-muted-foreground mt-1 font-mono-cyber text-sm">
                Upload to Walrus &middot; Register on Sui &middot; Set your price
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto px-6 sm:px-10 lg:px-16 py-8 max-w-3xl">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8 font-mono-cyber text-xs">
          {(['content', 'metadata', 'publishing', 'done'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] border ${
                step === s
                  ? 'border-[var(--neon-cyan)] text-[var(--neon-cyan)] bg-[rgba(var(--neon-cyan-rgb),0.1)]'
                  : i < ['content', 'metadata', 'publishing', 'done'].indexOf(step)
                    ? 'border-[var(--neon-green)] text-[var(--neon-green)] bg-[rgba(var(--neon-green-rgb),0.1)]'
                    : 'border-[rgba(var(--neon-cyan-rgb),0.2)] text-[rgba(var(--neon-cyan-rgb),0.3)]'
              }`}>
                {i + 1}
              </div>
              <span className={`uppercase tracking-wider ${
                step === s ? 'text-[var(--neon-cyan)]' : 'text-[rgba(var(--neon-cyan-rgb),0.3)]'
              }`}>
                {s}
              </span>
              {i < 3 && <div className="w-8 h-px bg-[rgba(var(--neon-cyan-rgb),0.1)]" />}
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 rounded glass-panel border-[rgba(var(--neon-red-rgb),0.3)]">
            <p className="text-sm text-[var(--neon-red)] font-mono-cyber">{error}</p>
          </div>
        )}

        {/* Step: Content */}
        {step === 'content' && (
          <div className="glass-panel rounded p-6 hud-corners">
            <h2 className="font-mono-cyber text-sm uppercase tracking-wider neon-text mb-4">Skill Content</h2>
            <p className="text-muted-foreground text-sm font-mono-cyber mb-4">
              Paste your SKILL.md content below. This will be stored on Walrus decentralized storage.
            </p>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="# My Skill\n\nPaste your SKILL.md content here..."
              rows={16}
              className="w-full cyber-input px-4 py-3 rounded font-mono text-sm resize-y"
            />
            <div className="flex justify-between items-center mt-4">
              <span className="text-[rgba(var(--neon-cyan-rgb),0.3)] font-mono-cyber text-xs">
                {content.length} characters &middot; {new TextEncoder().encode(content).length} bytes
              </span>
              <button
                onClick={handleNext}
                disabled={!content.trim()}
                className="cyber-btn px-6 py-2.5 rounded font-mono-cyber text-sm disabled:opacity-30"
              >
                Next: Metadata
              </button>
            </div>
          </div>
        )}

        {/* Step: Metadata */}
        {step === 'metadata' && (
          <div className="glass-panel rounded p-6 hud-corners space-y-5">
            <h2 className="font-mono-cyber text-sm uppercase tracking-wider neon-text mb-4">Skill Details</h2>

            <div>
              <label className="block text-xs font-mono-cyber uppercase tracking-wider text-[rgba(var(--neon-cyan-rgb),0.6)] mb-1.5">Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Cetus AMM Integration"
                className="w-full cyber-input px-4 py-2.5 rounded font-mono-cyber text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-mono-cyber uppercase tracking-wider text-[rgba(var(--neon-cyan-rgb),0.6)] mb-1.5">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of what this skill does..."
                rows={3}
                className="w-full cyber-input px-4 py-2.5 rounded font-mono-cyber text-sm resize-y"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono-cyber uppercase tracking-wider text-[rgba(var(--neon-cyan-rgb),0.6)] mb-1.5">Scene</label>
                <select
                  value={scene}
                  onChange={(e) => setScene(e.target.value)}
                  className="w-full cyber-input px-4 py-2.5 rounded font-mono-cyber text-sm"
                >
                  {SCENES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-mono-cyber uppercase tracking-wider text-[rgba(var(--neon-cyan-rgb),0.6)] mb-1.5">Network</label>
                <select
                  value={network}
                  onChange={(e) => setNetwork(e.target.value)}
                  className="w-full cyber-input px-4 py-2.5 rounded font-mono-cyber text-sm"
                >
                  {NETWORKS.map(n => (
                    <option key={n.value} value={n.value}>{n.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono-cyber uppercase tracking-wider text-[rgba(var(--neon-cyan-rgb),0.6)] mb-1.5">Sui Package ID (optional)</label>
              <input
                type="text"
                value={suiPackageId}
                onChange={(e) => setSuiPackageId(e.target.value)}
                placeholder="0x..."
                className="w-full cyber-input px-4 py-2.5 rounded font-mono-cyber text-sm"
              />
            </div>

            {/* Pricing */}
            <div className="border-t border-[rgba(var(--neon-cyan-rgb),0.1)] pt-5">
              <label className="block text-xs font-mono-cyber uppercase tracking-wider text-[rgba(var(--neon-cyan-rgb),0.6)] mb-1.5">
                Price (SUI) &middot; Leave empty or 0 for free
              </label>
              <input
                type="number"
                value={priceSui}
                onChange={(e) => setPriceSui(e.target.value)}
                placeholder="0"
                min="0"
                step="0.01"
                className="w-full cyber-input px-4 py-2.5 rounded font-mono-cyber text-sm"
              />
              <p className="text-[rgba(var(--neon-cyan-rgb),0.3)] font-mono-cyber text-xs mt-1.5">
                {isFree ? (
                  'Free — anyone can access without payment'
                ) : (
                  <>Paid — {mistToSui(priceMist)} &middot; Content will be encrypted with Seal</>
                )}
              </p>
            </div>

            {/* Wallet status */}
            {!connected && (
              <div className="p-3 rounded bg-[rgba(var(--neon-amber-rgb),0.08)] border border-[rgba(var(--neon-amber-rgb),0.2)]">
                <p className="text-[var(--neon-amber)] font-mono-cyber text-xs">
                  Connect your Sui wallet to publish. The skill will be registered on-chain.
                </p>
              </div>
            )}

            <div className="flex gap-3 justify-between pt-2">
              <button
                onClick={() => setStep('content')}
                className="px-5 py-2.5 rounded font-mono-cyber text-sm text-[rgba(var(--neon-cyan-rgb),0.5)] hover:text-[var(--neon-cyan)] transition-colors"
              >
                Back
              </button>
              <button
                onClick={handlePublish}
                disabled={!connected || !title.trim() || publishing}
                className="cyber-btn px-6 py-2.5 rounded font-mono-cyber text-sm disabled:opacity-30"
              >
                {!connected
                  ? 'Connect Wallet'
                  : isFree
                    ? 'Publish Free Skill'
                    : `Publish for ${mistToSui(priceMist)}`}
              </button>
            </div>
          </div>
        )}

        {/* Step: Publishing */}
        {step === 'publishing' && (
          <div className="glass-panel rounded p-8 hud-corners text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full border border-[rgba(var(--neon-cyan-rgb),0.2)] bg-[rgba(var(--neon-cyan-rgb),0.05)] flex items-center justify-center">
              <svg className="w-6 h-6 text-[var(--neon-cyan)] animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <h2 className="font-mono-cyber neon-text text-sm uppercase tracking-wider mb-2">Publishing...</h2>
            <p className="text-muted-foreground font-mono-cyber text-xs">
              {!isFree ? 'Encrypting with Seal → ' : ''}
              Uploading to Walrus → Registering on Sui
            </p>
            <p className="text-[rgba(var(--neon-cyan-rgb),0.3)] font-mono-cyber text-[10px] mt-4">
              Please approve the wallet transactions when prompted
            </p>
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && publishResult && (
          <div className="glass-panel rounded p-8 hud-corners">
            <div className="text-center mb-6">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full border border-[rgba(var(--neon-green-rgb),0.3)] bg-[rgba(var(--neon-green-rgb),0.08)] flex items-center justify-center">
                <svg className="w-6 h-6 text-[var(--neon-green)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="font-mono-cyber text-[var(--neon-green)] text-sm uppercase tracking-wider mb-1">Published Successfully</h2>
              <p className="text-muted-foreground font-mono-cyber text-xs">
                Your skill is now live on the decentralized marketplace
              </p>
            </div>

            <div className="space-y-3 text-sm font-mono-cyber">
              <div className="flex justify-between items-center p-3 rounded bg-[rgba(var(--neon-cyan-rgb),0.03)] border border-[rgba(var(--neon-cyan-rgb),0.08)]">
                <span className="text-[rgba(var(--neon-cyan-rgb),0.5)] text-xs uppercase">Blob ID</span>
                <span className="text-xs truncate max-w-[300px]">{publishResult.blobId}</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded bg-[rgba(var(--neon-cyan-rgb),0.03)] border border-[rgba(var(--neon-cyan-rgb),0.08)]">
                <span className="text-[rgba(var(--neon-cyan-rgb),0.5)] text-xs uppercase">On-Chain ID</span>
                <span className="text-xs truncate max-w-[300px]">{publishResult.skillObjectId}</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded bg-[rgba(var(--neon-cyan-rgb),0.03)] border border-[rgba(var(--neon-cyan-rgb),0.08)]">
                <span className="text-[rgba(var(--neon-cyan-rgb),0.5)] text-xs uppercase">TX Digest</span>
                <span className="text-xs truncate max-w-[300px]">{publishResult.txDigest}</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded bg-[rgba(var(--neon-cyan-rgb),0.03)] border border-[rgba(var(--neon-cyan-rgb),0.08)]">
                <span className="text-[rgba(var(--neon-cyan-rgb),0.5)] text-xs uppercase">Price</span>
                <span className="text-xs">{isFree ? 'Free' : mistToSui(priceMist)}</span>
              </div>
            </div>

            <div className="flex gap-3 justify-center mt-6">
              <Link
                href="/marketplace"
                className="cyber-btn px-5 py-2.5 rounded font-mono-cyber text-sm"
              >
                View Marketplace
              </Link>
              <button
                onClick={() => {
                  setStep('content');
                  setContent('');
                  setTitle('');
                  setDescription('');
                  setPriceSui('');
                  setPublishResult(null);
                }}
                className="px-5 py-2.5 rounded font-mono-cyber text-sm text-[rgba(var(--neon-cyan-rgb),0.5)] hover:text-[var(--neon-cyan)] border border-[rgba(var(--neon-cyan-rgb),0.15)] hover:border-[rgba(var(--neon-cyan-rgb),0.3)] transition-colors"
              >
                Publish Another
              </button>
            </div>
          </div>
        )}

        {/* Info panel */}
        {(step === 'content' || step === 'metadata') && (
          <div className="mt-8 glass-panel rounded p-6 hud-corners">
            <h3 className="font-mono-cyber text-xs uppercase tracking-wider neon-text mb-4">How It Works</h3>
            <ul className="space-y-3 text-xs text-muted-foreground font-mono-cyber">
              <li className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full border border-[rgba(var(--neon-cyan-rgb),0.2)] flex items-center justify-center text-[10px] text-[rgba(var(--neon-cyan-rgb),0.5)] shrink-0 mt-0.5">1</span>
                <span>Your SKILL.md content is stored on <strong className="text-[var(--neon-cyan)]">Walrus</strong> decentralized storage</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full border border-[rgba(var(--neon-cyan-rgb),0.2)] flex items-center justify-center text-[10px] text-[rgba(var(--neon-cyan-rgb),0.5)] shrink-0 mt-0.5">2</span>
                <span>Paid skills are encrypted with <strong className="text-[var(--neon-cyan)]">Seal</strong> — only buyers can decrypt</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full border border-[rgba(var(--neon-cyan-rgb),0.2)] flex items-center justify-center text-[10px] text-[rgba(var(--neon-cyan-rgb),0.5)] shrink-0 mt-0.5">3</span>
                <span>A <strong className="text-[var(--neon-cyan)]">SkillRecord</strong> is registered on Sui with price and metadata</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full border border-[rgba(var(--neon-cyan-rgb),0.2)] flex items-center justify-center text-[10px] text-[rgba(var(--neon-cyan-rgb),0.5)] shrink-0 mt-0.5">4</span>
                <span>Buyers pay SUI to receive an <strong className="text-[var(--neon-cyan)]">AccessCap</strong> NFT for decryption</span>
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
