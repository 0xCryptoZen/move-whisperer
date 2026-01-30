'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLocalServer } from '../../hooks/useLocalServer';
import ReviewPanel from './components/ReviewPanel';

// Toast notification component
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
        <div className="w-7 h-7 rounded-full bg-white/25 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <span className="font-semibold text-sm tracking-wide">{message}</span>
      </div>
    </div>
  );
}

type Network = 'mainnet' | 'testnet' | 'devnet';
type PredefinedScene = 'sdk' | 'learn' | 'audit' | 'frontend' | 'bot' | 'docs';
type SkillScene = PredefinedScene | 'custom';

// Workflow stages
type WorkflowStage = 'idle' | 'fetching' | 'decompiling' | 'analyzing' | 'reviewing' | 'generating' | 'complete' | 'error';

interface CustomSceneConfig {
  name: string;
  description: string;
  focusAreas: string[];
}

// Contract Analysis types
interface ContractAnalysis {
  purpose: {
    summary: string;
    category: string;
    protocols: string[];
  };
  functions: Array<{
    name: string;
    purpose: string;
    category: 'admin' | 'user' | 'query' | 'internal';
    risk: 'high' | 'medium' | 'low';
  }>;
  types: Array<{
    name: string;
    purpose: string;
    isCapability: boolean;
    isSharedObject: boolean;
  }>;
  generics: {
    mapping: Record<string, { name: string; description: string; commonTypes: string[] }>;
    confidence: number;
  };
  errorCodes: Array<{
    name: string;
    code: number;
    description: string;
    possibleCauses: string[];
    solutions: string[];
    category: 'permission' | 'validation' | 'state' | 'math' | 'other';
  }>;
  security: {
    riskLevel: 'high' | 'medium' | 'low';
    concerns: string[];
    adminFunctions: string[];
  };
  suggestedName: string;
  confidence: number;
  fallbackUsed: boolean;
  analysisSource: 'claude' | 'regex' | 'hybrid';
}

interface UserFeedback {
  purpose: { confirmed: boolean; correction?: string; category?: string };
  generics: { confirmed: boolean; corrections?: Record<string, { name: string; description: string; commonTypes: string[] }> };
  adminFunctions: { highlightRisks: boolean; addPermissionDocs: boolean };
  errorCodes: { generateErrorsMd: boolean; includeInSkillMd: boolean };
  businessContext: string;
}

// Scene configuration
const PREDEFINED_SCENES: Record<PredefinedScene, { name: string; nameZh: string; icon: string; description: string; color: string }> = {
  sdk: { name: 'SDK Integration', nameZh: 'SDK 集成', icon: '🔌', description: 'Function signatures, code examples, PTB patterns', color: 'from-blue-500/20 to-blue-500/5' },
  learn: { name: 'Protocol Learning', nameZh: '原理学习', icon: '📚', description: 'Architecture, concepts, state transitions', color: 'from-purple-500/20 to-purple-500/5' },
  audit: { name: 'Security Audit', nameZh: '安全审计', icon: '🔒', description: 'Permission model, asset flows, risk analysis', color: 'from-red-500/20 to-red-500/5' },
  frontend: { name: 'Frontend Dev', nameZh: '前端开发', icon: '🖥️', description: 'User flows, data queries, event handling', color: 'from-green-500/20 to-green-500/5' },
  bot: { name: 'Trading Bot', nameZh: '交易机器人', icon: '🤖', description: 'Entry functions, gas optimization, monitoring', color: 'from-yellow-500/20 to-yellow-500/5' },
  docs: { name: 'Documentation', nameZh: '文档生成', icon: '📝', description: 'API reference, terminology, FAQ', color: 'from-cyan-500/20 to-cyan-500/5' },
};

const CUSTOM_SCENE_CONFIG = { name: 'Custom Scene', nameZh: '自定义场景', icon: '✨', description: 'Define your own focus areas', color: 'from-pink-500/20 to-pink-500/5' };
const SCENES: Record<SkillScene, typeof CUSTOM_SCENE_CONFIG> = { ...PREDEFINED_SCENES, custom: CUSTOM_SCENE_CONFIG };

const PROTOCOL_PRESETS = [
  { id: 'deepbook', name: 'DeepBook', packageId: '0xdee9', modules: ['clob_v2'] },
  { id: 'sui', name: 'Sui Framework', packageId: '0x2', modules: ['coin', 'transfer'] },
];

interface GenerateResult {
  skillMd: string;
  packageName: string;
  metadata: { packageId: string; modules: string[]; network: string };
}

interface IntermediateArtifacts {
  sourceCode?: string;
  decompiledCode?: string;
  moduleName?: string;
  packageId?: string;
}

export default function GeneratePage() {
  // Basic state
  const [input, setInput] = useState('');
  const [network, setNetwork] = useState<Network>('mainnet');
  const [scene, setScene] = useState<SkillScene>('sdk');
  const [customScene, setCustomScene] = useState<CustomSceneConfig>({ name: '', description: '', focusAreas: [] });
  const [customFocusInput, setCustomFocusInput] = useState('');
  const [enableAIAnalysis, setEnableAIAnalysis] = useState(true);

  // Workflow state
  const [workflowStage, setWorkflowStage] = useState<WorkflowStage>('idle');
  const [stageMessage, setStageMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Intermediate artifacts
  const [artifacts, setArtifacts] = useState<IntermediateArtifacts>({});
  const [analysis, setAnalysis] = useState<ContractAnalysis | null>(null);
  const [result, setResult] = useState<GenerateResult | null>(null);

  // Artifact view state
  const [activeArtifactTab, setActiveArtifactTab] = useState<'source' | 'decompiled' | 'analysis'>('source');

  // Local server
  const { isConnected: isLocalServerConnected, health: localServerHealth, decompile: localServerDecompile } = useLocalServer({ autoConnect: true });
  const hasMoveDecompiler = localServerHealth?.tools.some(t => t.name === 'move-decompiler' && t.available) ?? false;

  // Toast
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });
  const showToast = useCallback((message: string) => setToast({ message, visible: true }), []);
  const hideToast = useCallback(() => setToast(prev => ({ ...prev, visible: false })), []);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast('Copied to clipboard!');
    } catch {
      showToast('Failed to copy');
    }
  }, [showToast]);

  // Main generation workflow
  const handleGenerate = async () => {
    if (!input.trim()) {
      setError('Please enter a package ID or package::module');
      return;
    }

    setError(null);
    setResult(null);
    setAnalysis(null);
    setArtifacts({});

    const parts = input.trim().split('::');
    const packageId = parts[0];
    const moduleName = parts[1];

    try {
      // Stage 1: Fetch source code
      setWorkflowStage('fetching');
      setStageMessage('Fetching source code from chain...');

      const sourceResponse = await fetch('/api/source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: input.trim(), network }),
      });

      if (!sourceResponse.ok) {
        const data = await sourceResponse.json();
        throw new Error(data.error || 'Failed to fetch source');
      }

      const sourceData = await sourceResponse.json();
      const modules = Object.keys(sourceData.modules);
      const targetModule = moduleName || modules[0];
      const sourceCode = sourceData.modules[targetModule];

      setArtifacts(prev => ({
        ...prev,
        sourceCode,
        moduleName: targetModule,
        packageId: sourceData.packageId,
      }));

      // Stage 2: Decompile (if local server available)
      let decompiledCode: string | undefined;
      if (isLocalServerConnected && hasMoveDecompiler && sourceData.bytecode) {
        setWorkflowStage('decompiling');
        setStageMessage('Decompiling bytecode with Revela...');

        try {
          const decompileResult = await localServerDecompile(packageId, {
            bytecode: sourceData.bytecode,
          });

          if (decompileResult.success && decompileResult.output) {
            // Parse decompiled output
            const parts = decompileResult.output.split(/\/\/ ===== Module: (\S+) =====\n*/);
            decompiledCode = decompileResult.output;
            for (let i = 1; i < parts.length; i += 2) {
              if (parts[i] === targetModule) {
                decompiledCode = parts[i + 1]?.trim() || decompileResult.output;
                break;
              }
            }
            setArtifacts(prev => ({ ...prev, decompiledCode }));
          }
        } catch (e) {
          console.error('Decompilation failed:', e);
          // Continue without decompiled code
        }
      }

      // Stage 3: AI Analysis (if enabled)
      // Use decompiled code for analysis (better for regex extraction), fallback to disassembled
      const codeForAnalysis = decompiledCode || sourceCode;
      if (enableAIAnalysis) {
        setWorkflowStage('analyzing');
        setStageMessage('AI analyzing contract...');

        const analyzeResponse = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            packageId,
            network,
            moduleName: targetModule,
            sourceCode: codeForAnalysis,
          }),
        });

        if (analyzeResponse.ok) {
          const analyzeData = await analyzeResponse.json();
          setAnalysis(analyzeData.analysis);

          // Stage 4: Wait for user review
          setWorkflowStage('reviewing');
          setStageMessage('Please review and confirm the analysis');
          return; // Wait for user to confirm
        } else {
          console.error('Analysis failed, proceeding without AI analysis');
        }
      }

      // Skip to generation if AI analysis disabled or failed
      await generateSkill();

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setWorkflowStage('error');
    }
  };

  // Handle user confirmation from ReviewPanel
  const handleReviewConfirm = async (feedback: UserFeedback) => {
    try {
      setWorkflowStage('generating');
      setStageMessage('Generating skill with your feedback...');

      // Merge analysis with feedback
      const reviewResponse = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysisId: `${artifacts.packageId}-${Date.now()}`,
          analysis,
          feedback,
        }),
      });

      if (!reviewResponse.ok) {
        throw new Error('Failed to process review');
      }

      await generateSkill(feedback);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
      setWorkflowStage('error');
    }
  };

  // Cancel review and go back
  const handleReviewCancel = () => {
    setWorkflowStage('idle');
    setAnalysis(null);
  };

  // Generate the skill
  const generateSkill = async (feedback?: UserFeedback) => {
    setWorkflowStage('generating');
    setStageMessage('Generating SKILL.md...');

    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: input.trim(),
        network,
        scene,
        customScene: scene === 'custom' ? customScene : undefined,
        analysis,
        feedback,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Generation failed');
    }

    const data = await response.json();
    setResult(data);
    setWorkflowStage('complete');
    setStageMessage('Generation complete!');
  };

  const handleDownload = async () => {
    if (!result) return;
    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result),
      });
      if (!response.ok) throw new Error('Download failed');
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

  const resetWorkflow = () => {
    setWorkflowStage('idle');
    setError(null);
    setResult(null);
    setAnalysis(null);
    setArtifacts({});
  };

  const isWorking = ['fetching', 'decompiling', 'analyzing', 'generating'].includes(workflowStage);

  return (
    <div className="container mx-auto px-6 py-12">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-3">Generate Skill</h1>
          <p className="text-muted-foreground text-lg">
            Transform any Sui Move contract into a Claude-ready skill document.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Input & Controls */}
          <div className="lg:col-span-2 space-y-6">
            {/* Contract Input */}
            <div className="glass-panel rounded-2xl p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center">1</span>
                Enter Contract
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-muted-foreground mb-2">Package ID or Package::Module</label>
                  <input
                    type="text"
                    placeholder="0x2::coin or 0xdee9::clob_v2"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={isWorking}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-foreground placeholder:text-muted-foreground/50 input-glow focus:outline-none disabled:opacity-50"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  {PROTOCOL_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => setInput(`${preset.packageId}::${preset.modules[0]}`)}
                      disabled={isWorking}
                      className="px-3 py-1.5 rounded-full text-sm border border-white/10 hover:border-primary/50 hover:bg-primary/10 transition-all duration-300 disabled:opacity-50"
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>

                <div className="flex gap-2">
                  {(['mainnet', 'testnet', 'devnet'] as Network[]).map((n) => (
                    <button
                      key={n}
                      onClick={() => setNetwork(n)}
                      disabled={isWorking}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                        network === n ? 'bg-primary text-primary-foreground shadow-glow-sm' : 'bg-white/5 border border-white/10 hover:border-white/20'
                      } disabled:opacity-50`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Scene Selection */}
            <div className="glass-panel rounded-2xl p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center">2</span>
                Select Scene
              </h2>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {(Object.entries(SCENES) as [SkillScene, typeof CUSTOM_SCENE_CONFIG][]).map(([id, config]) => (
                  <button
                    key={id}
                    onClick={() => setScene(id)}
                    disabled={isWorking}
                    className={`scene-card text-left ${scene === id ? 'active' : ''} ${id === 'custom' ? 'border-dashed' : ''} disabled:opacity-50`}
                  >
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${config.color} flex items-center justify-center mb-3`}>
                      <span className="text-xl">{config.icon}</span>
                    </div>
                    <div className="font-medium text-sm mb-1">{config.name}</div>
                    <div className="text-xs text-muted-foreground line-clamp-2">{config.description}</div>
                  </button>
                ))}
              </div>

              {scene === 'custom' && (
                <div className="mt-4 p-4 border border-dashed border-white/20 rounded-xl bg-white/[0.02] space-y-4">
                  <input
                    type="text"
                    value={customScene.name}
                    onChange={(e) => setCustomScene(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Scene Name"
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-primary/50"
                  />
                  <textarea
                    value={customScene.description}
                    onChange={(e) => setCustomScene(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Description"
                    rows={2}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-primary/50 resize-none"
                  />
                  <div className="flex flex-wrap gap-2">
                    {customScene.focusAreas.map((area, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1 px-3 py-1 bg-primary/20 text-primary rounded-full text-xs">
                        {area}
                        <button onClick={() => setCustomScene(prev => ({ ...prev, focusAreas: prev.focusAreas.filter((_, i) => i !== idx) }))} className="hover:text-white ml-1">×</button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customFocusInput}
                      onChange={(e) => setCustomFocusInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && customFocusInput.trim()) {
                          setCustomScene(prev => ({ ...prev, focusAreas: [...prev.focusAreas, customFocusInput.trim()] }));
                          setCustomFocusInput('');
                        }
                      }}
                      placeholder="Add focus area (Enter)"
                      className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-primary/50"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* AI Analysis Toggle */}
            <div className="glass-panel rounded-2xl p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/5 flex items-center justify-center">
                    <span className="text-xl">🤖</span>
                  </div>
                  <div>
                    <h3 className="font-medium">AI-Enhanced Analysis</h3>
                    <p className="text-xs text-muted-foreground">
                      Use Claude to analyze contract purpose, generics, and error codes
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setEnableAIAnalysis(!enableAIAnalysis)}
                  disabled={isWorking}
                  className={`relative w-14 h-7 rounded-full transition-all duration-300 ${enableAIAnalysis ? 'bg-green-500' : 'bg-white/20'} disabled:opacity-50`}
                >
                  <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all duration-300 ${enableAIAnalysis ? 'left-8' : 'left-1'}`} />
                </button>
              </div>
              {enableAIAnalysis && (
                <div className="mt-4 flex items-center gap-2 text-xs">
                  <div className={`w-2 h-2 rounded-full ${isLocalServerConnected ? 'bg-green-400' : 'bg-yellow-400'}`} />
                  <span className="text-muted-foreground">
                    {isLocalServerConnected && hasMoveDecompiler
                      ? 'Local server connected with Revela decompiler'
                      : isLocalServerConnected
                      ? 'Local server connected (basic decompiler)'
                      : 'Local server not connected (using regex fallback)'}
                  </span>
                </div>
              )}
            </div>

            {/* Error Display */}
            {error && (
              <div className="glass-panel rounded-xl p-4 border-destructive/50 bg-destructive/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm text-destructive">{error}</span>
                  </div>
                  <button onClick={resetWorkflow} className="text-xs text-destructive hover:underline">Reset</button>
                </div>
              </div>
            )}

            {/* Progress Display */}
            {isWorking && (
              <div className="glass-panel rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <svg className="w-5 h-5 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <div>
                    <h3 className="font-medium capitalize">{workflowStage}...</h3>
                    <p className="text-sm text-muted-foreground">{stageMessage}</p>
                  </div>
                </div>

                {/* Stage progress bar */}
                <div className="flex gap-1">
                  {['fetching', 'decompiling', 'analyzing', 'reviewing', 'generating'].map((stage, idx) => {
                    const currentIdx = ['fetching', 'decompiling', 'analyzing', 'reviewing', 'generating'].indexOf(workflowStage);
                    const isComplete = idx < currentIdx;
                    const isCurrent = idx === currentIdx;
                    return (
                      <div
                        key={stage}
                        className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${
                          isComplete ? 'bg-green-500' : isCurrent ? 'bg-primary animate-pulse' : 'bg-white/10'
                        }`}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Review Panel */}
            {workflowStage === 'reviewing' && analysis && (
              <ReviewPanel
                analysis={analysis}
                onConfirm={handleReviewConfirm}
                onCancel={handleReviewCancel}
              />
            )}

            {/* Generate Button */}
            {workflowStage === 'idle' && (
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
                  {enableAIAnalysis ? 'Analyze & Generate' : 'Generate'} {SCENES[scene].name} Skill
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
              </button>
            )}

            {/* Result Display */}
            {workflowStage === 'complete' && result && (
              <div className="glass-panel rounded-2xl overflow-hidden">
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
                    <button onClick={() => copyToClipboard(result.skillMd)} className="px-4 py-2 rounded-xl text-sm border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all duration-300 flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy
                    </button>
                    <button onClick={handleDownload} className="px-4 py-2 rounded-xl text-sm bg-primary text-primary-foreground hover:shadow-glow-sm transition-all duration-300">
                      Download ZIP
                    </button>
                    <button onClick={resetWorkflow} className="px-4 py-2 rounded-xl text-sm border border-white/10 hover:border-white/20 transition-all">
                      New
                    </button>
                  </div>
                </div>

                <div className="p-6">
                  <div className="code-block max-h-[500px] overflow-auto">
                    <pre className="text-sm whitespace-pre-wrap">{result.skillMd}</pre>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Intermediate Artifacts */}
          <div className="space-y-6">
            {/* Artifacts Panel */}
            {(artifacts.sourceCode || artifacts.decompiledCode || analysis) && (
              <div className="glass-panel rounded-2xl overflow-hidden">
                <div className="border-b border-white/5 p-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Intermediate Artifacts
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {artifacts.moduleName && `Module: ${artifacts.moduleName}`}
                  </p>
                </div>

                {/* Artifact tabs */}
                <div className="flex border-b border-white/5">
                  {artifacts.sourceCode && (
                    <button
                      onClick={() => setActiveArtifactTab('source')}
                      className={`flex-1 px-4 py-2 text-sm font-medium transition-all ${
                        activeArtifactTab === 'source' ? 'bg-blue-500/20 text-blue-400 border-b-2 border-blue-500' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      📦 Bytecode
                    </button>
                  )}
                  {artifacts.decompiledCode && (
                    <button
                      onClick={() => setActiveArtifactTab('decompiled')}
                      className={`flex-1 px-4 py-2 text-sm font-medium transition-all ${
                        activeArtifactTab === 'decompiled' ? 'bg-purple-500/20 text-purple-400 border-b-2 border-purple-500' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      ✨ Decompiled
                    </button>
                  )}
                  {analysis && (
                    <button
                      onClick={() => setActiveArtifactTab('analysis')}
                      className={`flex-1 px-4 py-2 text-sm font-medium transition-all ${
                        activeArtifactTab === 'analysis' ? 'bg-green-500/20 text-green-400 border-b-2 border-green-500' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      🤖 Analysis
                    </button>
                  )}
                </div>

                {/* Artifact content */}
                <div className="p-4">
                  {activeArtifactTab === 'source' && artifacts.sourceCode && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-muted-foreground">Disassembled bytecode</span>
                        <button onClick={() => copyToClipboard(artifacts.sourceCode!)} className="text-xs text-primary hover:underline">Copy</button>
                      </div>
                      <div className="code-block max-h-[400px] overflow-auto">
                        <pre className="text-xs text-blue-300/80">{artifacts.sourceCode.slice(0, 5000)}{artifacts.sourceCode.length > 5000 ? '\n... (truncated)' : ''}</pre>
                      </div>
                    </div>
                  )}

                  {activeArtifactTab === 'decompiled' && artifacts.decompiledCode && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-green-400" />
                          Revela decompiled
                        </span>
                        <button onClick={() => copyToClipboard(artifacts.decompiledCode!)} className="text-xs text-primary hover:underline">Copy</button>
                      </div>
                      <div className="code-block max-h-[400px] overflow-auto">
                        <pre className="text-xs text-purple-300/80">{artifacts.decompiledCode.slice(0, 5000)}{artifacts.decompiledCode.length > 5000 ? '\n... (truncated)' : ''}</pre>
                      </div>
                    </div>
                  )}

                  {activeArtifactTab === 'analysis' && analysis && (
                    <div className="space-y-4">
                      {/* Purpose */}
                      <div>
                        <h4 className="text-sm font-medium mb-1">Purpose</h4>
                        <div className="p-2 rounded-lg bg-white/5">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            analysis.purpose.category === 'dex' ? 'bg-blue-500/20 text-blue-400' :
                            analysis.purpose.category === 'defi' ? 'bg-green-500/20 text-green-400' :
                            'bg-white/10 text-white/70'
                          }`}>
                            {analysis.purpose.category}
                          </span>
                          <p className="text-xs mt-1 text-muted-foreground">{analysis.purpose.summary}</p>
                        </div>
                      </div>

                      {/* Generics */}
                      {Object.keys(analysis.generics.mapping).length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-1">Generics</h4>
                          <div className="space-y-1">
                            {Object.entries(analysis.generics.mapping).map(([key, value]) => (
                              <div key={key} className="flex items-center gap-2 text-xs">
                                <code className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 font-mono">{key}</code>
                                <span className="text-muted-foreground">→</span>
                                <span>{value.name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Error codes */}
                      {analysis.errorCodes.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-1">Error Codes ({analysis.errorCodes.length})</h4>
                          <div className="max-h-24 overflow-y-auto space-y-1">
                            {analysis.errorCodes.slice(0, 5).map(err => (
                              <div key={err.name} className="text-xs flex items-center gap-1">
                                <code className="px-1 py-0.5 rounded bg-yellow-500/10 text-yellow-400 font-mono">{err.name}</code>
                                <span className="text-muted-foreground">({err.code})</span>
                              </div>
                            ))}
                            {analysis.errorCodes.length > 5 && (
                              <span className="text-xs text-muted-foreground">+{analysis.errorCodes.length - 5} more</span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Security */}
                      <div>
                        <h4 className="text-sm font-medium mb-1">Security</h4>
                        <div className={`text-xs px-2 py-1 rounded ${
                          analysis.security.riskLevel === 'high' ? 'bg-red-500/20 text-red-400' :
                          analysis.security.riskLevel === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-green-500/20 text-green-400'
                        }`}>
                          Risk: {analysis.security.riskLevel} • {analysis.security.adminFunctions.length} admin functions
                        </div>
                      </div>

                      {/* Confidence */}
                      <div className="flex items-center justify-between text-xs pt-2 border-t border-white/5">
                        <span className="text-muted-foreground">
                          Source: {analysis.analysisSource === 'claude' ? '🤖 Claude' : analysis.analysisSource === 'hybrid' ? '🔄 Hybrid' : '📝 Regex'}
                        </span>
                        <span className="text-muted-foreground">
                          Confidence: {Math.round(analysis.confidence * 100)}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Scene Info */}
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
                    </>
                  )}
                  {scene === 'audit' && (
                    <>
                      <li className="flex items-center gap-2"><span className="text-destructive">•</span> Permission analysis</li>
                      <li className="flex items-center gap-2"><span className="text-destructive">•</span> Asset flow tracking</li>
                    </>
                  )}
                  {scene === 'learn' && (
                    <>
                      <li className="flex items-center gap-2"><span className="text-purple-400">•</span> Architecture overview</li>
                      <li className="flex items-center gap-2"><span className="text-purple-400">•</span> State transitions</li>
                    </>
                  )}
                  {(scene === 'frontend' || scene === 'bot' || scene === 'docs' || scene === 'custom') && (
                    <li className="flex items-center gap-2"><span className="text-primary">•</span> Scene-specific content</li>
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
                <li>• Enable AI Analysis for better results</li>
                <li>• Run <code className="px-1.5 py-0.5 rounded bg-white/5 text-xs">pnpm server</code> for Revela decompiler</li>
                <li>• Review and correct AI inferences</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <Toast message={toast.message} isVisible={toast.visible} onClose={hideToast} />
    </div>
  );
}
