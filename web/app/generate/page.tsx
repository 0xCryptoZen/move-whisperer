'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocalServer } from '../../hooks/useLocalServer';
import { useTranslation } from '@/lib/i18n';
import { useAuth } from '@/lib/auth/context';
import ReviewPanel from './components/ReviewPanel';
import VersionHistoryPanel from './components/VersionHistoryPanel';
import SourceCodePanel from './components/SourceCodePanel';
import PlaygroundPanel from './components/ContractChatPanel';
import UpgradeNotificationModal from './components/UpgradeNotificationModal';
import MonitorSettingsPanel from './components/MonitorSettingsPanel';
import SkillMarkdownEditor from './components/SkillMarkdownEditor';
import { useUpgradeMonitor } from '../../hooks/useUpgradeMonitor';
import { useMonitorStore, type UpgradeCheckResult } from '../../lib/stores/monitor-store';
import type { PackageVersionHistory, VersionCompareResult } from '../../lib/local-server';

interface SavedSkillItem {
  id: string;
  title: string;
  packageId: string;
  moduleName: string | null;
  network: string;
  scene: string;
  createdAt: number;
  updatedAt: number;
}

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
      <div className="flex items-center gap-3 px-5 py-3.5 rounded text-[var(--neon-green)] backdrop-blur-md border border-[rgba(var(--neon-green-rgb),0.3)] overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(57, 255, 20, 0.12) 0%, rgba(57, 255, 20, 0.06) 100%)',
          boxShadow: '0 10px 40px -10px rgba(57, 255, 20, 0.3), 0 0 20px rgba(57, 255, 20, 0.15), inset 0 1px 0 rgba(57, 255, 20, 0.1)'
        }}
      >
        <div className="w-7 h-7 rounded border border-[rgba(var(--neon-green-rgb),0.3)] bg-[rgba(var(--neon-green-rgb),0.15)] flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <span className="font-mono-cyber text-sm tracking-wide">{message}</span>
      </div>
    </div>
  );
}

type Network = 'mainnet' | 'testnet' | 'devnet';
type PredefinedScene = 'sdk' | 'learn' | 'audit' | 'frontend' | 'bot' | 'docs';
type SkillScene = PredefinedScene | 'custom';
type WorkflowStage = 'idle' | 'fetching' | 'decompiling' | 'analyzing' | 'reviewing' | 'generating' | 'complete' | 'error';

interface CustomSceneConfig {
  name: string;
  description: string;
  focusAreas: string[];
}

interface ContractAnalysis {
  purpose: { summary: string; category: string; protocols: string[] };
  functions: Array<{ name: string; purpose: string; category: 'admin' | 'user' | 'query' | 'internal'; risk: 'high' | 'medium' | 'low' }>;
  types: Array<{ name: string; purpose: string; isCapability: boolean; isSharedObject: boolean }>;
  generics: { mapping: Record<string, { name: string; description: string; commonTypes: string[] }>; confidence: number };
  errorCodes: Array<{ name: string; code: number; description: string; possibleCauses: string[]; solutions: string[]; category: 'permission' | 'validation' | 'state' | 'math' | 'other' }>;
  security: { riskLevel: 'high' | 'medium' | 'low'; concerns: string[]; adminFunctions: string[] };
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

const PREDEFINED_SCENES: Record<PredefinedScene, { name: string; nameZh: string; icon: string; description: string; color: string }> = {
  sdk: { name: 'SDK Integration', nameZh: 'SDK 集成', icon: 'S', description: 'Function signatures, code examples, PTB patterns', color: 'cyan' },
  learn: { name: 'Protocol Learning', nameZh: '原理学习', icon: 'L', description: 'Architecture, concepts, state transitions', color: 'purple' },
  audit: { name: 'Security Audit', nameZh: '安全审计', icon: 'A', description: 'Permission model, asset flows, risk analysis', color: 'red' },
  frontend: { name: 'Frontend Dev', nameZh: '前端开发', icon: 'F', description: 'User flows, data queries, event handling', color: 'green' },
  bot: { name: 'Trading Bot', nameZh: '交易机器人', icon: 'B', description: 'Entry functions, gas optimization, monitoring', color: 'amber' },
  docs: { name: 'Documentation', nameZh: '文档生成', icon: 'D', description: 'API reference, terminology, FAQ', color: 'magenta' },
};

const CUSTOM_SCENE_CONFIG = { name: 'Custom Scene', nameZh: '自定义场景', icon: '+', description: 'Define your own focus areas', color: 'purple' };
const SCENES: Record<SkillScene, typeof CUSTOM_SCENE_CONFIG> = { ...PREDEFINED_SCENES, custom: CUSTOM_SCENE_CONFIG };

const SCENE_NEON_COLORS: Record<string, { text: string; bg: string; border: string; glow: string }> = {
  cyan: { text: 'text-[var(--neon-cyan)]', bg: 'bg-[rgba(var(--neon-cyan-rgb),0.1)]', border: 'border-[rgba(var(--neon-cyan-rgb),0.3)]', glow: 'cyber-glow' },
  purple: { text: 'text-[var(--neon-purple)]', bg: 'bg-[rgba(var(--neon-purple-rgb),0.1)]', border: 'border-[rgba(var(--neon-purple-rgb),0.3)]', glow: 'cyber-glow-magenta' },
  red: { text: 'text-[var(--neon-red)]', bg: 'bg-[rgba(var(--neon-red-rgb),0.1)]', border: 'border-[rgba(var(--neon-red-rgb),0.3)]', glow: 'cyber-glow-red' },
  green: { text: 'text-[var(--neon-green)]', bg: 'bg-[rgba(var(--neon-green-rgb),0.1)]', border: 'border-[rgba(var(--neon-green-rgb),0.3)]', glow: 'cyber-glow-green' },
  amber: { text: 'text-[var(--neon-amber)]', bg: 'bg-[rgba(var(--neon-amber-rgb),0.1)]', border: 'border-[rgba(var(--neon-amber-rgb),0.3)]', glow: 'cyber-glow-amber' },
  magenta: { text: 'text-[var(--neon-magenta)]', bg: 'bg-[rgba(var(--neon-magenta-rgb),0.1)]', border: 'border-[rgba(var(--neon-magenta-rgb),0.3)]', glow: 'cyber-glow-magenta' },
};

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
  allModules?: Record<string, string>;
  allDecompiledModules?: Record<string, string>;
}

// Wrapper component to handle URL params with Suspense
function GeneratePageContent() {
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const { user } = useAuth();

  const [input, setInput] = useState('');
  const [network, setNetwork] = useState<Network>('mainnet');
  const [scene, setScene] = useState<SkillScene>('sdk');

  // Initialize from URL params
  useEffect(() => {
    const inputParam = searchParams.get('input');
    const networkParam = searchParams.get('network') as Network | null;
    const sceneParam = searchParams.get('scene') as SkillScene | null;

    if (inputParam) setInput(inputParam);
    if (networkParam && ['mainnet', 'testnet', 'devnet'].includes(networkParam)) {
      setNetwork(networkParam);
    }
    if (sceneParam && Object.keys(SCENES).includes(sceneParam)) {
      setScene(sceneParam);
    }
  }, [searchParams]);
  const [customScene, setCustomScene] = useState<CustomSceneConfig>({ name: '', description: '', focusAreas: [] });
  const [customFocusInput, setCustomFocusInput] = useState('');
  const [enableAIAnalysis, setEnableAIAnalysis] = useState(true);

  const [workflowStage, setWorkflowStage] = useState<WorkflowStage>('idle');
  const [stageMessage, setStageMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [artifacts, setArtifacts] = useState<IntermediateArtifacts>({});
  const [analysis, setAnalysis] = useState<ContractAnalysis | null>(null);
  const [result, setResult] = useState<GenerateResult | null>(null);


  const {
    isConnected: isLocalServerConnected,
    health: localServerHealth,
    decompile: localServerDecompile,
    getVersionHistory,
    compareVersions,
    isFetchingHistory,
    isComparingVersions,
    analyzeVersionChanges,
    isAnalyzingChanges,
  } = useLocalServer({ autoConnect: true });
  const hasMoveDecompiler = localServerHealth?.tools.some(t => t.name === 'move-decompiler' && t.available) ?? false;

  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Contract upgrade monitoring
  const handleUpgradeDiffAnalysis = useCallback((upgradeResult: UpgradeCheckResult) => {
    const record = upgradeResult.record;
    setInput(
      record.moduleName
        ? `${record.versionPackageId}::${record.moduleName}`
        : record.versionPackageId
    );
    setNetwork(record.network);
    setShowVersionHistory(true);
    setShowUpgradeModal(false);
  }, []);

  const {
    upgradedContracts,
    isChecking: isCheckingUpgrades,
    hasUpgrades,
    dismissUpgrade: dismissUpgradeNotification,
    dismissAll: dismissAllUpgrades,
    checkNow: checkUpgradesNow,
  } = useUpgradeMonitor({
    isServerConnected: isLocalServerConnected,
    onAutoAnalyze: (upgrades) => {
      if (upgrades.length > 0) handleUpgradeDiffAnalysis(upgrades[0]);
    },
  });

  // Show upgrade modal when upgrades detected and user is idle
  useEffect(() => {
    if (hasUpgrades && workflowStage === 'idle') {
      setShowUpgradeModal(true);
    }
  }, [hasUpgrades, workflowStage]);
  const [versionHistory, setVersionHistory] = useState<PackageVersionHistory | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [versionComparison, setVersionComparison] = useState<VersionCompareResult | null>(null);
  const [changeAnalysis, setChangeAnalysis] = useState<string | null>(null);
  const [isNotLatestVersion, setIsNotLatestVersion] = useState(false);
  const [versionConfirmed, setVersionConfirmed] = useState(false);

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

  // ---- Saved Skills ----
  const [savedSkills, setSavedSkills] = useState<SavedSkillItem[]>([]);
  const [savedSkillsCount, setSavedSkillsCount] = useState(0);
  const [savedSkillsLimit, setSavedSkillsLimit] = useState(10);
  const [showMySkills, setShowMySkills] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingSavedSkills, setLoadingSavedSkills] = useState(false);

  const fetchSavedSkills = useCallback(async () => {
    if (!user) return;
    setLoadingSavedSkills(true);
    try {
      const res = await fetch('/api/user/skills');
      if (res.ok) {
        const data = await res.json() as { skills: SavedSkillItem[]; count: number; limit: number };
        setSavedSkills(data.skills);
        setSavedSkillsCount(data.count);
        setSavedSkillsLimit(data.limit);
      }
    } catch (err) {
      console.error('Failed to fetch saved skills:', err);
    } finally {
      setLoadingSavedSkills(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) fetchSavedSkills();
    else {
      setSavedSkills([]);
      setSavedSkillsCount(0);
    }
  }, [user, fetchSavedSkills]);

  const handleSave = useCallback(async () => {
    if (!user) {
      showToast('Please connect wallet to save');
      return;
    }
    if (!result) return;

    setSaving(true);
    try {
      const res = await fetch('/api/user/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: result.packageName,
          packageId: result.metadata.packageId,
          moduleName: result.metadata.modules?.[0] || null,
          network: result.metadata.network,
          scene,
          skillMd: result.skillMd,
          metadata: { modules: result.metadata.modules, generatedAt: new Date().toISOString() },
        }),
      });

      if (res.status === 409) {
        showToast(`Max ${savedSkillsLimit} saved skills reached`);
        return;
      }
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error || 'Save failed');
      }

      showToast('Skill saved!');
      await fetchSavedSkills();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [user, result, scene, savedSkillsLimit, showToast, fetchSavedSkills]);

  const handleLoadSavedSkill = useCallback(async (skillId: string) => {
    try {
      const res = await fetch(`/api/user/skills/${skillId}`);
      if (!res.ok) throw new Error('Failed to load skill');
      const data = await res.json() as { skill: { title: string; packageId: string; moduleName: string | null; network: string; scene: string; skillMd: string; metadata: { modules?: string[] } | null } };
      const skill = data.skill;

      setResult({
        skillMd: skill.skillMd,
        packageName: skill.title,
        metadata: {
          packageId: skill.packageId,
          modules: skill.metadata?.modules || (skill.moduleName ? [skill.moduleName] : []),
          network: skill.network,
        },
      });
      setNetwork(skill.network as Network);
      if (Object.keys(SCENES).includes(skill.scene)) {
        setScene(skill.scene as SkillScene);
      }
      setWorkflowStage('complete');
      setShowMySkills(false);
      showToast('Skill loaded');
    } catch (err) {
      showToast('Failed to load skill');
    }
  }, [showToast]);

  const handleDeleteSavedSkill = useCallback(async (skillId: string) => {
    try {
      const res = await fetch(`/api/user/skills/${skillId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      showToast('Skill deleted');
      await fetchSavedSkills();
    } catch {
      showToast('Failed to delete skill');
    }
  }, [showToast, fetchSavedSkills]);

  const fetchVersionHistory = useCallback(async (packageId: string) => {
    if (!isLocalServerConnected || !packageId.trim()) {
      setVersionHistory(null);
      setVersionConfirmed(false);
      return;
    }

    try {
      const history = await getVersionHistory(packageId, network);
      setVersionHistory(history);

      const inputPkgId = packageId.trim().split('::')[0];
      const matchingVersion = history.versions.find(v => v.packageId === inputPkgId);

      if (matchingVersion) {
        setSelectedVersion(matchingVersion.version);
        const notLatest = matchingVersion.version < history.currentVersion;
        setIsNotLatestVersion(notLatest);
        setVersionConfirmed(!notLatest);
      } else {
        setSelectedVersion(history.currentVersion);
        setIsNotLatestVersion(false);
        setVersionConfirmed(true);
      }
    } catch (error) {
      console.error('Failed to fetch version history:', error);
      setVersionHistory(null);
      setVersionConfirmed(false);
    }
  }, [isLocalServerConnected, network, getVersionHistory]);

  const handleSelectVersion = useCallback((version: number, packageId: string) => {
    setSelectedVersion(version);
    const currentInput = input.trim();
    const hasModule = currentInput.includes('::');
    const moduleName = hasModule ? currentInput.split('::')[1] : '';
    setInput(moduleName ? `${packageId}::${moduleName}` : packageId);
    setIsNotLatestVersion(versionHistory ? version < versionHistory.currentVersion : false);
    setVersionConfirmed(true);
  }, [input, versionHistory]);

  const handleUseLatest = useCallback(() => {
    if (!versionHistory) return;
    const latestVersion = versionHistory.versions.find(v => v.version === versionHistory.currentVersion);
    if (latestVersion) {
      handleSelectVersion(versionHistory.currentVersion, latestVersion.packageId);
    }
  }, [versionHistory, handleSelectVersion]);

  const handleCompareVersions = useCallback(async (fromVersion: number, toVersion: number): Promise<VersionCompareResult> => {
    if (!versionHistory) throw new Error('No version history available');
    const result = await compareVersions(versionHistory.originalPackageId, fromVersion, toVersion, { network, diffType: 'structural' });
    setVersionComparison(result);
    setChangeAnalysis(null);
    return result;
  }, [versionHistory, network, compareVersions]);

  const handleAnalyzeChanges = useCallback(async (fromVersion: number, toVersion: number, comparison: VersionCompareResult): Promise<string> => {
    const analysis = await analyzeVersionChanges(fromVersion, toVersion, comparison, {
      packageId: versionHistory?.originalPackageId,
      network,
    });
    setChangeAnalysis(analysis);
    return analysis;
  }, [analyzeVersionChanges, versionHistory, network]);

  useEffect(() => {
    if (showVersionHistory && input.trim()) {
      const packageId = input.trim().split('::')[0];
      fetchVersionHistory(packageId);
    } else {
      setVersionHistory(null);
      setSelectedVersion(null);
      setIsNotLatestVersion(false);
      setVersionConfirmed(false);
    }
  }, [showVersionHistory, input, network, fetchVersionHistory]);

  const handleConfirmCurrentVersion = useCallback(() => {
    setVersionConfirmed(true);
  }, []);

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
      setWorkflowStage('fetching');
      setStageMessage('Fetching source code from chain...');

      const sourceResponse = await fetch('/api/source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: input.trim(), network }),
      });

      if (!sourceResponse.ok) {
        const data = await sourceResponse.json() as { error?: string };
        throw new Error(data.error || 'Failed to fetch source');
      }

      const sourceData = await sourceResponse.json() as { modules: Record<string, string>; packageId: string; bytecode?: Record<string, string> };
      const modules = Object.keys(sourceData.modules);
      const targetModule = moduleName || modules[0];
      const sourceCode = sourceData.modules[targetModule];

      setArtifacts(prev => ({
        ...prev,
        sourceCode,
        moduleName: targetModule,
        packageId: sourceData.packageId,
        allModules: sourceData.modules,
      }));

      let decompiledCode: string | undefined;
      let allDecompiledModules: Record<string, string> | undefined;
      if (isLocalServerConnected && hasMoveDecompiler && sourceData.bytecode) {
        setWorkflowStage('decompiling');
        setStageMessage('Decompiling bytecode with Revela...');

        try {
          const decompileResult = await localServerDecompile(packageId, { bytecode: sourceData.bytecode });
          if (decompileResult.success && decompileResult.output) {
            const parts = decompileResult.output.split(/\/\/ ===== Module: (\S+) =====\n*/);
            decompiledCode = decompileResult.output;
            allDecompiledModules = {};

            for (let i = 1; i < parts.length; i += 2) {
              const modName = parts[i];
              const modCode = parts[i + 1]?.trim();
              if (modName && modCode) {
                allDecompiledModules[modName] = modCode;
                if (modName === targetModule) {
                  decompiledCode = modCode;
                }
              }
            }

            setArtifacts(prev => ({ ...prev, decompiledCode, allDecompiledModules }));
          }
        } catch (e) {
          console.error('Decompilation failed:', e);
        }
      }

      const codeForAnalysis = decompiledCode || sourceCode;
      if (enableAIAnalysis) {
        setWorkflowStage('analyzing');
        setStageMessage('AI analyzing contract...');

        const analyzeResponse = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ packageId, network, moduleName: targetModule, sourceCode: codeForAnalysis }),
        });

        if (analyzeResponse.ok) {
          const analyzeData = await analyzeResponse.json() as { analysis: ContractAnalysis };
          setAnalysis(analyzeData.analysis);
          setWorkflowStage('reviewing');
          setStageMessage('Please review and confirm the analysis');
          return;
        } else {
          console.error('Analysis failed, proceeding without AI analysis');
        }
      }

      await generateSkill();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setWorkflowStage('error');
    }
  };

  const handleReviewConfirm = async (feedback: UserFeedback) => {
    try {
      setWorkflowStage('generating');
      setStageMessage('Generating skill with your feedback...');

      const reviewResponse = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysisId: `${artifacts.packageId}-${Date.now()}`, analysis, feedback }),
      });

      if (!reviewResponse.ok) throw new Error('Failed to process review');
      await generateSkill(feedback);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
      setWorkflowStage('error');
    }
  };

  const handleReviewCancel = () => {
    setWorkflowStage('idle');
    setAnalysis(null);
  };

  const generateSkill = async (feedback?: UserFeedback) => {
    setWorkflowStage('generating');
    setStageMessage('Generating SKILL.md...');

    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: input.trim(), network, scene,
        customScene: scene === 'custom' ? customScene : undefined,
        analysis, feedback,
      }),
    });

    if (!response.ok) {
      const data = await response.json() as { error?: string };
      throw new Error(data.error || 'Generation failed');
    }

    const data = await response.json() as GenerateResult;
    setResult(data);
    setWorkflowStage('complete');
    setStageMessage('Generation complete!');

    // Record generation for upgrade monitoring
    const inputParts = input.trim().split('::');
    useMonitorStore.getState().addRecord({
      originalPackageId: versionHistory?.originalPackageId || inputParts[0],
      versionPackageId: data.metadata.packageId || inputParts[0],
      moduleName: data.metadata.modules?.[0] || inputParts[1] || '',
      network,
      scene,
      versionAtGeneration: versionHistory?.currentVersion || selectedVersion || 1,
      generatedAt: new Date().toISOString(),
    });
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
    setVersionComparison(null);
  };

  const isWorking = ['fetching', 'decompiling', 'analyzing', 'generating'].includes(workflowStage);

  return (
    <div className="mx-auto px-6 sm:px-10 lg:px-16 py-8 max-w-[1680px]">
      {/* Header */}
      <div className="text-center mb-12">
        <h1
          className="text-4xl md:text-5xl font-bold mb-3 glitch-text neon-text"
          data-text="Generate Skill"
        >
          Generate Skill
        </h1>
        <p className="text-lg text-muted-foreground font-mono-cyber tracking-wide">
          Transform Sui Move contracts into Claude-ready skill documents
        </p>
        <div className="flex items-center justify-center gap-2 mt-4">
          <span className={`status-dot ${isLocalServerConnected ? 'status-dot-online' : 'status-dot-offline'}`} />
          <span className="text-xs text-muted-foreground font-mono-cyber">
            {isLocalServerConnected ? (hasMoveDecompiler ? 'Revela Decompiler Ready' : 'Local Server Connected') : 'Local Server Offline'}
          </span>
        </div>
      </div>

      {/* My Skills Panel */}
      {user && (
        <div className="glass-panel rounded mb-8 overflow-hidden">
          <button
            onClick={() => { setShowMySkills(!showMySkills); if (!showMySkills) fetchSavedSkills(); }}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-[var(--neon-purple)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span className="font-mono-cyber text-sm tracking-wide">My Skills</span>
              <span className="text-xs font-mono text-muted-foreground px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
                {savedSkillsCount}/{savedSkillsLimit}
              </span>
            </div>
            <svg className={`w-4 h-4 text-muted-foreground transition-transform ${showMySkills ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showMySkills && (
            <div className="border-t border-white/5 px-6 py-4">
              {loadingSavedSkills ? (
                <div className="flex items-center justify-center py-6 gap-2 text-muted-foreground text-sm">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Loading...
                </div>
              ) : savedSkills.length === 0 ? (
                <p className="text-center py-6 text-sm text-muted-foreground font-mono-cyber">No saved skills yet</p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {savedSkills.map((skill) => (
                    <div
                      key={skill.id}
                      className="flex items-center justify-between px-4 py-3 rounded-lg bg-white/[0.02] border border-white/5 hover:border-[rgba(var(--neon-purple-rgb),0.2)] transition-colors group"
                    >
                      <button
                        onClick={() => handleLoadSavedSkill(skill.id)}
                        className="flex-1 text-left min-w-0"
                      >
                        <div className="font-medium text-sm truncate">{skill.title}</div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground font-mono">
                          <span className="uppercase">{skill.network}</span>
                          <span>·</span>
                          <span>{skill.scene}</span>
                          <span>·</span>
                          <span>{new Date(skill.createdAt).toLocaleDateString()}</span>
                        </div>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteSavedSkill(skill.id); }}
                        className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Step 1: Contract Input */}
      <div className="glass-panel rounded p-8 mb-8 hud-corners">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded border border-[rgba(var(--neon-cyan-rgb),0.3)] bg-[rgba(var(--neon-cyan-rgb),0.1)] flex items-center justify-center neon-text font-mono-cyber font-bold">1</div>
          <div>
            <h2 className="text-lg font-semibold font-mono-cyber tracking-wide">Contract Input</h2>
            <p className="text-xs text-muted-foreground font-mono-cyber">Enter package ID or package::module</p>
          </div>
        </div>

        <div className="space-y-4">
          <input
            type="text"
            placeholder="0x2::coin or 0xdee9::clob_v2"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isWorking}
            className="cyber-input w-full px-5 py-4 rounded text-lg disabled:opacity-50"
          />

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-muted-foreground font-mono-cyber uppercase tracking-wider">Quick:</span>
            {PROTOCOL_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => setInput(`${preset.packageId}::${preset.modules[0]}`)}
                disabled={isWorking}
                className="cyber-btn px-3 py-1.5 rounded text-xs font-mono-cyber disabled:opacity-50"
              >
                {preset.name}
              </button>
            ))}
            <div className="flex-1" />
            <div className="flex gap-2">
              {(['mainnet', 'testnet', 'devnet'] as Network[]).map((n) => (
                <button
                  key={n}
                  onClick={() => setNetwork(n)}
                  disabled={isWorking}
                  className={`px-4 py-1.5 rounded text-sm font-mono-cyber uppercase tracking-wider transition-all ${
                    network === n
                      ? 'bg-[rgba(var(--neon-cyan-rgb),0.15)] border border-[var(--neon-cyan)] text-[var(--neon-cyan)] shadow-[0_0_10px_rgba(var(--neon-cyan-rgb),0.3)]'
                      : 'bg-[rgba(var(--neon-cyan-rgb),0.03)] border border-[rgba(var(--neon-cyan-rgb),0.1)] text-muted-foreground hover:border-[rgba(var(--neon-cyan-rgb),0.3)]'
                  } disabled:opacity-50`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {isLocalServerConnected && (
            <div className="flex items-center justify-between pt-4 border-t border-[rgba(var(--neon-cyan-rgb),0.08)]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded border border-[rgba(var(--neon-purple-rgb),0.3)] bg-[rgba(var(--neon-purple-rgb),0.1)] flex items-center justify-center">
                  <svg className="w-4 h-4 text-[var(--neon-purple)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <span className="text-sm font-mono-cyber">Version History</span>
                  <span className="text-xs text-muted-foreground ml-2 font-mono-cyber">Compare and select package versions</span>
                </div>
                {isFetchingHistory && (
                  <svg className="w-4 h-4 animate-spin text-[var(--neon-purple)]" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
              </div>
              <button
                onClick={() => setShowVersionHistory(!showVersionHistory)}
                disabled={isWorking}
                className={`relative w-12 h-6 rounded-full transition-all ${showVersionHistory ? 'bg-[var(--neon-purple)] shadow-[0_0_10px_rgba(var(--neon-purple-rgb),0.5)]' : 'bg-[rgba(var(--neon-cyan-rgb),0.15)]'} disabled:opacity-50`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${showVersionHistory ? 'left-7' : 'left-1'}`} />
              </button>
            </div>
          )}
        </div>
      </div>

      {showVersionHistory && versionHistory && (
        <div className="glass-panel rounded mb-8 overflow-hidden hud-corners">
          <VersionHistoryPanel
            history={versionHistory}
            selectedVersion={selectedVersion}
            onSelectVersion={handleSelectVersion}
            onCompare={handleCompareVersions}
            isComparing={isComparingVersions}
            comparison={versionComparison}
            isNotLatest={isNotLatestVersion}
            onUseLatest={handleUseLatest}
            onAnalyzeChanges={handleAnalyzeChanges}
            isAnalyzing={isAnalyzingChanges}
            changeAnalysis={changeAnalysis}
          />
        </div>
      )}

      {artifacts.allModules && Object.keys(artifacts.allModules).length > 0 && (
        <div className="glass-panel rounded mb-8 overflow-hidden hud-corners" style={{ height: '900px' }}>
          <SourceCodePanel
            modules={artifacts.allModules}
            decompiledModules={artifacts.allDecompiledModules}
            selectedModule={artifacts.moduleName}
            packageId={artifacts.packageId}
          />
        </div>
      )}

      {workflowStage === 'idle' && showVersionHistory && versionHistory && isNotLatestVersion && !versionConfirmed && (
        <div className="glass-panel rounded p-6 mb-8 border border-[rgba(var(--neon-amber-rgb),0.3)] hud-corners-amber animate-border-pulse-amber">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded border border-[rgba(var(--neon-amber-rgb),0.3)] bg-[rgba(var(--neon-amber-rgb),0.1)] flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-[var(--neon-amber)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-mono-cyber neon-text-amber mb-1">Older Version Selected</h3>
              <p className="text-sm text-[rgba(var(--neon-amber-rgb),0.7)] font-mono-cyber">
                You selected <strong>v{selectedVersion}</strong>, but the latest is <strong>v{versionHistory.currentVersion}</strong>.
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={handleUseLatest} className="cyber-btn px-4 py-2 rounded text-sm font-mono-cyber" style={{ borderColor: 'rgba(var(--neon-green-rgb), 0.3)', color: 'var(--neon-green)' }}>
                Use Latest
              </button>
              <button onClick={handleConfirmCurrentVersion} className="cyber-btn px-4 py-2 rounded text-sm font-mono-cyber" style={{ borderColor: 'rgba(var(--neon-amber-rgb), 0.3)', color: 'var(--neon-amber)' }}>
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Scene Selection */}
      <div className="glass-panel rounded p-8 mb-8 hud-corners">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded border border-[rgba(var(--neon-cyan-rgb),0.3)] bg-[rgba(var(--neon-cyan-rgb),0.1)] flex items-center justify-center neon-text font-mono-cyber font-bold">2</div>
          <div>
            <h2 className="text-lg font-semibold font-mono-cyber tracking-wide">Select Scene</h2>
            <p className="text-xs text-muted-foreground font-mono-cyber">Choose the focus for your skill document</p>
          </div>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-7 gap-4">
          {(Object.entries(SCENES) as [SkillScene, typeof CUSTOM_SCENE_CONFIG][]).map(([id, config]) => {
            const colors = SCENE_NEON_COLORS[config.color] || SCENE_NEON_COLORS.cyan;
            return (
              <button
                key={id}
                onClick={() => setScene(id)}
                disabled={isWorking}
                className={`relative p-4 rounded text-center transition-all duration-200 ${
                  scene === id
                    ? `${colors.bg} border-2 ${colors.border} ${colors.glow} scale-105`
                    : 'bg-[rgba(var(--neon-cyan-rgb),0.03)] border border-[rgba(var(--neon-cyan-rgb),0.1)] hover:border-[rgba(var(--neon-cyan-rgb),0.25)] hover:bg-[rgba(var(--neon-cyan-rgb),0.05)]'
                } ${id === 'custom' ? 'border-dashed' : ''} disabled:opacity-50`}
              >
                <span className={`text-2xl font-mono-cyber font-bold ${scene === id ? colors.text : 'text-muted-foreground'}`}>{config.icon}</span>
                <div className={`mt-2 text-xs font-mono-cyber uppercase tracking-wider ${scene === id ? colors.text : ''}`}>{t(`scene.${id}`).split(' ')[0]}</div>
              </button>
            );
          })}
        </div>

        {scene === 'custom' && (
          <div className="mt-5 p-4 border border-dashed border-[rgba(var(--neon-purple-rgb),0.2)] rounded bg-[rgba(var(--neon-purple-rgb),0.03)] space-y-3">
            <input
              type="text"
              value={customScene.name}
              onChange={(e) => setCustomScene(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Scene Name"
              className="cyber-input w-full px-4 py-2.5 rounded text-sm"
            />
            <textarea
              value={customScene.description}
              onChange={(e) => setCustomScene(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Description"
              rows={2}
              className="cyber-input w-full px-4 py-2.5 rounded text-sm resize-none"
            />
            <div className="flex flex-wrap gap-2">
              {customScene.focusAreas.map((area, idx) => (
                <span key={idx} className="inline-flex items-center gap-1 px-3 py-1 bg-[rgba(var(--neon-purple-rgb),0.15)] border border-[rgba(var(--neon-purple-rgb),0.3)] text-[var(--neon-purple)] rounded text-xs font-mono-cyber">
                  {area}
                  <button onClick={() => setCustomScene(prev => ({ ...prev, focusAreas: prev.focusAreas.filter((_, i) => i !== idx) }))} className="hover:text-white">×</button>
                </span>
              ))}
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
                placeholder="+ Add focus area (Enter)"
                className="flex-1 min-w-[150px] px-3 py-1 bg-transparent text-sm font-mono-cyber focus:outline-none placeholder:text-muted-foreground/50"
              />
            </div>
          </div>
        )}
      </div>

      {/* AI Analysis Toggle */}
      <div className="glass-panel rounded p-6 mb-8 hud-corners">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded border border-[rgba(var(--neon-green-rgb),0.3)] bg-[rgba(var(--neon-green-rgb),0.1)] flex items-center justify-center">
              <span className="text-lg font-mono-cyber font-bold neon-text-green">AI</span>
            </div>
            <div>
              <h3 className="font-semibold font-mono-cyber">AI-Enhanced Analysis</h3>
              <p className="text-xs text-muted-foreground font-mono-cyber">
                Use Claude to analyze contract purpose, generics, and error codes
              </p>
            </div>
          </div>
          <button
            onClick={() => setEnableAIAnalysis(!enableAIAnalysis)}
            disabled={isWorking}
            className={`relative w-14 h-7 rounded-full transition-all ${enableAIAnalysis ? 'bg-[var(--neon-green)] shadow-[0_0_10px_rgba(var(--neon-green-rgb),0.5)]' : 'bg-[rgba(var(--neon-cyan-rgb),0.15)]'} disabled:opacity-50`}
          >
            <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${enableAIAnalysis ? 'left-8' : 'left-1'}`} />
          </button>
        </div>
      </div>

      {/* Contract Monitor Settings */}
      <MonitorSettingsPanel
        isChecking={isCheckingUpgrades}
        onCheckNow={checkUpgradesNow}
        isServerConnected={isLocalServerConnected}
      />

      {/* Error Display */}
      {error && (
        <div className="glass-panel rounded p-6 mb-8 border border-[rgba(var(--neon-red-rgb),0.3)] hud-corners-red animate-border-pulse-red">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-[var(--neon-red)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="neon-text-red font-mono-cyber text-sm">{error}</span>
            </div>
            <button onClick={resetWorkflow} className="text-sm neon-text-red hover:underline font-mono-cyber">Reset</button>
          </div>
        </div>
      )}

      {/* Progress Display */}
      {isWorking && (
        <div className="glass-panel rounded p-8 mb-8 hud-corners scan-line">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded border border-[rgba(var(--neon-cyan-rgb),0.3)] bg-[rgba(var(--neon-cyan-rgb),0.1)] flex items-center justify-center">
              <svg className="w-6 h-6 animate-spin text-[var(--neon-cyan)]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold capitalize font-mono-cyber neon-text">{workflowStage}...</h3>
              <p className="text-sm text-muted-foreground font-mono-cyber">{stageMessage}</p>
            </div>
          </div>

          <div className="flex gap-2">
            {['fetching', 'decompiling', 'analyzing', 'reviewing', 'generating'].map((stage, idx) => {
              const currentIdx = ['fetching', 'decompiling', 'analyzing', 'reviewing', 'generating'].indexOf(workflowStage);
              const isComplete = idx < currentIdx;
              const isCurrent = idx === currentIdx;
              return (
                <div
                  key={stage}
                  className={`flex-1 h-2 rounded-full transition-all ${
                    isComplete ? 'bg-[var(--neon-green)] shadow-[0_0_8px_rgba(var(--neon-green-rgb),0.5)]' : isCurrent ? 'bg-[var(--neon-cyan)] animate-pulse shadow-[0_0_8px_rgba(var(--neon-cyan-rgb),0.5)]' : 'bg-[rgba(var(--neon-cyan-rgb),0.1)]'
                  }`}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* AI Analysis Summary */}
      {analysis && !isWorking && workflowStage !== 'reviewing' && workflowStage !== 'complete' && (
        <div className="glass-panel rounded overflow-hidden mb-8 hud-corners">
          <div className="flex items-center justify-between p-4 border-b border-[rgba(var(--neon-cyan-rgb),0.08)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded border border-[rgba(var(--neon-green-rgb),0.3)] bg-[rgba(var(--neon-green-rgb),0.1)] flex items-center justify-center">
                <span className="text-lg font-mono-cyber font-bold neon-text-green">AI</span>
              </div>
              <div>
                <h3 className="font-semibold font-mono-cyber">AI Analysis</h3>
                <p className="text-xs text-muted-foreground font-mono-cyber">Contract structure and semantics</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-1 rounded font-mono-cyber ${
                analysis.purpose.category === 'dex' ? 'bg-[rgba(var(--neon-cyan-rgb),0.15)] text-[var(--neon-cyan)]' :
                analysis.purpose.category === 'defi' ? 'bg-[rgba(var(--neon-green-rgb),0.15)] text-[var(--neon-green)]' :
                'bg-[rgba(var(--neon-cyan-rgb),0.08)] text-[rgba(var(--neon-cyan-rgb),0.6)]'
              }`}>
                {analysis.purpose.category}
              </span>
              <span className={`text-xs px-2 py-1 rounded font-mono-cyber ${
                analysis.security.riskLevel === 'high' ? 'bg-[rgba(var(--neon-red-rgb),0.15)] text-[var(--neon-red)]' :
                analysis.security.riskLevel === 'medium' ? 'bg-[rgba(var(--neon-amber-rgb),0.15)] text-[var(--neon-amber)]' :
                'bg-[rgba(var(--neon-green-rgb),0.15)] text-[var(--neon-green)]'
              }`}>
                {analysis.security.riskLevel} risk
              </span>
            </div>
          </div>

          <div className="p-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-4">
                <div className="p-4 rounded bg-[rgba(var(--neon-cyan-rgb),0.03)] border border-[rgba(var(--neon-cyan-rgb),0.08)]">
                  <p className="text-sm text-muted-foreground font-mono-cyber">{analysis.purpose.summary}</p>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded bg-[rgba(var(--neon-cyan-rgb),0.03)] border border-[rgba(var(--neon-cyan-rgb),0.08)] text-center">
                    <div className="text-2xl font-bold neon-text font-mono-cyber">{analysis.functions.length}</div>
                    <div className="text-xs text-muted-foreground font-mono-cyber">Functions</div>
                  </div>
                  <div className="p-3 rounded bg-[rgba(var(--neon-purple-rgb),0.03)] border border-[rgba(var(--neon-purple-rgb),0.08)] text-center">
                    <div className="text-2xl font-bold neon-text-magenta font-mono-cyber">{analysis.types.length}</div>
                    <div className="text-xs text-muted-foreground font-mono-cyber">Types</div>
                  </div>
                  <div className="p-3 rounded bg-[rgba(var(--neon-amber-rgb),0.03)] border border-[rgba(var(--neon-amber-rgb),0.08)] text-center">
                    <div className="text-2xl font-bold neon-text-amber font-mono-cyber">{analysis.errorCodes.length}</div>
                    <div className="text-xs text-muted-foreground font-mono-cyber">Errors</div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {Object.keys(analysis.generics.mapping).length > 0 && (
                  <div className="p-4 rounded bg-[rgba(var(--neon-purple-rgb),0.03)] border border-[rgba(var(--neon-purple-rgb),0.08)]">
                    <h4 className="text-sm font-mono-cyber mb-3 neon-text-magenta">Generic Types</h4>
                    <div className="space-y-2">
                      {Object.entries(analysis.generics.mapping).map(([key, value]) => (
                        <div key={key} className="flex items-center gap-2 text-sm">
                          <code className="px-2 py-1 rounded bg-[rgba(var(--neon-purple-rgb),0.15)] text-[var(--neon-purple)] font-mono-cyber">{key}</code>
                          <span className="text-muted-foreground">→</span>
                          <span className="font-mono-cyber">{value.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-sm p-3 rounded bg-[rgba(var(--neon-cyan-rgb),0.03)] border border-[rgba(var(--neon-cyan-rgb),0.08)]">
                  <span className="text-muted-foreground font-mono-cyber">
                    {analysis.analysisSource === 'claude' ? 'AI Claude' : analysis.analysisSource === 'hybrid' ? 'Hybrid' : 'Regex'}
                  </span>
                  <span className="text-muted-foreground font-mono-cyber">
                    {Math.round(analysis.confidence * 100)}% confidence
                  </span>
                </div>
              </div>
            </div>
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
          disabled={!input.trim() || (showVersionHistory && !!versionHistory && isNotLatestVersion && !versionConfirmed)}
          className={`w-full py-5 rounded font-bold text-lg transition-all duration-300 font-mono-cyber uppercase tracking-wider ${
            !input.trim() || (showVersionHistory && !!versionHistory && isNotLatestVersion && !versionConfirmed)
              ? 'bg-[rgba(var(--neon-cyan-rgb),0.03)] text-muted-foreground cursor-not-allowed border border-[rgba(var(--neon-cyan-rgb),0.08)]'
              : 'cyber-btn text-[var(--neon-cyan)] hover:-translate-y-1'
          }`}
        >
          <span className="flex items-center justify-center gap-3">
            {enableAIAnalysis ? 'Analyze & Generate' : 'Generate'} {t(`scene.${scene}`)} Skill
            {showVersionHistory && selectedVersion && (
              <span className="text-sm opacity-75">(v{selectedVersion})</span>
            )}
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </span>
        </button>
      )}

      {/* Result Display */}
      {workflowStage === 'complete' && result && (
        <div className="glass-panel rounded overflow-hidden hud-corners scan-line">
          <div className="flex items-center justify-between p-8 border-b border-[rgba(var(--neon-green-rgb),0.1)] bg-[rgba(var(--neon-green-rgb),0.03)]">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded border ${SCENE_NEON_COLORS[SCENES[scene].color]?.border || 'border-[rgba(var(--neon-cyan-rgb),0.3)]'} ${SCENE_NEON_COLORS[SCENES[scene].color]?.bg || 'bg-[rgba(var(--neon-cyan-rgb),0.1)]'} flex items-center justify-center`}>
                <span className={`text-3xl font-mono-cyber font-bold ${SCENE_NEON_COLORS[SCENES[scene].color]?.text || 'neon-text'}`}>{SCENES[scene].icon}</span>
              </div>
              <div>
                <h3 className="font-bold text-xl font-mono-cyber neon-text">{result.packageName}</h3>
                <p className="text-sm text-muted-foreground font-mono-cyber">
                  {result.metadata.packageId.slice(0, 12)}... • {result.metadata.network} • {t(`scene.${scene}`)}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => copyToClipboard(result.skillMd)} className="cyber-btn px-4 py-2.5 rounded text-sm font-mono-cyber flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy
              </button>
              <button onClick={handleDownload} className="cyber-btn px-5 py-2.5 rounded text-sm font-mono-cyber" style={{ borderColor: 'rgba(var(--neon-green-rgb), 0.3)', color: 'var(--neon-green)' }}>
                Download ZIP
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="cyber-btn px-4 py-2.5 rounded text-sm font-mono-cyber flex items-center gap-2 disabled:opacity-50"
                style={{ borderColor: 'rgba(var(--neon-purple-rgb), 0.3)', color: 'var(--neon-purple)' }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={resetWorkflow} className="cyber-btn px-4 py-2.5 rounded text-sm font-mono-cyber">
                New
              </button>
            </div>
          </div>

          <SkillMarkdownEditor
            initialContent={result.skillMd}
            packageName={result.packageName}
            onContentChange={(content) => {
              setResult(prev => prev ? { ...prev, skillMd: content } : null);
            }}
            onSave={async (content) => {
              setResult(prev => prev ? { ...prev, skillMd: content } : null);
            }}
            isSaving={saving}
          />
        </div>
      )}

      {/* Playground - AI Conversational Contract Explorer */}
      {workflowStage === 'complete' && result && (
        <PlaygroundPanel
          result={result}
          analysis={analysis}
          artifacts={artifacts}
          network={network}
          scene={scene}
          isLocalServerConnected={isLocalServerConnected}
          localServerHealth={localServerHealth}
        />
      )}

      {/* Upgrade Notification Modal */}
      {showUpgradeModal && upgradedContracts.length > 0 && (
        <UpgradeNotificationModal
          upgradedContracts={upgradedContracts}
          onRunDiffAnalysis={(item) => {
            handleUpgradeDiffAnalysis(item);
          }}
          onDismiss={(id) => {
            dismissUpgradeNotification(id);
            if (upgradedContracts.length <= 1) setShowUpgradeModal(false);
          }}
          onDismissAll={() => {
            dismissAllUpgrades();
            setShowUpgradeModal(false);
          }}
          onClose={() => setShowUpgradeModal(false)}
        />
      )}

      <Toast message={toast.message} isVisible={toast.visible} onClose={hideToast} />
    </div>
  );
}

export default function GeneratePage() {
  return (
    <Suspense fallback={
      <div className="mx-auto px-6 sm:px-10 lg:px-16 py-8 max-w-[1680px]">
        <div className="text-center mb-12">
          <div className="h-12 w-64 mx-auto bg-[rgba(var(--neon-cyan-rgb),0.08)] rounded animate-pulse mb-3" />
          <div className="h-6 w-96 mx-auto bg-[rgba(var(--neon-cyan-rgb),0.04)] rounded animate-pulse" />
        </div>
      </div>
    }>
      <GeneratePageContent />
    </Suspense>
  );
}
