/**
 * Structural (ABI) differ for comparing Move module interfaces
 */

import type {
  SuiNormalizedModule,
  SuiNormalizedFunction,
  SuiNormalizedStruct,
  SuiMoveNormalizedType,
} from '../types/index.js';
import type {
  ABIChange,
  StructuralDiff,
  StructuralDiffSummary,
} from './types.js';

export class StructuralDiffer {
  /**
   * Compare two modules and return all ABI changes
   */
  compareModules(
    before: SuiNormalizedModule,
    after: SuiNormalizedModule
  ): ABIChange[] {
    const changes: ABIChange[] = [];

    // Compare functions
    changes.push(...this.compareFunctions(before, after));

    // Compare structs
    changes.push(...this.compareStructs(before, after));

    return changes;
  }

  /**
   * Compare multiple modules (full package comparison)
   */
  comparePackages(
    beforeModules: Record<string, SuiNormalizedModule>,
    afterModules: Record<string, SuiNormalizedModule>,
    fromVersion: number,
    toVersion: number,
    fromPackageId: string,
    toPackageId: string
  ): StructuralDiff {
    const changes: ABIChange[] = [];
    const changesByModule: Record<string, ABIChange[]> = {};

    const allModuleNames = new Set([
      ...Object.keys(beforeModules),
      ...Object.keys(afterModules),
    ]);

    for (const moduleName of allModuleNames) {
      const before = beforeModules[moduleName];
      const after = afterModules[moduleName];
      const moduleChanges: ABIChange[] = [];

      if (!before && after) {
        // Module added
        moduleChanges.push({
          type: 'added',
          category: 'module',
          name: moduleName,
          moduleName,
          risk: 'non_breaking',
          description: `Module "${moduleName}" was added`,
        });

        // Also record all functions and structs as added
        for (const [funcName] of Object.entries(after.exposedFunctions)) {
          moduleChanges.push({
            type: 'added',
            category: 'function',
            name: funcName,
            moduleName,
            risk: 'non_breaking',
            description: `Function "${funcName}" was added in new module`,
          });
        }
        for (const [structName] of Object.entries(after.structs)) {
          moduleChanges.push({
            type: 'added',
            category: 'struct',
            name: structName,
            moduleName,
            risk: 'non_breaking',
            description: `Struct "${structName}" was added in new module`,
          });
        }
      } else if (before && !after) {
        // Module removed
        moduleChanges.push({
          type: 'removed',
          category: 'module',
          name: moduleName,
          moduleName,
          risk: 'breaking',
          description: `Module "${moduleName}" was removed`,
        });
      } else if (before && after) {
        // Module exists in both - compare contents
        const modChanges = this.compareModules(before, after);
        for (const change of modChanges) {
          change.moduleName = moduleName;
          moduleChanges.push(change);
        }
      }

      if (moduleChanges.length > 0) {
        changesByModule[moduleName] = moduleChanges;
        changes.push(...moduleChanges);
      }
    }

    const summary = this.calculateSummary(changes);

    return {
      fromVersion,
      toVersion,
      fromPackageId,
      toPackageId,
      summary,
      changes,
      changesByModule,
    };
  }

  /**
   * Compare functions between two modules
   */
  private compareFunctions(
    before: SuiNormalizedModule,
    after: SuiNormalizedModule
  ): ABIChange[] {
    const changes: ABIChange[] = [];
    const beforeFuncs = before.exposedFunctions;
    const afterFuncs = after.exposedFunctions;

    const allFuncNames = new Set([
      ...Object.keys(beforeFuncs),
      ...Object.keys(afterFuncs),
    ]);

    for (const funcName of allFuncNames) {
      const beforeFunc = beforeFuncs[funcName];
      const afterFunc = afterFuncs[funcName];

      if (!beforeFunc && afterFunc) {
        // Function added
        changes.push({
          type: 'added',
          category: 'function',
          name: funcName,
          risk: 'non_breaking',
          description: `Function "${funcName}" was added`,
          details: {
            after: this.describeFunctionSignature(afterFunc),
            changes: ['New function'],
          },
        });
      } else if (beforeFunc && !afterFunc) {
        // Function removed
        changes.push({
          type: 'removed',
          category: 'function',
          name: funcName,
          risk: 'breaking',
          description: `Function "${funcName}" was removed`,
          details: {
            before: this.describeFunctionSignature(beforeFunc),
            changes: ['Function removed'],
          },
        });
      } else if (beforeFunc && afterFunc) {
        // Function exists in both - check for modifications
        const funcChanges = this.compareFunctionSignatures(
          funcName,
          beforeFunc,
          afterFunc
        );
        if (funcChanges) {
          changes.push(funcChanges);
        }
      }
    }

    return changes;
  }

  /**
   * Compare two function signatures
   */
  private compareFunctionSignatures(
    name: string,
    before: SuiNormalizedFunction,
    after: SuiNormalizedFunction
  ): ABIChange | null {
    const changesDesc: string[] = [];
    let isBreaking = false;

    // Compare visibility
    if (before.visibility !== after.visibility) {
      changesDesc.push(`Visibility: ${before.visibility} → ${after.visibility}`);
      if (before.visibility === 'Public' && after.visibility !== 'Public') {
        isBreaking = true;
      }
    }

    // Compare entry flag
    if (before.isEntry !== after.isEntry) {
      changesDesc.push(`Entry: ${before.isEntry} → ${after.isEntry}`);
      if (before.isEntry && !after.isEntry) {
        isBreaking = true;
      }
    }

    // Compare type parameters count
    if (before.typeParameters.length !== after.typeParameters.length) {
      changesDesc.push(
        `Type parameters: ${before.typeParameters.length} → ${after.typeParameters.length}`
      );
      isBreaking = true;
    }

    // Compare parameters
    if (!this.areTypesEqual(before.parameters, after.parameters)) {
      changesDesc.push('Parameters changed');
      isBreaking = true;
    }

    // Compare return types
    if (!this.areTypesEqual(before.return, after.return)) {
      changesDesc.push('Return type changed');
      isBreaking = true;
    }

    if (changesDesc.length === 0) {
      return null;
    }

    return {
      type: 'modified',
      category: 'function',
      name,
      risk: isBreaking ? 'breaking' : 'non_breaking',
      description: `Function "${name}" signature changed`,
      details: {
        before: this.describeFunctionSignature(before),
        after: this.describeFunctionSignature(after),
        changes: changesDesc,
      },
    };
  }

  /**
   * Compare structs between two modules
   */
  private compareStructs(
    before: SuiNormalizedModule,
    after: SuiNormalizedModule
  ): ABIChange[] {
    const changes: ABIChange[] = [];
    const beforeStructs = before.structs;
    const afterStructs = after.structs;

    const allStructNames = new Set([
      ...Object.keys(beforeStructs),
      ...Object.keys(afterStructs),
    ]);

    for (const structName of allStructNames) {
      const beforeStruct = beforeStructs[structName];
      const afterStruct = afterStructs[structName];

      if (!beforeStruct && afterStruct) {
        // Struct added
        changes.push({
          type: 'added',
          category: 'struct',
          name: structName,
          risk: 'non_breaking',
          description: `Struct "${structName}" was added`,
          details: {
            after: this.describeStruct(afterStruct),
            changes: ['New struct'],
          },
        });
      } else if (beforeStruct && !afterStruct) {
        // Struct removed
        changes.push({
          type: 'removed',
          category: 'struct',
          name: structName,
          risk: 'breaking',
          description: `Struct "${structName}" was removed`,
          details: {
            before: this.describeStruct(beforeStruct),
            changes: ['Struct removed'],
          },
        });
      } else if (beforeStruct && afterStruct) {
        // Struct exists in both - check for modifications
        const structChanges = this.compareStructDefinitions(
          structName,
          beforeStruct,
          afterStruct
        );
        if (structChanges) {
          changes.push(structChanges);
        }
      }
    }

    return changes;
  }

  /**
   * Compare two struct definitions
   */
  private compareStructDefinitions(
    name: string,
    before: SuiNormalizedStruct,
    after: SuiNormalizedStruct
  ): ABIChange | null {
    const changesDesc: string[] = [];
    let isBreaking = false;

    // Compare abilities
    const beforeAbilities = new Set(before.abilities.abilities);
    const afterAbilities = new Set(after.abilities.abilities);

    for (const ability of beforeAbilities) {
      if (!afterAbilities.has(ability)) {
        changesDesc.push(`Removed ability: ${ability}`);
        isBreaking = true;
      }
    }
    for (const ability of afterAbilities) {
      if (!beforeAbilities.has(ability)) {
        changesDesc.push(`Added ability: ${ability}`);
      }
    }

    // Compare type parameters
    if (before.typeParameters.length !== after.typeParameters.length) {
      changesDesc.push(
        `Type parameters: ${before.typeParameters.length} → ${after.typeParameters.length}`
      );
      isBreaking = true;
    }

    // Compare fields
    const beforeFields = new Map(before.fields.map((f) => [f.name, f]));
    const afterFields = new Map(after.fields.map((f) => [f.name, f]));

    for (const [fieldName, beforeField] of beforeFields) {
      const afterField = afterFields.get(fieldName);
      if (!afterField) {
        changesDesc.push(`Removed field: ${fieldName}`);
        isBreaking = true;
      } else if (!this.isTypeEqual(beforeField.type, afterField.type)) {
        changesDesc.push(`Field "${fieldName}" type changed`);
        isBreaking = true;
      }
    }

    for (const [fieldName] of afterFields) {
      if (!beforeFields.has(fieldName)) {
        changesDesc.push(`Added field: ${fieldName}`);
        // Adding fields can be breaking for deserialization
        isBreaking = true;
      }
    }

    if (changesDesc.length === 0) {
      return null;
    }

    return {
      type: 'modified',
      category: 'struct',
      name,
      risk: isBreaking ? 'breaking' : 'non_breaking',
      description: `Struct "${name}" definition changed`,
      details: {
        before: this.describeStruct(before),
        after: this.describeStruct(after),
        changes: changesDesc,
      },
    };
  }

  /**
   * Check if two type arrays are equal
   */
  private areTypesEqual(
    types1: SuiMoveNormalizedType[],
    types2: SuiMoveNormalizedType[]
  ): boolean {
    if (types1.length !== types2.length) {
      return false;
    }
    return types1.every((t1, i) => this.isTypeEqual(t1, types2[i]));
  }

  /**
   * Check if two types are equal
   */
  private isTypeEqual(
    type1: SuiMoveNormalizedType,
    type2: SuiMoveNormalizedType
  ): boolean {
    // Simple comparison - serialize to JSON and compare
    return JSON.stringify(type1) === JSON.stringify(type2);
  }

  /**
   * Describe a function signature for display
   */
  private describeFunctionSignature(func: SuiNormalizedFunction): string {
    const params = func.parameters.map((p) => this.describeType(p)).join(', ');
    const returns =
      func.return.length > 0
        ? `: ${func.return.map((r) => this.describeType(r)).join(', ')}`
        : '';
    const visibility = func.visibility.toLowerCase();
    const entry = func.isEntry ? ' entry' : '';
    const typeParams =
      func.typeParameters.length > 0
        ? `<${func.typeParameters.map((_, i) => `T${i}`).join(', ')}>`
        : '';

    return `${visibility}${entry} fun${typeParams}(${params})${returns}`;
  }

  /**
   * Describe a struct for display
   */
  private describeStruct(struct: SuiNormalizedStruct): string {
    const abilities = struct.abilities.abilities.join(', ');
    const typeParams =
      struct.typeParameters.length > 0
        ? `<${struct.typeParameters.map((_, i) => `T${i}`).join(', ')}>`
        : '';
    const fields = struct.fields
      .map((f) => `${f.name}: ${this.describeType(f.type)}`)
      .join(', ');

    return `struct${typeParams} has ${abilities} { ${fields} }`;
  }

  /**
   * Describe a type for display
   */
  private describeType(type: SuiMoveNormalizedType): string {
    if (typeof type === 'string') {
      return type;
    }
    if ('Vector' in type) {
      return `vector<${this.describeType(type.Vector)}>`;
    }
    if ('Struct' in type) {
      const s = type.Struct;
      const typeArgs =
        s.typeArguments.length > 0
          ? `<${s.typeArguments.map((t) => this.describeType(t)).join(', ')}>`
          : '';
      return `${s.address}::${s.module}::${s.name}${typeArgs}`;
    }
    if ('TypeParameter' in type) {
      return `T${type.TypeParameter}`;
    }
    if ('Reference' in type) {
      return `&${this.describeType(type.Reference)}`;
    }
    if ('MutableReference' in type) {
      return `&mut ${this.describeType(type.MutableReference)}`;
    }
    return JSON.stringify(type);
  }

  /**
   * Calculate summary statistics from changes
   */
  private calculateSummary(changes: ABIChange[]): StructuralDiffSummary {
    let functionsAdded = 0;
    let functionsRemoved = 0;
    let functionsModified = 0;
    let structsAdded = 0;
    let structsRemoved = 0;
    let structsModified = 0;
    let modulesAdded = 0;
    let modulesRemoved = 0;
    let breakingChanges = false;

    for (const change of changes) {
      if (change.risk === 'breaking') {
        breakingChanges = true;
      }

      switch (change.category) {
        case 'function':
          if (change.type === 'added') functionsAdded++;
          else if (change.type === 'removed') functionsRemoved++;
          else if (change.type === 'modified') functionsModified++;
          break;
        case 'struct':
          if (change.type === 'added') structsAdded++;
          else if (change.type === 'removed') structsRemoved++;
          else if (change.type === 'modified') structsModified++;
          break;
        case 'module':
          if (change.type === 'added') modulesAdded++;
          else if (change.type === 'removed') modulesRemoved++;
          break;
      }
    }

    return {
      functionsAdded,
      functionsRemoved,
      functionsModified,
      structsAdded,
      structsRemoved,
      structsModified,
      modulesAdded,
      modulesRemoved,
      breakingChanges,
      totalChanges: changes.length,
    };
  }

  /**
   * Check if a change is breaking
   */
  isBreakingChange(change: ABIChange): boolean {
    return change.risk === 'breaking';
  }

  /**
   * Filter for breaking changes only
   */
  getBreakingChanges(changes: ABIChange[]): ABIChange[] {
    return changes.filter((c) => this.isBreakingChange(c));
  }
}

/**
 * Create a new StructuralDiffer
 */
export function createStructuralDiffer(): StructuralDiffer {
  return new StructuralDiffer();
}
