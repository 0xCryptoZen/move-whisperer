/**
 * Scene registry - configuration for different skill generation scenes
 */

import type { SkillScene, SceneConfig, ProtocolPreset, Network } from '../types/index.js';

/**
 * Scene configurations
 */
export const SCENE_CONFIGS: Record<SkillScene, SceneConfig> = {
  sdk: {
    id: 'sdk',
    name: 'SDK Integration',
    nameZh: 'SDK 集成开发',
    description: 'Generate skills for integrating the contract into your application',
    descriptionZh: '生成用于将合约集成到应用程序的技能文档',
    icon: '🔌',
    focusAreas: [
      'Function signatures and parameters',
      'TypeScript/JavaScript code examples',
      'PTB (Programmable Transaction Blocks) patterns',
      'Error handling and edge cases',
      'Object acquisition and management',
    ],
    focusAreasZh: [
      '函数签名和参数说明',
      'TypeScript/JavaScript 代码示例',
      'PTB（可编程交易块）模式',
      '错误处理和边界情况',
      '对象获取和管理',
    ],
  },

  learn: {
    id: 'learn',
    name: 'Protocol Learning',
    nameZh: '协议原理学习',
    description: 'Understand the protocol design and architecture',
    descriptionZh: '理解协议设计和架构原理',
    icon: '📚',
    focusAreas: [
      'Architecture overview with diagrams',
      'Core concepts and terminology',
      'State transitions and data flow',
      'Design patterns and decisions',
      'Comparison with similar protocols',
    ],
    focusAreasZh: [
      '架构概览和图表',
      '核心概念和术语',
      '状态转换和数据流',
      '设计模式和决策',
      '与类似协议的对比',
    ],
  },

  audit: {
    id: 'audit',
    name: 'Security Audit',
    nameZh: '安全审计',
    description: 'Analyze security aspects and potential risks',
    descriptionZh: '分析安全方面和潜在风险',
    icon: '🔒',
    focusAreas: [
      'Permission model and access control',
      'Asset flow analysis (Coin entry/exit)',
      'Risk classification (High/Medium/Low)',
      'Common vulnerability checklist',
      'Admin functions and privileges',
    ],
    focusAreasZh: [
      '权限模型和访问控制',
      '资产流向分析（Coin 进出）',
      '风险分类（高/中/低）',
      '常见漏洞检查清单',
      '管理员函数和特权',
    ],
  },

  frontend: {
    id: 'frontend',
    name: 'Frontend Development',
    nameZh: '前端开发',
    description: 'Build user interfaces that interact with the contract',
    descriptionZh: '构建与合约交互的用户界面',
    icon: '🖥️',
    focusAreas: [
      'User operation flows',
      'State queries and data fetching',
      'Event listening and real-time updates',
      'Transaction building for users',
      'UX recommendations and best practices',
    ],
    focusAreasZh: [
      '用户操作流程',
      '状态查询和数据获取',
      '事件监听和实时更新',
      '为用户构建交易',
      'UX 建议和最佳实践',
    ],
  },

  bot: {
    id: 'bot',
    name: 'Trading Bot',
    nameZh: '交易机器人',
    description: 'Automate trading and interactions with the contract',
    descriptionZh: '自动化交易和合约交互',
    icon: '🤖',
    focusAreas: [
      'Entry functions for automation',
      'Gas optimization strategies',
      'Batch operations with PTB',
      'Price and state monitoring',
      'Risk control mechanisms',
    ],
    focusAreasZh: [
      '自动化入口函数',
      'Gas 优化策略',
      '使用 PTB 批量操作',
      '价格和状态监控',
      '风险控制机制',
    ],
  },

  docs: {
    id: 'docs',
    name: 'Documentation',
    nameZh: '文档生成',
    description: 'Generate comprehensive API documentation',
    descriptionZh: '生成完整的 API 文档',
    icon: '📝',
    focusAreas: [
      'Complete API reference',
      'Module and function index',
      'Terminology glossary',
      'Usage examples and tutorials',
      'FAQ and troubleshooting',
    ],
    focusAreasZh: [
      '完整的 API 参考',
      '模块和函数索引',
      '术语表',
      '使用示例和教程',
      '常见问题和故障排除',
    ],
  },
};

/**
 * Popular protocol presets for quick access
 */
export const PROTOCOL_PRESETS: ProtocolPreset[] = [
  {
    id: 'cetus',
    name: 'Cetus DEX',
    packageId: '0x1eabed72c53feb73c83f8fbf7a5557e5e7b8e7e3d1c6f5e8a0b8c9d0e1f2a3b4',
    network: 'mainnet' as Network,
    suggestedModules: ['pool', 'swap', 'position'],
    description: 'Concentrated liquidity AMM on Sui',
  },
  {
    id: 'deepbook',
    name: 'DeepBook',
    packageId: '0xdee9006a21d73e00a2bb8320f1f9f20cfe1b5b7ae15d9c5a15a9f0b0e0d2c3b4',
    network: 'mainnet' as Network,
    suggestedModules: ['clob_v2', 'custodian_v2'],
    description: 'Central limit order book on Sui',
  },
  {
    id: 'scallop',
    name: 'Scallop',
    packageId: '0x5c1f6b6c6b6c6b6c6b6c6b6c6b6c6b6c6b6c6b6c6b6c6b6c6b6c6b6c6b6c6b6c',
    network: 'mainnet' as Network,
    suggestedModules: ['lending', 'borrow'],
    description: 'Lending protocol on Sui',
  },
  {
    id: 'navi',
    name: 'NAVI Protocol',
    packageId: '0x6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e6e',
    network: 'mainnet' as Network,
    suggestedModules: ['lending', 'incentive'],
    description: 'Lending and borrowing protocol on Sui',
  },
  {
    id: 'turbos',
    name: 'Turbos Finance',
    packageId: '0x7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b',
    network: 'mainnet' as Network,
    suggestedModules: ['pool', 'swap'],
    description: 'Concentrated liquidity DEX on Sui',
  },
  {
    id: 'suilend',
    name: 'Suilend',
    packageId: '0x8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c',
    network: 'mainnet' as Network,
    suggestedModules: ['lending_market', 'reserve'],
    description: 'Lending protocol on Sui',
  },
];

/**
 * Get scene configuration by ID
 */
export function getSceneConfig(scene: SkillScene): SceneConfig {
  return SCENE_CONFIGS[scene];
}

/**
 * Get all scene IDs
 */
export function getAllSceneIds(): SkillScene[] {
  return Object.keys(SCENE_CONFIGS) as SkillScene[];
}

/**
 * Get protocol preset by ID
 */
export function getProtocolPreset(id: string): ProtocolPreset | undefined {
  return PROTOCOL_PRESETS.find((p) => p.id === id);
}

/**
 * Validate scene ID
 */
export function isValidScene(scene: string): scene is SkillScene {
  return scene in SCENE_CONFIGS;
}

/**
 * Get scene display name
 */
export function getSceneDisplayName(scene: SkillScene, language: 'en' | 'zh' = 'en'): string {
  const config = SCENE_CONFIGS[scene];
  return language === 'zh' ? config.nameZh : config.name;
}

/**
 * Get scene focus areas
 */
export function getSceneFocusAreas(scene: SkillScene, language: 'en' | 'zh' = 'en'): string[] {
  const config = SCENE_CONFIGS[scene];
  return language === 'zh' ? config.focusAreasZh : config.focusAreas;
}
