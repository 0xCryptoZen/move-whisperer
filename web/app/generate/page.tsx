'use client';

import { useState, useEffect, useCallback } from 'react';

// Toast notification component with animations
function Toast({ message, isVisible, onClose }: { message: string; isVisible: boolean; onClose: () => void }) {
  const [shouldRender, setShouldRender] = useState(false);
  const [animationClass, setAnimationClass] = useState('');

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
      setAnimationClass('toast-enter');
      const timer = setTimeout(() => {
        setAnimationClass('toast-exit');
        setTimeout(() => {
          setShouldRender(false);
          onClose();
        }, 300);
      }, 1700);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  if (!shouldRender) return null;

  return (
    <div className={`fixed bottom-6 left-1/2 z-50 ${animationClass}`}>
      <div className="flex items-center gap-3 px-5 py-3.5 rounded-2xl text-white shadow-2xl backdrop-blur-md border border-white/30 overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.95) 0%, rgba(16, 185, 129, 0.95) 50%, rgba(5, 150, 105, 0.95) 100%)',
          boxShadow: '0 10px 40px -10px rgba(34, 197, 94, 0.5), 0 0 20px rgba(34, 197, 94, 0.3), inset 0 1px 0 rgba(255,255,255,0.2)'
        }}
      >
        {/* Animated check icon */}
        <div className="w-7 h-7 rounded-full bg-white/25 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={3}
              d="M5 13l4 4L19 7"
              style={{
                strokeDasharray: 24,
                strokeDashoffset: 0,
                animation: 'draw-check 0.3s ease-out 0.2s backwards'
              }}
            />
          </svg>
        </div>
        <span className="font-semibold text-sm tracking-wide">{message}</span>
        {/* Shine effect */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%)',
            backgroundSize: '200% 100%',
            animation: 'toast-shimmer 1.5s ease-in-out'
          }}
        />
      </div>
    </div>
  );
}

type Network = 'mainnet' | 'testnet' | 'devnet';
type SkillScene = 'sdk' | 'learn' | 'audit' | 'frontend' | 'bot' | 'docs';
type TabType = 'generate' | 'source';

// Detailed progress steps with sub-tasks
const PROGRESS_STEPS = [
  { id: 'parse', label: 'Parsing Input', icon: '📝', details: 'Validating package ID format' },
  { id: 'connect', label: 'Connecting to RPC', icon: '🌐', details: 'Establishing connection to Sui network' },
  { id: 'fetch-abi', label: 'Fetching ABI', icon: '📥', details: 'Downloading module ABI from on-chain' },
  { id: 'fetch-source', label: 'Fetching Source', icon: '📜', details: 'Retrieving disassembled bytecode' },
  { id: 'analyze-funcs', label: 'Analyzing Functions', icon: '🔍', details: 'Processing entry and public functions' },
  { id: 'analyze-types', label: 'Analyzing Types', icon: '📊', details: 'Mapping Move types to TypeScript' },
  { id: 'analyze-deps', label: 'Detecting Dependencies', icon: '🔗', details: 'Scanning external package usage' },
  { id: 'generate-md', label: 'Generating SKILL.md', icon: '📝', details: 'Rendering scene-specific template' },
  { id: 'generate-refs', label: 'Generating References', icon: '📚', details: 'Creating types and events docs' },
  { id: 'package', label: 'Packaging Output', icon: '📦', details: 'Preparing downloadable files' },
  { id: 'done', label: 'Complete', icon: '✅', details: 'Generation finished successfully' },
];

interface ProgressLog {
  step: string;
  message: string;
  timestamp: Date;
  status: 'pending' | 'running' | 'completed' | 'error';
}

// Scene configuration
const SCENES: Record<SkillScene, { name: string; nameZh: string; icon: string; description: string; color: string }> = {
  sdk: {
    name: 'SDK Integration',
    nameZh: 'SDK 集成',
    icon: '🔌',
    description: 'Function signatures, code examples, PTB patterns',
    color: 'from-blue-500/20 to-blue-500/5',
  },
  learn: {
    name: 'Protocol Learning',
    nameZh: '原理学习',
    icon: '📚',
    description: 'Architecture, concepts, state transitions',
    color: 'from-purple-500/20 to-purple-500/5',
  },
  audit: {
    name: 'Security Audit',
    nameZh: '安全审计',
    icon: '🔒',
    description: 'Permission model, asset flows, risk analysis',
    color: 'from-red-500/20 to-red-500/5',
  },
  frontend: {
    name: 'Frontend Dev',
    nameZh: '前端开发',
    icon: '🖥️',
    description: 'User flows, data queries, event handling',
    color: 'from-green-500/20 to-green-500/5',
  },
  bot: {
    name: 'Trading Bot',
    nameZh: '交易机器人',
    icon: '🤖',
    description: 'Entry functions, gas optimization, monitoring',
    color: 'from-yellow-500/20 to-yellow-500/5',
  },
  docs: {
    name: 'Documentation',
    nameZh: '文档生成',
    icon: '📝',
    description: 'API reference, terminology, FAQ',
    color: 'from-cyan-500/20 to-cyan-500/5',
  },
};

// Protocol presets
const PROTOCOL_PRESETS = [
  { id: 'deepbook', name: 'DeepBook', packageId: '0xdee9', modules: ['clob_v2'] },
  { id: 'sui', name: 'Sui Framework', packageId: '0x2', modules: ['coin', 'transfer'] },
  { id: 'cetus', name: 'Cetus', packageId: '0x1eabed72c53feb73c83b2ac739c0a42f29e5ca5bd04a71a72c2f9e5bbf13d2c8', modules: ['pool'] },
];

interface GenerateResult {
  skillMd: string;
  packageName: string;
  metadata: {
    packageId: string;
    modules: string[];
    network: string;
  };
}

interface SourceResult {
  packageId: string;
  modules: Record<string, string>;
  fetchedAt: string;
}

interface DecompiledResult {
  decompiled: Record<string, string>;
  errors?: Record<string, string>;
  decompileAt: string;
}

type SourceViewMode = 'disassembled' | 'decompiled';

interface ProgressState {
  stage: string;
  message: string;
  progress: number;
  logs: ProgressLog[];
  startTime: Date;
}

interface SimpleProgressState {
  stage: string;
  message: string;
  progress: number;
}

export default function GeneratePage() {
  const [activeTab, setActiveTab] = useState<TabType>('generate');
  const [input, setInput] = useState('');
  const [network, setNetwork] = useState<Network>('mainnet');
  const [scene, setScene] = useState<SkillScene>('sdk');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [progress, setProgress] = useState<ProgressState | null>(null);

  const addProgressLog = (step: string, message: string, status: 'pending' | 'running' | 'completed' | 'error') => {
    setProgress(prev => {
      if (!prev) return prev;
      const newLog: ProgressLog = { step, message, timestamp: new Date(), status };
      const existingIndex = prev.logs.findIndex(l => l.step === step);
      const newLogs = existingIndex >= 0
        ? prev.logs.map((l, i) => i === existingIndex ? newLog : l)
        : [...prev.logs, newLog];
      return { ...prev, logs: newLogs };
    });
  };

  // Source code state
  const [sourceInput, setSourceInput] = useState('');
  const [sourceNetwork, setSourceNetwork] = useState<Network>('mainnet');
  const [isLoadingSource, setIsLoadingSource] = useState(false);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [sourceResult, setSourceResult] = useState<SourceResult | null>(null);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [sourceProgress, setSourceProgress] = useState<SimpleProgressState | null>(null);

  // Decompilation state
  const [sourceViewMode, setSourceViewMode] = useState<SourceViewMode>('disassembled');
  const [decompiledResult, setDecompiledResult] = useState<DecompiledResult | null>(null);
  const [isDecompiling, setIsDecompiling] = useState(false);
  const [decompileError, setDecompileError] = useState<string | null>(null);

  const getCurrentStepIndex = () => {
    if (!progress) return -1;
    return PROGRESS_STEPS.findIndex(step => step.id === progress.stage);
  };

  const handleGenerate = async () => {
    if (!input.trim()) {
      setError('Please enter a package ID or package::module');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    const startTime = new Date();
    const initialLogs: ProgressLog[] = PROGRESS_STEPS.map(step => ({
      step: step.id,
      message: step.details,
      timestamp: new Date(),
      status: 'pending' as const
    }));

    setProgress({
      stage: 'parse',
      message: 'Starting generation...',
      progress: 0,
      logs: initialLogs,
      startTime
    });

    try {
      // Step 1: Parse
      addProgressLog('parse', 'Validating input format...', 'running');
      await new Promise(r => setTimeout(r, 200));
      addProgressLog('parse', `Parsed: ${input.trim()}`, 'completed');

      // Step 2: Connect
      setProgress(prev => prev ? { ...prev, stage: 'connect', progress: 10, message: 'Connecting to RPC...' } : prev);
      addProgressLog('connect', `Connecting to ${network}...`, 'running');
      await new Promise(r => setTimeout(r, 300));
      addProgressLog('connect', `Connected to ${network} RPC`, 'completed');

      // Step 3: Fetch ABI
      setProgress(prev => prev ? { ...prev, stage: 'fetch-abi', progress: 20, message: 'Fetching ABI...' } : prev);
      addProgressLog('fetch-abi', 'Requesting module ABI...', 'running');

      // Make the actual API call
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: input.trim(),
          network,
          scene,
        }),
      });

      // Simulate remaining steps after API response
      addProgressLog('fetch-abi', 'ABI retrieved successfully', 'completed');

      // Step 4: Fetch Source
      setProgress(prev => prev ? { ...prev, stage: 'fetch-source', progress: 30, message: 'Fetching source code...' } : prev);
      addProgressLog('fetch-source', 'Retrieving disassembled bytecode...', 'running');
      await new Promise(r => setTimeout(r, 200));
      addProgressLog('fetch-source', 'Source code fetched', 'completed');

      // Step 5-7: Analysis
      setProgress(prev => prev ? { ...prev, stage: 'analyze-funcs', progress: 45, message: 'Analyzing functions...' } : prev);
      addProgressLog('analyze-funcs', 'Processing function signatures...', 'running');
      await new Promise(r => setTimeout(r, 200));
      addProgressLog('analyze-funcs', 'Functions analyzed', 'completed');

      setProgress(prev => prev ? { ...prev, stage: 'analyze-types', progress: 55, message: 'Analyzing types...' } : prev);
      addProgressLog('analyze-types', 'Mapping Move types...', 'running');
      await new Promise(r => setTimeout(r, 200));
      addProgressLog('analyze-types', 'Type mapping complete', 'completed');

      setProgress(prev => prev ? { ...prev, stage: 'analyze-deps', progress: 65, message: 'Detecting dependencies...' } : prev);
      addProgressLog('analyze-deps', 'Scanning imports...', 'running');
      await new Promise(r => setTimeout(r, 150));
      addProgressLog('analyze-deps', 'Dependencies detected', 'completed');

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Generation failed');
      }

      const data = await response.json();

      // Step 8-9: Generation
      setProgress(prev => prev ? { ...prev, stage: 'generate-md', progress: 75, message: 'Generating SKILL.md...' } : prev);
      addProgressLog('generate-md', `Rendering ${scene} template...`, 'running');
      await new Promise(r => setTimeout(r, 200));
      addProgressLog('generate-md', 'SKILL.md generated', 'completed');

      setProgress(prev => prev ? { ...prev, stage: 'generate-refs', progress: 85, message: 'Generating references...' } : prev);
      addProgressLog('generate-refs', 'Creating type definitions...', 'running');
      await new Promise(r => setTimeout(r, 150));
      addProgressLog('generate-refs', 'References generated', 'completed');

      // Step 10: Package
      setProgress(prev => prev ? { ...prev, stage: 'package', progress: 95, message: 'Packaging output...' } : prev);
      addProgressLog('package', 'Preparing files...', 'running');
      await new Promise(r => setTimeout(r, 100));
      addProgressLog('package', 'Package ready', 'completed');

      // Done
      setProgress(prev => prev ? { ...prev, stage: 'done', progress: 100, message: 'Complete!' } : prev);
      addProgressLog('done', `Completed in ${((Date.now() - startTime.getTime()) / 1000).toFixed(1)}s`, 'completed');

      setResult(data);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMsg);
      addProgressLog(progress?.stage || 'parse', errorMsg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFetchSource = async () => {
    if (!sourceInput.trim()) {
      setSourceError('Please enter a package ID');
      return;
    }

    setIsLoadingSource(true);
    setSourceError(null);
    setSourceResult(null);
    setSelectedModule(null);
    setDecompiledResult(null);
    setDecompileError(null);
    setSourceViewMode('disassembled');
    setSourceProgress({ stage: 'fetch', message: 'Connecting to RPC...', progress: 20 });

    try {
      // Update progress
      setTimeout(() => {
        setSourceProgress({ stage: 'fetch', message: 'Fetching bytecode...', progress: 50 });
      }, 500);

      const response = await fetch('/api/source', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: sourceInput.trim(),
          network: sourceNetwork,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch source');
      }

      const data = await response.json();
      setSourceResult(data);
      setSourceProgress({ stage: 'done', message: 'Source code fetched!', progress: 100 });

      // Auto-select first module
      const modules = Object.keys(data.modules);
      if (modules.length > 0) {
        setSelectedModule(modules[0]);
      }
    } catch (err) {
      setSourceError(err instanceof Error ? err.message : 'An error occurred');
      setSourceProgress(null);
    } finally {
      setIsLoadingSource(false);
    }
  };

  const handleDownload = async () => {
    if (!result) return;

    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(result),
      });

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${result.packageName}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    }
  };

  const handleDownloadSource = async () => {
    if (!sourceResult) return;

    try {
      const response = await fetch('/api/source/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sourceResult),
      });

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `source-${sourceResult.packageId.slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setSourceError(err instanceof Error ? err.message : 'Download failed');
    }
  };

  const handleDecompile = async () => {
    if (!sourceResult) return;

    setIsDecompiling(true);
    setDecompileError(null);

    try {
      const response = await fetch('/api/source/decompile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ modules: sourceResult.modules }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Decompilation failed');
      }

      const data = await response.json();
      setDecompiledResult(data);
      setSourceViewMode('decompiled');
    } catch (err) {
      setDecompileError(err instanceof Error ? err.message : 'Decompilation failed');
    } finally {
      setIsDecompiling(false);
    }
  };

  const handleDownloadDecompiled = async () => {
    if (!sourceResult || !decompiledResult) return;

    try {
      const response = await fetch('/api/source/decompile/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          packageId: sourceResult.packageId,
          decompiled: decompiledResult.decompiled,
          decompileAt: decompiledResult.decompileAt,
        }),
      });

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `decompiled-${sourceResult.packageId.slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setDecompileError(err instanceof Error ? err.message : 'Download failed');
    }
  };

  const handlePresetClick = (preset: typeof PROTOCOL_PRESETS[0]) => {
    if (activeTab === 'generate') {
      setInput(`${preset.packageId}::${preset.modules[0]}`);
    } else {
      setSourceInput(preset.packageId);
    }
  };

  // Toast state
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });

  const showToast = useCallback((message: string) => {
    setToast({ message, visible: true });
  }, []);

  const hideToast = useCallback(() => {
    setToast(prev => ({ ...prev, visible: false }));
  }, []);

  const copyToClipboard = useCallback(async (text: string) => {
    if (!text) {
      console.error('No text to copy');
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      showToast('Copied to clipboard!');
    } catch (err) {
      console.error('Clipboard API failed, using fallback:', err);
      // Fallback for older browsers or non-HTTPS
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (successful) {
          showToast('Copied to clipboard!');
        } else {
          showToast('Failed to copy');
        }
      } catch (fallbackErr) {
        console.error('Fallback copy failed:', fallbackErr);
        showToast('Failed to copy');
      }
    }
  }, [showToast]);

  return (
    <div className="container mx-auto px-6 py-12">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-3">Generate Skill</h1>
          <p className="text-muted-foreground text-lg">
            Transform any Sui Move contract into a Claude-ready skill document.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-2 mb-8">
          <button
            onClick={() => setActiveTab('generate')}
            className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 flex items-center gap-2 ${
              activeTab === 'generate'
                ? 'bg-primary text-primary-foreground shadow-glow-sm'
                : 'glass-panel hover:border-white/20'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Generate Skill
          </button>
          <button
            onClick={() => setActiveTab('source')}
            className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 flex items-center gap-2 ${
              activeTab === 'source'
                ? 'bg-primary text-primary-foreground shadow-glow-sm'
                : 'glass-panel hover:border-white/20'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            Source Code
          </button>
        </div>

        {/* Generate Tab */}
        {activeTab === 'generate' && (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left Column - Input */}
            <div className="lg:col-span-2 space-y-6">
              {/* Contract Input */}
              <div className="glass-panel rounded-2xl p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center">1</span>
                  Enter Contract
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-muted-foreground mb-2">
                      Package ID or Package::Module
                    </label>
                    <input
                      type="text"
                      placeholder="0x2::coin or 0xdee9::clob_v2"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-foreground placeholder:text-muted-foreground/50 input-glow focus:outline-none"
                    />
                  </div>

                  {/* Quick Presets */}
                  <div>
                    <label className="block text-sm text-muted-foreground mb-2">Quick Select</label>
                    <div className="flex flex-wrap gap-2">
                      {PROTOCOL_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          onClick={() => handlePresetClick(preset)}
                          className="px-3 py-1.5 rounded-full text-sm border border-white/10 hover:border-primary/50 hover:bg-primary/10 transition-all duration-300"
                        >
                          {preset.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Network Select */}
                  <div>
                    <label className="block text-sm text-muted-foreground mb-2">Network</label>
                    <div className="flex gap-2">
                      {(['mainnet', 'testnet', 'devnet'] as Network[]).map((n) => (
                        <button
                          key={n}
                          onClick={() => setNetwork(n)}
                          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                            network === n
                              ? 'bg-primary text-primary-foreground shadow-glow-sm'
                              : 'bg-white/5 border border-white/10 hover:border-white/20'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Scene Selection */}
              <div className="glass-panel rounded-2xl p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center">2</span>
                  Select Scene
                </h2>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {(Object.entries(SCENES) as [SkillScene, typeof SCENES[SkillScene]][]).map(
                    ([id, config]) => (
                      <button
                        key={id}
                        onClick={() => setScene(id)}
                        className={`scene-card text-left ${scene === id ? 'active' : ''}`}
                      >
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${config.color} flex items-center justify-center mb-3`}>
                          <span className="text-xl">{config.icon}</span>
                        </div>
                        <div className="font-medium text-sm mb-1">{config.name}</div>
                        <div className="text-xs text-muted-foreground line-clamp-2">
                          {config.description}
                        </div>
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Progress Display */}
              {isLoading && progress && (
                <div className="glass-panel rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <svg className="w-5 h-5 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Generating...
                    </h2>
                    <span className="text-xs text-muted-foreground">
                      Elapsed: {((Date.now() - progress.startTime.getTime()) / 1000).toFixed(1)}s
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-6">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-muted-foreground">{progress.message}</span>
                      <span className="text-primary font-mono">{Math.round(progress.progress)}%</span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-300 rounded-full"
                        style={{ width: `${progress.progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Step Progress Grid */}
                  <div className="grid grid-cols-11 gap-1 mb-6">
                    {PROGRESS_STEPS.map((step, index) => {
                      const currentIndex = getCurrentStepIndex();
                      const isComplete = index < currentIndex;
                      const isCurrent = index === currentIndex;

                      return (
                        <div
                          key={step.id}
                          className={`h-1.5 rounded-full transition-all duration-300 ${
                            isComplete ? 'bg-success' :
                            isCurrent ? 'bg-primary animate-pulse' :
                            'bg-white/10'
                          }`}
                          title={step.label}
                        />
                      );
                    })}
                  </div>

                  {/* Detailed Progress Log */}
                  <div className="border border-white/5 rounded-xl overflow-hidden">
                    <div className="bg-white/[0.02] px-4 py-2 border-b border-white/5 flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Progress Log</span>
                      <span className="text-xs text-muted-foreground font-mono">
                        {progress.logs.filter(l => l.status === 'completed').length}/{PROGRESS_STEPS.length} steps
                      </span>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {progress.logs.map((log, index) => {
                        const step = PROGRESS_STEPS.find(s => s.id === log.step);
                        return (
                          <div
                            key={`${log.step}-${index}`}
                            className={`flex items-center gap-3 px-4 py-2 border-b border-white/5 last:border-0 transition-all duration-300 ${
                              log.status === 'running' ? 'bg-primary/5' :
                              log.status === 'error' ? 'bg-destructive/10' :
                              ''
                            }`}
                          >
                            {/* Status Icon */}
                            <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
                              log.status === 'completed' ? 'bg-success/20 text-success' :
                              log.status === 'running' ? 'bg-primary/20 text-primary' :
                              log.status === 'error' ? 'bg-destructive/20 text-destructive' :
                              'bg-white/5 text-muted-foreground'
                            }`}>
                              {log.status === 'completed' && (
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                              {log.status === 'running' && (
                                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                              )}
                              {log.status === 'error' && (
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              )}
                              {log.status === 'pending' && (
                                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-30" />
                              )}
                            </div>

                            {/* Step Icon & Name */}
                            <span className="text-sm flex-shrink-0">{step?.icon}</span>
                            <span className={`text-xs font-medium flex-shrink-0 w-24 ${
                              log.status === 'completed' ? 'text-success' :
                              log.status === 'running' ? 'text-primary' :
                              log.status === 'error' ? 'text-destructive' :
                              'text-muted-foreground'
                            }`}>
                              {step?.label}
                            </span>

                            {/* Message */}
                            <span className={`text-xs flex-1 truncate ${
                              log.status === 'error' ? 'text-destructive' : 'text-muted-foreground'
                            }`}>
                              {log.message}
                            </span>

                            {/* Timestamp */}
                            <span className="text-xs text-muted-foreground/50 font-mono flex-shrink-0">
                              {log.timestamp.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Error Display */}
              {error && (
                <div className="glass-panel rounded-xl p-4 border-destructive/50 bg-destructive/10">
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm text-destructive">{error}</span>
                  </div>
                </div>
              )}

              {/* Generate Button */}
              {!isLoading && (
                <button
                  onClick={handleGenerate}
                  disabled={!input.trim()}
                  className={`w-full py-4 rounded-2xl font-semibold text-lg transition-all duration-300 ${
                    !input.trim()
                      ? 'bg-white/5 text-muted-foreground cursor-not-allowed'
                      : 'bg-gradient-to-r from-primary to-accent text-primary-foreground hover:shadow-glow-lg hover:-translate-y-0.5'
                  }`}
                >
                  <span className="flex items-center justify-center gap-2">
                    Generate {SCENES[scene].name} Skill
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </span>
                </button>
              )}
            </div>

            {/* Right Column - Info */}
            <div className="space-y-6">
              {/* Scene Info Card */}
              <div className="glass-panel rounded-2xl p-6">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${SCENES[scene].color} flex items-center justify-center mb-4`}>
                  <span className="text-2xl">{SCENES[scene].icon}</span>
                </div>
                <h3 className="font-semibold mb-2">{SCENES[scene].name}</h3>
                <p className="text-sm text-muted-foreground mb-4">{SCENES[scene].description}</p>
                <div className="pt-4 border-t border-white/5">
                  <div className="text-xs text-muted-foreground mb-2">This scene focuses on:</div>
                  <ul className="text-sm space-y-1">
                    {scene === 'sdk' && (
                      <>
                        <li className="flex items-center gap-2"><span className="text-primary">•</span> Function signatures & types</li>
                        <li className="flex items-center gap-2"><span className="text-primary">•</span> PTB code examples</li>
                        <li className="flex items-center gap-2"><span className="text-primary">•</span> Error handling patterns</li>
                      </>
                    )}
                    {scene === 'audit' && (
                      <>
                        <li className="flex items-center gap-2"><span className="text-destructive">•</span> Permission analysis</li>
                        <li className="flex items-center gap-2"><span className="text-destructive">•</span> Asset flow tracking</li>
                        <li className="flex items-center gap-2"><span className="text-destructive">•</span> Risk classification</li>
                      </>
                    )}
                    {scene === 'learn' && (
                      <>
                        <li className="flex items-center gap-2"><span className="text-purple-400">•</span> Architecture diagrams</li>
                        <li className="flex items-center gap-2"><span className="text-purple-400">•</span> State transitions</li>
                        <li className="flex items-center gap-2"><span className="text-purple-400">•</span> Design patterns</li>
                      </>
                    )}
                    {scene === 'frontend' && (
                      <>
                        <li className="flex items-center gap-2"><span className="text-green-400">•</span> User flow diagrams</li>
                        <li className="flex items-center gap-2"><span className="text-green-400">•</span> Data queries</li>
                        <li className="flex items-center gap-2"><span className="text-green-400">•</span> Event subscriptions</li>
                      </>
                    )}
                    {scene === 'bot' && (
                      <>
                        <li className="flex items-center gap-2"><span className="text-yellow-400">•</span> Entry point analysis</li>
                        <li className="flex items-center gap-2"><span className="text-yellow-400">•</span> Gas optimization</li>
                        <li className="flex items-center gap-2"><span className="text-yellow-400">•</span> Batch operations</li>
                      </>
                    )}
                    {scene === 'docs' && (
                      <>
                        <li className="flex items-center gap-2"><span className="text-cyan-400">•</span> API reference</li>
                        <li className="flex items-center gap-2"><span className="text-cyan-400">•</span> Terminology glossary</li>
                        <li className="flex items-center gap-2"><span className="text-cyan-400">•</span> Usage examples</li>
                      </>
                    )}
                  </ul>
                </div>
              </div>

              {/* Tips */}
              <div className="glass-panel rounded-2xl p-6">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Tips
                </h3>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>• Use <code className="px-1.5 py-0.5 rounded bg-white/5 text-xs">package::module</code> for specific modules</li>
                  <li>• Just package ID fetches all modules</li>
                  <li>• Try different scenes for different needs</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Source Code Tab */}
        {activeTab === 'source' && (
          <div className="space-y-6">
            {/* Input Section */}
            <div className="glass-panel rounded-2xl p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                Fetch Contract Source Code
              </h2>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-muted-foreground mb-2">
                      Package ID
                    </label>
                    <input
                      type="text"
                      placeholder="0x2 or 0xdee9"
                      value={sourceInput}
                      onChange={(e) => setSourceInput(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-foreground placeholder:text-muted-foreground/50 input-glow focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-muted-foreground mb-2">Quick Select</label>
                    <div className="flex flex-wrap gap-2">
                      {PROTOCOL_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          onClick={() => handlePresetClick(preset)}
                          className="px-3 py-1.5 rounded-full text-sm border border-white/10 hover:border-primary/50 hover:bg-primary/10 transition-all duration-300"
                        >
                          {preset.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-muted-foreground mb-2">Network</label>
                    <div className="flex gap-2">
                      {(['mainnet', 'testnet', 'devnet'] as Network[]).map((n) => (
                        <button
                          key={n}
                          onClick={() => setSourceNetwork(n)}
                          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                            sourceNetwork === n
                              ? 'bg-primary text-primary-foreground shadow-glow-sm'
                              : 'bg-white/5 border border-white/10 hover:border-white/20'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleFetchSource}
                    disabled={isLoadingSource || !sourceInput.trim()}
                    className={`w-full py-3 rounded-xl font-semibold transition-all duration-300 ${
                      isLoadingSource || !sourceInput.trim()
                        ? 'bg-white/5 text-muted-foreground cursor-not-allowed'
                        : 'bg-gradient-to-r from-primary to-accent text-primary-foreground hover:shadow-glow-sm'
                    }`}
                  >
                    {isLoadingSource ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Fetching...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        Fetch Source Code
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Source Progress */}
              {isLoadingSource && sourceProgress && (
                <div className="mt-6 pt-6 border-t border-white/5">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">{sourceProgress.message}</span>
                    <span className="text-primary">{Math.round(sourceProgress.progress)}%</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500 rounded-full"
                      style={{ width: `${sourceProgress.progress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Source Error */}
            {sourceError && (
              <div className="glass-panel rounded-xl p-4 border-destructive/50 bg-destructive/10">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm text-destructive">{sourceError}</span>
                </div>
              </div>
            )}

            {/* Source Result */}
            {sourceResult && (
              <div className="glass-panel rounded-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/5">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center ${
                      sourceViewMode === 'decompiled'
                        ? 'from-purple-500/20 to-purple-500/5'
                        : 'from-green-500/20 to-green-500/5'
                    }`}>
                      <svg className={`w-6 h-6 ${sourceViewMode === 'decompiled' ? 'text-purple-400' : 'text-green-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">
                        {sourceViewMode === 'decompiled' ? 'Decompiled Source' : 'Disassembled Bytecode'}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {sourceResult.packageId.slice(0, 16)}... • {Object.keys(sourceResult.modules).length} module(s)
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {/* View Mode Toggle */}
                    <div className="flex rounded-xl border border-white/10 p-1">
                      <button
                        onClick={() => setSourceViewMode('disassembled')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-300 ${
                          sourceViewMode === 'disassembled'
                            ? 'bg-green-500/20 text-green-300'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Bytecode
                      </button>
                      <button
                        onClick={() => {
                          if (!decompiledResult) {
                            handleDecompile();
                          } else {
                            setSourceViewMode('decompiled');
                          }
                        }}
                        disabled={isDecompiling}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-300 flex items-center gap-1.5 ${
                          sourceViewMode === 'decompiled'
                            ? 'bg-purple-500/20 text-purple-300'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {isDecompiling && (
                          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        )}
                        Decompiled
                      </button>
                    </div>

                    {/* External Decompiler Link */}
                    <a
                      href={`https://revela.verichains.io/sui/${sourceResult.packageId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-xl text-xs border border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 hover:border-purple-500/50 transition-all duration-300 flex items-center gap-1.5"
                      title="Open in Revela for advanced decompilation"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      Revela
                    </a>

                    {/* Download Button */}
                    <button
                      onClick={sourceViewMode === 'decompiled' ? handleDownloadDecompiled : handleDownloadSource}
                      className="px-4 py-2 rounded-xl text-sm bg-primary text-primary-foreground hover:shadow-glow-sm transition-all duration-300 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download
                    </button>
                  </div>
                </div>

                {/* Decompile Error */}
                {decompileError && (
                  <div className="mx-6 mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                    <div className="flex items-center gap-2 text-sm text-destructive">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {decompileError}
                    </div>
                  </div>
                )}

                {/* Module Tabs */}
                <div className="border-b border-white/5 px-6 overflow-x-auto">
                  <div className="flex gap-1 py-2">
                    {Object.keys(sourceResult.modules).map((moduleName) => (
                      <button
                        key={moduleName}
                        onClick={() => setSelectedModule(moduleName)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-300 ${
                          selectedModule === moduleName
                            ? sourceViewMode === 'decompiled'
                              ? 'bg-purple-500/20 text-purple-300'
                              : 'bg-primary/20 text-primary'
                            : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                        }`}
                      >
                        {moduleName}.move
                        {decompiledResult?.errors?.[moduleName] && (
                          <span className="ml-1.5 text-yellow-400" title="Decompilation had issues">⚠</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Code Preview */}
                <div className="p-6">
                  {selectedModule && (
                    <div>
                      {/* Code Header with Copy Button */}
                      <div className="flex items-center justify-between mb-3">
                        <span className={`px-2 py-1 rounded text-xs ${
                          sourceViewMode === 'decompiled'
                            ? 'bg-purple-500/20 text-purple-300'
                            : 'bg-green-500/20 text-green-300'
                        }`}>
                          {sourceViewMode === 'decompiled' ? '✨ Decompiled' : '📦 Bytecode'}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const text = sourceViewMode === 'decompiled' && decompiledResult
                              ? decompiledResult.decompiled[selectedModule]
                              : sourceResult?.modules[selectedModule];
                            if (text) {
                              copyToClipboard(text);
                            }
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs bg-white/10 hover:bg-white/20 hover:scale-105 active:scale-95 transition-all duration-200 flex items-center gap-1.5 cursor-pointer"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          Copy
                        </button>
                      </div>
                      <div className="code-block max-h-[500px] overflow-auto">
                        <pre className={`text-sm ${
                          sourceViewMode === 'decompiled' ? 'text-purple-300/90' : 'text-green-300/90'
                        }`}>
                          <code>
                            {sourceViewMode === 'decompiled' && decompiledResult
                              ? decompiledResult.decompiled[selectedModule]
                              : sourceResult.modules[selectedModule]}
                          </code>
                        </pre>
                      </div>
                    </div>
                  )}
                </div>

                {/* Stats */}
                <div className="px-6 py-4 border-t border-white/5 bg-white/[0.02]">
                  <div className="flex items-center gap-6 text-sm text-muted-foreground">
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      {Object.keys(sourceResult.modules).length} modules
                    </span>
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {new Date(sourceResult.fetchedAt).toLocaleString()}
                    </span>
                    {selectedModule && (
                      <span className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7c-2 0-3 1-3 3z" />
                        </svg>
                        {(sourceViewMode === 'decompiled' && decompiledResult
                          ? decompiledResult.decompiled[selectedModule]
                          : sourceResult.modules[selectedModule]
                        ).split('\n').length} lines
                      </span>
                    )}
                    {sourceViewMode === 'decompiled' && decompiledResult && (
                      <span className="flex items-center gap-2 text-purple-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Decompiled at {new Date(decompiledResult.decompileAt).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Decompilation Info */}
            {sourceResult && !decompiledResult && (
              <div className="glass-panel rounded-2xl p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                  Need Readable Source Code?
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  The code above is <strong>disassembled bytecode</strong>. Click the <strong>"Decompiled"</strong> button above to convert it to readable Move source, or use external tools for more accurate results:
                </p>

                <div className="flex flex-wrap gap-3 mb-4">
                  <button
                    onClick={handleDecompile}
                    disabled={isDecompiling}
                    className="px-4 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-glow-sm transition-all duration-300 flex items-center gap-2"
                  >
                    {isDecompiling ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Decompiling...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                        Decompile Now
                      </>
                    )}
                  </button>

                  <a
                    href={`https://revela.verichains.io/sui/${sourceResult.packageId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2.5 rounded-xl text-sm font-medium border border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 hover:border-purple-500/50 transition-all duration-300 flex items-center gap-2"
                  >
                    <span>🔬</span>
                    Revela (Advanced)
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>

                  <a
                    href="https://suigpt.tools/decompiler"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2.5 rounded-xl text-sm font-medium border border-blue-500/30 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 hover:border-blue-500/50 transition-all duration-300 flex items-center gap-2"
                  >
                    <span>🤖</span>
                    SuiGPT MAD
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>

                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="text-xs text-blue-200/80">
                      <p className="mb-1">
                        <strong>智能反编译:</strong> 我们使用类型推断和语义分析来生成可读的变量名（如 <code className="bg-white/10 px-1 rounded">Coin&lt;SUI&gt;</code> → <code className="bg-white/10 px-1 rounded">sui_coin</code>）。
                      </p>
                      <p>
                        原始注释在编译时已丢失。如需更精确的反编译，推荐使用 <strong>Revela</strong>。
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Decompilation Success Info */}
            {sourceResult && decompiledResult && (
              <div className="glass-panel rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <svg className="w-5 h-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Decompilation Complete
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {new Date(decompiledResult.decompileAt).toLocaleString()}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="p-3 rounded-lg bg-white/5 text-center">
                    <div className="text-2xl font-bold text-primary">{Object.keys(decompiledResult.decompiled).length}</div>
                    <div className="text-xs text-muted-foreground">Modules</div>
                  </div>
                  <div className="p-3 rounded-lg bg-white/5 text-center">
                    <div className="text-2xl font-bold text-success">
                      {Object.keys(decompiledResult.decompiled).length - (decompiledResult.errors ? Object.keys(decompiledResult.errors).length : 0)}
                    </div>
                    <div className="text-xs text-muted-foreground">Success</div>
                  </div>
                  <div className="p-3 rounded-lg bg-white/5 text-center">
                    <div className="text-2xl font-bold text-yellow-400">
                      {decompiledResult.errors ? Object.keys(decompiledResult.errors).length : 0}
                    </div>
                    <div className="text-xs text-muted-foreground">Warnings</div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleDownloadDecompiled}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-glow-sm transition-all duration-300 flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download Decompiled Sources
                  </button>

                  <a
                    href={`https://revela.verichains.io/sui/${sourceResult.packageId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2.5 rounded-xl text-sm font-medium border border-white/10 hover:border-white/20 transition-all duration-300 flex items-center gap-2"
                  >
                    Compare with Revela
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Generate Result */}
        {activeTab === 'generate' && result && (
          <div className="mt-8 glass-panel rounded-2xl overflow-hidden">
            {/* Result Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${SCENES[scene].color} flex items-center justify-center`}>
                  <span className="text-2xl">{SCENES[scene].icon}</span>
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{result.packageName}</h3>
                  <p className="text-sm text-muted-foreground">
                    {result.metadata.packageId.slice(0, 10)}... on {result.metadata.network}
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => copyToClipboard(result.skillMd)}
                  className="px-4 py-2 rounded-xl text-sm border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all duration-300 flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy
                </button>
                <button
                  onClick={handleDownload}
                  className="px-4 py-2 rounded-xl text-sm bg-primary text-primary-foreground hover:shadow-glow-sm transition-all duration-300"
                >
                  Download ZIP
                </button>
              </div>
            </div>

            {/* Result Content */}
            <div className="p-6">
              <div className="code-block max-h-[600px] overflow-auto">
                <pre className="text-sm whitespace-pre-wrap">{result.skillMd}</pre>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Toast Notification */}
      <Toast message={toast.message} isVisible={toast.visible} onClose={hideToast} />
    </div>
  );
}
