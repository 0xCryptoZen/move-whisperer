/**
 * Main generator - orchestrates the skill generation process
 */

import type {
  Network,
  AnalyzedModule,
  SkillOutput,
  SkillMetadata,
  GeneratedExample,
  ProgressCallback,
  SkillScene,
  CustomSceneConfig,
} from '../types/index.js';
import { AbiFetcher, createAbiFetcher, parsePackageInput } from '../fetcher/index.js';
import { ModuleAnalyzer, createModuleAnalyzer } from '../analyzer/index.js';
import { SkillGenerator, createSkillGenerator } from '../generator/skill-generator.js';
import { ScriptGenerator, createScriptGenerator } from '../generator/script-generator.js';
import { createFileWriter } from '../output/writer.js';
import { VERSION } from '../index.js';
import { createHash } from 'crypto';

export interface MainGeneratorOptions {
  network: Network;
  rpcUrl?: string;
  language?: 'en' | 'zh';
  includeScripts?: boolean;
  includeExamples?: boolean;
  outputDir?: string;
  // Scene-related options
  scene?: SkillScene;
  customScene?: CustomSceneConfig;
  analyzeDependencies?: boolean;
  includeArchitectureDiagram?: boolean;
  moduleFilter?: string[];
}

export interface GenerateResult {
  output: SkillOutput;
  analyzedModule: AnalyzedModule;
  writtenFiles: string[];
}

/**
 * Main generator class - coordinates all generation steps
 */
export class MainGenerator {
  private abiFetcher: AbiFetcher;
  private moduleAnalyzer: ModuleAnalyzer;
  private skillGenerator: SkillGenerator;
  private scriptGenerator: ScriptGenerator;
  private options: Required<Omit<MainGeneratorOptions, 'moduleFilter' | 'customScene'>> & { moduleFilter?: string[]; customScene?: CustomSceneConfig };

  constructor(options: MainGeneratorOptions) {
    this.options = {
      network: options.network,
      rpcUrl: options.rpcUrl ?? '',
      language: options.language ?? 'en',
      includeScripts: options.includeScripts ?? true,
      includeExamples: options.includeExamples ?? true,
      outputDir: options.outputDir ?? './',
      scene: options.scene ?? 'sdk',
      customScene: options.customScene,
      analyzeDependencies: options.analyzeDependencies ?? false,
      includeArchitectureDiagram: options.includeArchitectureDiagram ?? false,
      moduleFilter: options.moduleFilter,
    };

    this.abiFetcher = createAbiFetcher(options.network, {
      rpcUrl: options.rpcUrl,
    });
    this.moduleAnalyzer = createModuleAnalyzer();
    this.skillGenerator = createSkillGenerator({
      language: this.options.language,
      scene: this.options.scene,
      customScene: this.options.customScene,
    });
    this.scriptGenerator = createScriptGenerator();
  }

  /**
   * Generate skill from package input
   */
  async generate(
    input: string,
    onProgress?: ProgressCallback
  ): Promise<GenerateResult> {
    // Parse input
    onProgress?.('parse', 'Parsing input...', 0);
    const { packageId, moduleName } = parsePackageInput(input);

    // Fetch ABI
    onProgress?.('fetch', `Fetching ABI from ${this.options.network}...`, 20);

    let module;
    if (moduleName) {
      // Fetch specific module
      const fetched = await this.abiFetcher.fetchModule(packageId, moduleName);
      module = fetched;
    } else {
      // Fetch all modules and use the first one
      const modules = await this.abiFetcher.fetchPackage(packageId);
      if (modules.length === 0) {
        throw new Error(`No modules found in package ${packageId}`);
      }
      module = modules[0];
    }

    // Analyze module
    onProgress?.('analyze', 'Analyzing module...', 40);
    const analyzed = this.moduleAnalyzer.analyzeModule(
      module.abi,
      this.options.network,
      module.sourceCode
    );

    // Generate content
    onProgress?.('generate', 'Generating skill documentation...', 60);
    const output = this.generateOutput(analyzed);

    // Write files
    onProgress?.('write', 'Writing files...', 80);
    const outputDir = this.options.outputDir || `./${this.formatPackageName(analyzed.moduleName)}`;
    const writer = createFileWriter(outputDir);
    const writtenFiles = await writer.writeSkillOutput(output);

    onProgress?.('done', 'Generation complete!', 100);

    return {
      output,
      analyzedModule: analyzed,
      writtenFiles,
    };
  }

  /**
   * Preview skill generation without writing files
   */
  async preview(input: string, onProgress?: ProgressCallback): Promise<SkillOutput> {
    // Parse input
    onProgress?.('parse', 'Parsing input...', 0);
    const { packageId, moduleName } = parsePackageInput(input);

    // Fetch ABI
    onProgress?.('fetch', `Fetching ABI from ${this.options.network}...`, 25);

    let module;
    if (moduleName) {
      const fetched = await this.abiFetcher.fetchModule(packageId, moduleName);
      module = fetched;
    } else {
      const modules = await this.abiFetcher.fetchPackage(packageId);
      if (modules.length === 0) {
        throw new Error(`No modules found in package ${packageId}`);
      }
      module = modules[0];
    }

    // Analyze module
    onProgress?.('analyze', 'Analyzing module...', 50);
    const analyzed = this.moduleAnalyzer.analyzeModule(
      module.abi,
      this.options.network,
      module.sourceCode
    );

    // Generate content
    onProgress?.('generate', 'Generating preview...', 75);
    const output = this.generateOutput(analyzed);

    onProgress?.('done', 'Preview ready!', 100);

    return output;
  }

  /**
   * List available modules in a package
   */
  async listModules(packageId: string): Promise<string[]> {
    return this.abiFetcher.listModules(packageId);
  }

  /**
   * Generate output from analyzed module
   */
  private generateOutput(analyzed: AnalyzedModule): SkillOutput {
    // Generate SKILL.md based on scene
    const skillMd = this.skillGenerator.generateSceneSkillMd(analyzed, this.options.scene);

    // Generate types.md
    const typesMd = this.skillGenerator.generateTypesMd(analyzed);

    // Generate events.md
    const eventsMd = this.generateEventsMd(analyzed);

    // Generate scripts (only for SDK and Bot scenes)
    const shouldGenerateScripts =
      this.options.includeScripts &&
      (this.options.scene === 'sdk' || this.options.scene === 'bot' || this.options.scene === 'frontend');

    const callScript = shouldGenerateScripts
      ? this.scriptGenerator.generateCallScript(analyzed)
      : '';
    const readScript = shouldGenerateScripts
      ? this.scriptGenerator.generateReadScript(analyzed)
      : '';

    // Generate examples (scene-dependent)
    const examples: GeneratedExample[] = this.options.includeExamples
      ? this.generateExamples(analyzed)
      : [];

    // Build metadata
    const sceneId = this.options.scene === 'custom'
      ? (this.options.customScene?.name?.toLowerCase().replace(/\s+/g, '-') || 'custom')
      : this.options.scene;
    const metadata: SkillMetadata = {
      generatedAt: new Date().toISOString(),
      generatorVersion: VERSION,
      network: this.options.network,
      packageId: analyzed.packageId,
      modules: [analyzed.moduleName],
      checksum: this.generateChecksum(skillMd),
    };

    return {
      packageName: `${this.formatPackageName(analyzed.moduleName)}-${sceneId}`,
      skillMd,
      references: {
        abi: JSON.stringify(analyzed, null, 2),
        types: typesMd,
        events: eventsMd,
      },
      scripts: {
        call: callScript,
        read: readScript,
      },
      examples,
      metadata,
    };
  }

  /**
   * Generate events.md content
   */
  private generateEventsMd(analyzed: AnalyzedModule): string {
    if (analyzed.events.length === 0) {
      return '';
    }

    const lines: string[] = [
      '# Events',
      '',
      `## Module: ${analyzed.moduleName}`,
      '',
      `Package: \`${analyzed.packageId}\``,
      '',
      '---',
      '',
    ];

    for (const event of analyzed.events) {
      lines.push(`## \`${event.name}\``);
      lines.push('');
      lines.push(event.description);
      lines.push('');

      if (event.fields.length > 0) {
        lines.push('| Field | Type | Description |');
        lines.push('|-------|------|-------------|');
        for (const field of event.fields) {
          lines.push(`| \`${field.name}\` | \`${field.tsType}\` | ${field.description} |`);
        }
        lines.push('');
      }

      lines.push('---');
      lines.push('');
    }

    lines.push(`*Generated by auto-sui-skills v${VERSION}*`);

    return lines.join('\n');
  }

  /**
   * Generate example code
   */
  private generateExamples(analyzed: AnalyzedModule): GeneratedExample[] {
    const examples: GeneratedExample[] = [];

    // Generate example for first entry function
    const entryFunc = analyzed.functions.find((f) => f.isEntry);
    if (entryFunc) {
      const userParams = entryFunc.parameters.filter((p) => !p.isAutoInjected);
      const paramDefs = userParams
        .map((p) => `const ${p.name} = ''; // ${p.tsType}`)
        .join('\n');

      const code = `/**
 * Example: ${entryFunc.name}
 * ${entryFunc.semantic.description}
 */

import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

const client = new SuiClient({ url: 'https://fullnode.${this.options.network}.sui.io' });
const keypair = Ed25519Keypair.fromSecretKey(/* your secret key */);

${paramDefs}

const tx = new Transaction();

tx.moveCall({
  target: '${analyzed.packageId}::${analyzed.moduleName}::${entryFunc.name}',
  arguments: [
${userParams.map((p) => `    // ${p.name}: ${p.tsType}`).join(',\n')}
  ],
});

// Sign and execute
const result = await client.signAndExecuteTransaction({
  signer: keypair,
  transaction: tx,
});

console.log('Transaction result:', result);
`;

      examples.push({
        name: entryFunc.name,
        description: entryFunc.semantic.description,
        code,
        functionName: entryFunc.name,
      });
    }

    return examples;
  }

  /**
   * Format package name
   */
  private formatPackageName(moduleName: string): string {
    return moduleName.replace(/_/g, '-').toLowerCase();
  }

  /**
   * Generate checksum for content
   */
  private generateChecksum(content: string): string {
    return createHash('sha256').update(content).digest('hex').slice(0, 16);
  }
}

/**
 * Create a main generator instance
 */
export function createMainGenerator(options: MainGeneratorOptions): MainGenerator {
  return new MainGenerator(options);
}
