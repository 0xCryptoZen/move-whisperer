/**
 * Custom Handlebars helpers
 */

import Handlebars from 'handlebars';

/**
 * Register all custom helpers
 */
export function registerHelpers(handlebars: typeof Handlebars): void {
  // Comparison helpers
  handlebars.registerHelper('eq', (a, b) => a === b);
  handlebars.registerHelper('neq', (a, b) => a !== b);
  handlebars.registerHelper('gt', (a, b) => a > b);
  handlebars.registerHelper('gte', (a, b) => a >= b);
  handlebars.registerHelper('lt', (a, b) => a < b);
  handlebars.registerHelper('lte', (a, b) => a <= b);

  // Logical helpers
  handlebars.registerHelper('and', (...args) => {
    // Remove the options object (last argument)
    const values = args.slice(0, -1);
    return values.every(Boolean);
  });

  handlebars.registerHelper('or', (...args) => {
    const values = args.slice(0, -1);
    return values.some(Boolean);
  });

  handlebars.registerHelper('not', (value) => !value);

  // Risk helpers
  handlebars.registerHelper('isHighRisk', (risk) => {
    return risk === 'high' || risk === 'critical';
  });

  handlebars.registerHelper('riskEmoji', (risk) => {
    const emojis: Record<string, string> = {
      low: '',
      medium: '',
      high: '',
      critical: '',
    };
    return emojis[risk] || '';
  });

  handlebars.registerHelper('riskBadge', (risk) => {
    const badges: Record<string, string> = {
      low: 'Low Risk',
      medium: 'Medium Risk',
      high: 'High Risk',
      critical: 'Critical Risk',
    };
    return badges[risk] || risk;
  });

  // String helpers
  handlebars.registerHelper('capitalize', (str) => {
    if (typeof str !== 'string' || !str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  });

  handlebars.registerHelper('uppercase', (str) => {
    if (typeof str !== 'string') return '';
    return str.toUpperCase();
  });

  handlebars.registerHelper('lowercase', (str) => {
    if (typeof str !== 'string') return '';
    return str.toLowerCase();
  });

  handlebars.registerHelper('snakeToTitle', (str) => {
    if (typeof str !== 'string') return '';
    return str
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  });

  handlebars.registerHelper('snakeToCamel', (str) => {
    if (typeof str !== 'string') return '';
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  });

  handlebars.registerHelper('snakeToPascal', (str) => {
    if (typeof str !== 'string') return '';
    const camel = str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    return camel.charAt(0).toUpperCase() + camel.slice(1);
  });

  handlebars.registerHelper('truncate', (str, len) => {
    if (typeof str !== 'string') return '';
    if (str.length <= len) return str;
    return str.slice(0, len) + '...';
  });

  handlebars.registerHelper('split', (str, sep) => {
    if (typeof str !== 'string') return [];
    return str.split(sep);
  });

  handlebars.registerHelper('padStart', (str, len, char = ' ') => {
    if (typeof str !== 'string') str = String(str);
    return str.padStart(len, char);
  });

  // Array helpers
  handlebars.registerHelper('first', (arr) => {
    if (!Array.isArray(arr)) return undefined;
    return arr[0];
  });

  handlebars.registerHelper('last', (arr) => {
    if (!Array.isArray(arr)) return undefined;
    return arr[arr.length - 1];
  });

  handlebars.registerHelper('join', (arr, sep = ', ') => {
    if (!Array.isArray(arr)) return '';
    return arr.join(sep);
  });

  handlebars.registerHelper('length', (arr) => {
    if (Array.isArray(arr)) return arr.length;
    if (typeof arr === 'string') return arr.length;
    return 0;
  });

  handlebars.registerHelper('isEmpty', (arr) => {
    if (Array.isArray(arr)) return arr.length === 0;
    if (typeof arr === 'string') return arr.length === 0;
    return true;
  });

  handlebars.registerHelper('slice', (arr, start, end) => {
    if (!Array.isArray(arr)) return [];
    return arr.slice(start, end);
  });

  // Filter helpers
  handlebars.registerHelper('filterUserParams', (params) => {
    if (!Array.isArray(params)) return [];
    return params.filter((p: { isAutoInjected?: boolean }) => !p.isAutoInjected);
  });

  handlebars.registerHelper('filterEntryFunctions', (functions) => {
    if (!Array.isArray(functions)) return [];
    return functions.filter((f: { isEntry?: boolean }) => f.isEntry);
  });

  handlebars.registerHelper('filterPublicFunctions', (functions) => {
    if (!Array.isArray(functions)) return [];
    return functions.filter(
      (f: { isEntry?: boolean; visibility?: string }) =>
        !f.isEntry && f.visibility === 'public'
    );
  });

  // Code generation helpers
  handlebars.registerHelper('indent', (str, spaces) => {
    if (typeof str !== 'string') return '';
    const indent = ' '.repeat(spaces);
    return str
      .split('\n')
      .map((line) => indent + line)
      .join('\n');
  });

  handlebars.registerHelper('json', (obj, pretty = true) => {
    if (pretty) {
      return JSON.stringify(obj, null, 2);
    }
    return JSON.stringify(obj);
  });

  handlebars.registerHelper('formatParam', (param) => {
    if (!param) return '';
    const optional = param.isOptional ? '?' : '';
    return `${param.name}${optional}: ${param.tsType}`;
  });

  handlebars.registerHelper('formatParams', (params) => {
    if (!Array.isArray(params)) return '';
    return params
      .filter((p: { isAutoInjected?: boolean }) => !p.isAutoInjected)
      .map((p: { name: string; isOptional?: boolean; tsType: string }) => {
        const optional = p.isOptional ? '?' : '';
        return `${p.name}${optional}: ${p.tsType}`;
      })
      .join(', ');
  });

  // Date/time helpers
  handlebars.registerHelper('now', () => new Date().toISOString());

  handlebars.registerHelper('formatDate', (date, format = 'iso') => {
    const d = new Date(date);
    if (format === 'iso') {
      return d.toISOString();
    }
    if (format === 'date') {
      return d.toLocaleDateString();
    }
    if (format === 'time') {
      return d.toLocaleTimeString();
    }
    return d.toLocaleString();
  });

  // Iteration helpers
  handlebars.registerHelper('times', (n, options) => {
    let result = '';
    for (let i = 0; i < n; i++) {
      result += options.fn({ index: i, first: i === 0, last: i === n - 1 });
    }
    return result;
  });

  // URL/path helpers
  handlebars.registerHelper('shortenAddress', (address, length = 8) => {
    if (typeof address !== 'string') return '';
    if (address.length <= length * 2 + 2) return address;
    return `${address.slice(0, length + 2)}...${address.slice(-length)}`;
  });

  // Markdown helpers
  handlebars.registerHelper('codeBlock', (code, lang = '') => {
    return `\`\`\`${lang}\n${code}\n\`\`\``;
  });

  handlebars.registerHelper('inlineCode', (code) => {
    return `\`${code}\``;
  });

  handlebars.registerHelper('link', (text, url) => {
    return `[${text}](${url})`;
  });

  // Block helpers
  handlebars.registerHelper('ifCond', function (
    this: unknown,
    v1: unknown,
    operator: string,
    v2: unknown,
    options: Handlebars.HelperOptions
  ) {
    switch (operator) {
      case '==':
        return v1 == v2 ? options.fn(this) : options.inverse(this);
      case '===':
        return v1 === v2 ? options.fn(this) : options.inverse(this);
      case '!=':
        return v1 != v2 ? options.fn(this) : options.inverse(this);
      case '!==':
        return v1 !== v2 ? options.fn(this) : options.inverse(this);
      case '<':
        return (v1 as number) < (v2 as number) ? options.fn(this) : options.inverse(this);
      case '<=':
        return (v1 as number) <= (v2 as number) ? options.fn(this) : options.inverse(this);
      case '>':
        return (v1 as number) > (v2 as number) ? options.fn(this) : options.inverse(this);
      case '>=':
        return (v1 as number) >= (v2 as number) ? options.fn(this) : options.inverse(this);
      case '&&':
        return v1 && v2 ? options.fn(this) : options.inverse(this);
      case '||':
        return v1 || v2 ? options.fn(this) : options.inverse(this);
      default:
        return options.inverse(this);
    }
  });

  // Scene-specific helpers

  // Type mapping for tx.pure calls
  handlebars.registerHelper('mapToPureType', (tsType: string) => {
    if (!tsType) return 'string';
    const typeMap: Record<string, string> = {
      'boolean': 'bool',
      'number': 'u64',
      'bigint': 'u64',
      'bigint | string': 'u64',
      'string': 'string',
      'number[]': 'vector',
      'string[]': 'vector',
    };
    return typeMap[tsType] || 'string';
  });

  // Check if struct has a specific ability
  handlebars.registerHelper('hasAbility', (abilities: string[], ability: string) => {
    if (!Array.isArray(abilities)) return false;
    return abilities.includes(ability);
  });

  // Check if category matches
  handlebars.registerHelper('hasCategory', (category: string, target: string) => {
    return category === target;
  });

  // Check if struct name indicates a capability
  handlebars.registerHelper('isCapability', (name: string) => {
    if (typeof name !== 'string') return false;
    const capPatterns = ['Cap', 'AdminCap', 'OwnerCap', 'Capability', 'Auth'];
    return capPatterns.some(p => name.includes(p));
  });

  // Check if parameters handle coins
  handlebars.registerHelper('handlesCoin', (params: Array<{tsType?: string}>) => {
    if (!Array.isArray(params)) return false;
    return params.some(p => p.tsType?.toLowerCase().includes('coin'));
  });

  // Filter coin parameters
  handlebars.registerHelper('filterCoinParams', (params: Array<{tsType?: string}>) => {
    if (!Array.isArray(params)) return [];
    return params.filter(p => p.tsType?.toLowerCase().includes('coin'));
  });

  // Check if returns contain coins
  handlebars.registerHelper('returnsCoin', (returns: Array<{tsType?: string}>) => {
    if (!Array.isArray(returns)) return false;
    return returns.some(r => r.tsType?.toLowerCase().includes('coin'));
  });

  // Filter coin returns
  handlebars.registerHelper('filterCoinReturns', (returns: Array<{tsType?: string}>) => {
    if (!Array.isArray(returns)) return [];
    return returns.filter(r => r.tsType?.toLowerCase().includes('coin'));
  });

  // Filter functions by risk level
  handlebars.registerHelper('filterByRisk', (
    functions: Array<{semantic?: {risk?: string}}>,
    risk: string
  ) => {
    if (!Array.isArray(functions)) return [];
    return functions.filter(f => f.semantic?.risk === risk);
  });

  // Check if function is admin-related
  handlebars.registerHelper('isAdminFunction', (category: string) => {
    return category === 'admin' || category === 'config';
  });

  // Check if functions have admin functions
  handlebars.registerHelper('hasAdminFunctions', (
    functions: Array<{semantic?: {category?: string}}>
  ) => {
    if (!Array.isArray(functions)) return false;
    return functions.some(f =>
      f.semantic?.category === 'admin' || f.semantic?.category === 'config'
    );
  });

  // Check if function uses arithmetic
  handlebars.registerHelper('usesArithmetic', (
    functions: Array<{semantic?: {category?: string}}>
  ) => {
    if (!Array.isArray(functions)) return false;
    return functions.some(f =>
      f.semantic?.category === 'dex' ||
      f.semantic?.category === 'transfer' ||
      f.semantic?.category === 'staking'
    );
  });

  // Check if structs have shared objects
  handlebars.registerHelper('hasSharedObjects', (structs: Array<{abilities?: string[]}>) => {
    if (!Array.isArray(structs)) return false;
    return structs.some(s => s.abilities?.includes('key'));
  });

  // Check if functions use Clock
  handlebars.registerHelper('usesClock', (
    functions: Array<{parameters?: Array<{tsType?: string}>}>
  ) => {
    if (!Array.isArray(functions)) return false;
    return functions.some(f =>
      f.parameters?.some(p => p.tsType?.includes('Clock'))
    );
  });

  // Check if functions use dynamic fields
  handlebars.registerHelper('usesDynamicFields', (
    functions: Array<{parameters?: Array<{tsType?: string}>}>
  ) => {
    if (!Array.isArray(functions)) return false;
    return functions.some(f =>
      f.parameters?.some(p =>
        p.tsType?.includes('UID') || p.tsType?.includes('ID')
      )
    );
  });

  // Check if parameter requires capability
  handlebars.registerHelper('requiresCapability', (
    params: Array<{name?: string; tsType?: string}>
  ) => {
    if (!Array.isArray(params)) return false;
    return params.some(p =>
      p.name?.toLowerCase().includes('cap') ||
      p.tsType?.includes('Cap')
    );
  });

  // Check if function modifies state
  handlebars.registerHelper('modifiesState', (
    params: Array<{objectIdRequired?: boolean}>
  ) => {
    if (!Array.isArray(params)) return false;
    return params.some(p => p.objectIdRequired);
  });

  // Check if package is immutable (placeholder - actual check would need chain query)
  handlebars.registerHelper('isImmutable', () => false);

  // Check if function is create-type
  handlebars.registerHelper('isCreateFunction', (category: string) => {
    return category === 'create';
  });

  // Check if params use a specific type
  handlebars.registerHelper('usesType', (
    params: Array<{tsType?: string}>,
    typeName: string
  ) => {
    if (!Array.isArray(params)) return false;
    return params.some(p => p.tsType?.includes(typeName));
  });

  // Gas estimation based on category
  handlebars.registerHelper('gasEstimate', (category: string) => {
    const estimates: Record<string, string> = {
      dex: '~10-50M',
      transfer: '~5-10M',
      create: '~10-20M',
      admin: '~5-15M',
      query: '~1-5M',
      unknown: '~5-20M',
    };
    return estimates[category] || estimates.unknown;
  });

  // Gas optimization tips based on category
  handlebars.registerHelper('gasOptimizationTip', (category: string) => {
    const tips: Record<string, string> = {
      dex: 'Batch swaps in single PTB',
      transfer: 'Merge coins before transfer',
      create: 'Reuse objects when possible',
      admin: 'Batch admin operations',
      query: 'Use devInspect for reads',
      unknown: 'Use PTB for batching',
    };
    return tips[category] || tips.unknown;
  });

  // Frequency estimation for bot operations
  handlebars.registerHelper('frequencyEstimate', (category: string) => {
    const freq: Record<string, string> = {
      dex: 'High',
      transfer: 'Medium',
      create: 'Low',
      admin: 'Rare',
      query: 'High',
      unknown: 'Variable',
    };
    return freq[category] || freq.unknown;
  });

  // Format Move type for documentation
  handlebars.registerHelper('formatMoveType', (moveType: unknown) => {
    if (!moveType) return 'unknown';
    if (typeof moveType === 'string') return moveType;
    if (typeof moveType === 'object') {
      // Handle normalized move type objects
      const mt = moveType as Record<string, unknown>;
      if (mt.Struct) {
        const s = mt.Struct as {address: string; module: string; name: string};
        return `${s.address}::${s.module}::${s.name}`;
      }
      if (mt.Vector) {
        return `vector<${formatMoveTypeHelper(mt.Vector)}>`;
      }
      if (mt.Reference) {
        return `&${formatMoveTypeHelper(mt.Reference)}`;
      }
      if (mt.MutableReference) {
        return `&mut ${formatMoveTypeHelper(mt.MutableReference)}`;
      }
      // Primitive types
      const primitives = ['Bool', 'U8', 'U16', 'U32', 'U64', 'U128', 'U256', 'Address', 'Signer'];
      for (const p of primitives) {
        if (p in mt) return p.toLowerCase();
      }
    }
    return JSON.stringify(moveType);
  });
}

// Helper function for recursive move type formatting
function formatMoveTypeHelper(moveType: unknown): string {
  if (!moveType) return 'unknown';
  if (typeof moveType === 'string') return moveType;
  if (typeof moveType === 'object') {
    const mt = moveType as Record<string, unknown>;
    if (mt.Struct) {
      const s = mt.Struct as {address: string; module: string; name: string};
      return `${s.address}::${s.module}::${s.name}`;
    }
    if (mt.Vector) {
      return `vector<${formatMoveTypeHelper(mt.Vector)}>`;
    }
    const primitives = ['Bool', 'U8', 'U16', 'U32', 'U64', 'U128', 'U256', 'Address', 'Signer'];
    for (const p of primitives) {
      if (p in mt) return p.toLowerCase();
    }
  }
  return 'unknown';
}
