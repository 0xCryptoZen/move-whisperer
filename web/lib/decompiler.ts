/**
 * Move Bytecode Decompiler
 * Converts disassembled Move bytecode into readable pseudo-code
 */

export interface DecompiledFunction {
  name: string;
  visibility: string;
  typeParams: string[];
  params: { name: string; type: string }[];
  returnType: string;
  body: string;
  originalBytecode: string;
}

export interface DecompiledModule {
  moduleName: string;
  structs: DecompiledStruct[];
  functions: DecompiledFunction[];
}

export interface DecompiledStruct {
  name: string;
  abilities: string[];
  fields: { name: string; type: string }[];
}

/**
 * Decompile Move bytecode into readable pseudo-code
 */
export function decompileBytecode(bytecode: string): DecompiledModule {
  const lines = bytecode.split('\n');
  const moduleName = extractModuleName(lines);
  const structs = extractStructs(lines);
  const functions = extractAndDecompileFunctions(bytecode);

  return {
    moduleName,
    structs,
    functions,
  };
}

/**
 * Extract module name from bytecode
 */
function extractModuleName(lines: string[]): string {
  for (const line of lines) {
    const match = line.match(/^module\s+[\w.]+\.(\w+)\s*\{/);
    if (match) {
      return match[1];
    }
  }
  return 'unknown';
}

/**
 * Extract struct definitions
 */
function extractStructs(lines: string[]): DecompiledStruct[] {
  const structs: DecompiledStruct[] = [];
  let currentStruct: DecompiledStruct | null = null;
  let inStruct = false;
  let braceCount = 0;

  for (const line of lines) {
    const structMatch = line.match(/^struct\s+(\w+)(?:<[^>]+>)?\s+has\s+([\w,\s]+)\s*\{/);
    if (structMatch) {
      currentStruct = {
        name: structMatch[1],
        abilities: structMatch[2].split(',').map(a => a.trim()),
        fields: [],
      };
      inStruct = true;
      braceCount = 1;
      continue;
    }

    // Also match structs without abilities
    const structMatchNoAbilities = line.match(/^struct\s+(\w+)(?:<[^>]+>)?\s*\{/);
    if (structMatchNoAbilities && !inStruct) {
      currentStruct = {
        name: structMatchNoAbilities[1],
        abilities: [],
        fields: [],
      };
      inStruct = true;
      braceCount = 1;
      continue;
    }

    if (inStruct && currentStruct) {
      const fieldMatch = line.match(/^\s*(\w+):\s*(.+?),?\s*$/);
      if (fieldMatch) {
        currentStruct.fields.push({
          name: fieldMatch[1],
          type: cleanType(fieldMatch[2]),
        });
      }

      if (line.includes('}')) {
        braceCount--;
        if (braceCount <= 0) {
          structs.push(currentStruct);
          currentStruct = null;
          inStruct = false;
        }
      }
    }
  }

  return structs;
}

/**
 * Extract and decompile functions
 */
function extractAndDecompileFunctions(bytecode: string): DecompiledFunction[] {
  const functions: DecompiledFunction[] = [];

  // Split by function patterns
  const funcBlocks = bytecode.split(/\n(?=(?:public|entry|friend|private)\s)/);

  for (const block of funcBlocks) {
    const func = parseFunction(block);
    if (func) {
      functions.push(func);
    }
  }

  return functions;
}

/**
 * Parse a single function block
 */
function parseFunction(block: string): DecompiledFunction | null {
  const lines = block.split('\n');
  const firstLine = lines[0];

  // Match function signature
  const sigMatch = firstLine.match(/^(public(?:\s+entry)?|entry|friend|private)?\s*(\w+)(?:<([^>]+)>)?\(([^)]*)\)(?:\s*:\s*([^\{]+))?/);
  if (!sigMatch) return null;

  const visibility = sigMatch[1] || 'private';
  const name = sigMatch[2];
  const typeParamsStr = sigMatch[3] || '';
  const paramsStr = sigMatch[4] || '';
  const returnType = sigMatch[5]?.trim() || 'void';

  // Skip if it looks like a struct or module definition
  if (['module', 'struct', 'use', 'const'].includes(name)) return null;

  // Parse type parameters
  const typeParams = typeParamsStr ? typeParamsStr.split(',').map(t => t.trim()) : [];

  // Parse parameters
  const params = parseParams(paramsStr);

  // Extract and decompile body
  const bodyLines = lines.slice(1);
  const originalBytecode = bodyLines.join('\n');
  const body = decompileFunctionBody(bodyLines, params, name);

  return {
    name,
    visibility,
    typeParams,
    params,
    returnType: cleanType(returnType),
    body,
    originalBytecode,
  };
}

/**
 * Parse function parameters
 */
function parseParams(paramsStr: string): { name: string; type: string }[] {
  if (!paramsStr.trim()) return [];

  const params: { name: string; type: string }[] = [];

  // Handle nested generics properly
  let depth = 0;
  let current = '';

  for (const char of paramsStr) {
    if (char === '<') depth++;
    if (char === '>') depth--;
    if (char === ',' && depth === 0) {
      const match = current.match(/(\w+):\s*(.+)/);
      if (match) {
        params.push({
          name: match[1],
          type: cleanType(match[2]),
        });
      }
      current = '';
    } else {
      current += char;
    }
  }

  // Handle last parameter
  if (current.trim()) {
    const match = current.match(/(\w+):\s*(.+)/);
    if (match) {
      params.push({
        name: match[1],
        type: cleanType(match[2]),
      });
    }
  }

  return params;
}

/**
 * Decompile function body from bytecode instructions
 */
function decompileFunctionBody(
  lines: string[],
  params: { name: string; type: string }[],
  funcName: string
): string {
  const statements: string[] = [];
  const locals: Map<string, string> = new Map();
  const stack: string[] = [];
  let localCounter = 0;

  // Initialize params in locals
  params.forEach((p, i) => {
    locals.set(`Arg${i}`, p.name);
  });

  // Parse local variable declarations
  for (const line of lines) {
    const localMatch = line.match(/^L(\d+):\s*loc\d+:\s*(.+)$/);
    if (localMatch) {
      const varName = generateVarName(localMatch[2], localCounter++);
      locals.set(`L${localMatch[1]}`, varName);
    }
  }

  // Process bytecode instructions
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('L') || trimmed.startsWith('B')) continue;

    const instrMatch = trimmed.match(/^\d+:\s*(\w+)(?:\[([^\]]*)\])?(?:\(([^)]*)\))?$/);
    if (!instrMatch) continue;

    const [, opcode, operand, annotation] = instrMatch;
    processInstruction(opcode, operand, annotation, locals, stack, statements);
  }

  // Format the body
  if (statements.length === 0) {
    return '    // Complex bytecode - see original for details';
  }

  return statements.map(s => `    ${s}`).join('\n');
}

/**
 * Process a single bytecode instruction
 */
function processInstruction(
  opcode: string,
  operand: string | undefined,
  annotation: string | undefined,
  locals: Map<string, string>,
  stack: string[],
  statements: string[]
): void {
  switch (opcode) {
    case 'CopyLoc':
    case 'MoveLoc': {
      const varName = getLocalName(operand, annotation, locals);
      stack.push(varName);
      break;
    }

    case 'ImmBorrowLoc':
    case 'MutBorrowLoc': {
      const varName = getLocalName(operand, annotation, locals);
      const prefix = opcode === 'MutBorrowLoc' ? '&mut ' : '&';
      stack.push(`${prefix}${varName}`);
      break;
    }

    case 'StLoc': {
      const value = stack.pop() || '?';
      const varName = getLocalName(operand, annotation, locals);
      // Avoid duplicate let statements
      if (!statements.some(s => s.startsWith(`let ${varName} =`))) {
        statements.push(`let ${varName} = ${value};`);
      } else {
        statements.push(`${varName} = ${value};`);
      }
      break;
    }

    case 'Call': {
      const funcCall = parseCallAnnotation(annotation);
      if (funcCall) {
        const { module, func, returnType, argCount } = funcCall;
        const args = [];
        for (let i = 0; i < argCount; i++) {
          args.unshift(stack.pop() || '?');
        }

        const callExpr = `${module}::${func}(${args.join(', ')})`;

        if (returnType && returnType !== '()') {
          stack.push(callExpr);
        } else {
          statements.push(`${callExpr};`);
        }
      }
      break;
    }

    case 'Pack': {
      const structInfo = parsePackAnnotation(annotation);
      if (structInfo) {
        stack.push(`${structInfo.name} { ... }`);
      }
      break;
    }

    case 'Unpack': {
      const structInfo = parsePackAnnotation(annotation);
      if (structInfo) {
        const value = stack.pop() || '?';
        statements.push(`let ${structInfo.name} { ... } = ${value};`);
      }
      break;
    }

    case 'Ret': {
      const returnVal = stack.pop();
      if (returnVal) {
        statements.push(`return ${returnVal};`);
      } else {
        statements.push('return;');
      }
      break;
    }

    case 'FreezeRef': {
      const val = stack.pop();
      if (val?.startsWith('&mut ')) {
        stack.push(val.replace('&mut ', '&'));
      } else {
        stack.push(val || '?');
      }
      break;
    }

    case 'LdU8':
    case 'LdU16':
    case 'LdU32':
    case 'LdU64':
    case 'LdU128':
    case 'LdU256': {
      stack.push(operand || '0');
      break;
    }

    case 'LdTrue':
      stack.push('true');
      break;

    case 'LdFalse':
      stack.push('false');
      break;

    case 'LdConst': {
      stack.push(annotation || 'CONST');
      break;
    }

    case 'Pop': {
      const val = stack.pop();
      if (val && !val.startsWith('?')) {
        statements.push(`_ = ${val};`);
      }
      break;
    }

    case 'BrTrue':
    case 'BrFalse': {
      const cond = stack.pop();
      if (cond) {
        const keyword = opcode === 'BrTrue' ? 'if' : 'if !';
        statements.push(`${keyword}(${cond}) { /* branch */ }`);
      }
      break;
    }

    case 'Branch': {
      statements.push('// jump');
      break;
    }

    case 'Abort': {
      const code = stack.pop() || '?';
      statements.push(`abort ${code};`);
      break;
    }

    case 'ImmBorrowField':
    case 'MutBorrowField': {
      const obj = stack.pop() || '?';
      const fieldName = annotation?.match(/\.(\w+)/)?.[1] || 'field';
      const prefix = opcode === 'MutBorrowField' ? '&mut ' : '&';
      stack.push(`${prefix}${obj}.${fieldName}`);
      break;
    }

    case 'ReadRef': {
      const ref = stack.pop() || '?';
      stack.push(`*${ref}`);
      break;
    }

    case 'WriteRef': {
      const value = stack.pop() || '?';
      const ref = stack.pop() || '?';
      statements.push(`*${ref} = ${value};`);
      break;
    }

    case 'Add':
    case 'Sub':
    case 'Mul':
    case 'Div':
    case 'Mod': {
      const b = stack.pop() || '?';
      const a = stack.pop() || '?';
      const op = { Add: '+', Sub: '-', Mul: '*', Div: '/', Mod: '%' }[opcode];
      stack.push(`(${a} ${op} ${b})`);
      break;
    }

    case 'Lt':
    case 'Le':
    case 'Gt':
    case 'Ge':
    case 'Eq':
    case 'Neq': {
      const b = stack.pop() || '?';
      const a = stack.pop() || '?';
      const op = { Lt: '<', Le: '<=', Gt: '>', Ge: '>=', Eq: '==', Neq: '!=' }[opcode];
      stack.push(`(${a} ${op} ${b})`);
      break;
    }

    case 'And': {
      const b = stack.pop() || '?';
      const a = stack.pop() || '?';
      stack.push(`(${a} && ${b})`);
      break;
    }

    case 'Or': {
      const b = stack.pop() || '?';
      const a = stack.pop() || '?';
      stack.push(`(${a} || ${b})`);
      break;
    }

    case 'Not': {
      const a = stack.pop() || '?';
      stack.push(`!${a}`);
      break;
    }

    case 'CastU8':
    case 'CastU16':
    case 'CastU32':
    case 'CastU64':
    case 'CastU128':
    case 'CastU256': {
      const val = stack.pop() || '?';
      const targetType = opcode.replace('Cast', '').toLowerCase();
      stack.push(`(${val} as ${targetType})`);
      break;
    }

    case 'VecPack': {
      const count = parseInt(operand || '0', 10);
      const elements = [];
      for (let i = 0; i < count; i++) {
        elements.unshift(stack.pop() || '?');
      }
      stack.push(`vector[${elements.join(', ')}]`);
      break;
    }

    case 'VecLen': {
      const vec = stack.pop() || '?';
      stack.push(`${vec}.length()`);
      break;
    }

    case 'VecImmBorrow':
    case 'VecMutBorrow': {
      const idx = stack.pop() || '?';
      const vec = stack.pop() || '?';
      const prefix = opcode === 'VecMutBorrow' ? '&mut ' : '&';
      stack.push(`${prefix}${vec}[${idx}]`);
      break;
    }

    case 'VecPushBack': {
      const val = stack.pop() || '?';
      const vec = stack.pop() || '?';
      statements.push(`${vec}.push_back(${val});`);
      break;
    }

    case 'VecPopBack': {
      const vec = stack.pop() || '?';
      stack.push(`${vec}.pop_back()`);
      break;
    }

    default:
      // Unknown opcode - skip silently to avoid noise
      break;
  }
}

/**
 * Get local variable name
 */
function getLocalName(
  operand: string | undefined,
  annotation: string | undefined,
  locals: Map<string, string>
): string {
  if (annotation) {
    // Try to extract from annotation like "Arg0: &mut TxContext"
    const match = annotation.match(/^(\w+):/);
    if (match) {
      const key = match[1];
      if (locals.has(key)) {
        return locals.get(key)!;
      }
      // It's a new variable name from annotation
      return key.toLowerCase();
    }
  }
  if (operand) {
    return locals.get(operand) || operand.toLowerCase();
  }
  return 'var';
}

/**
 * Parse Call annotation to extract function info
 */
function parseCallAnnotation(annotation: string | undefined): {
  module: string;
  func: string;
  returnType: string;
  argCount: number;
} | null {
  if (!annotation) return null;

  // Pattern: module::func<TypeArgs>(ArgTypes): ReturnType
  const match = annotation.match(/(\w+)::(\w+)(?:<[^>]+>)?\(([^)]*)\)(?::\s*(.+))?/);
  if (!match) return null;

  const argTypes = match[3] ? match[3].split(',').filter(a => a.trim()) : [];

  return {
    module: match[1],
    func: match[2],
    returnType: match[4]?.trim() || '',
    argCount: argTypes.length,
  };
}

/**
 * Parse Pack annotation
 */
function parsePackAnnotation(annotation: string | undefined): { name: string } | null {
  if (!annotation) return null;
  const match = annotation.match(/(\w+)(?:<|$)/);
  return match ? { name: match[1] } : null;
}

/**
 * Generate variable name from type with enhanced inference
 */
function generateVarName(type: string, index: number, context?: { funcName?: string; paramIndex?: number }): string {
  const cleanedType = type.replace(/<.*>/, '').trim();
  const parts = cleanedType.split('::');
  const typeName = parts[parts.length - 1];

  // Extract generic type parameter if present
  const genericMatch = type.match(/<([^<>]+)>/);
  const genericType = genericMatch ? genericMatch[1].split('::').pop() : null;

  // Enhanced name mapping with semantic context
  const nameMap: Record<string, string> = {
    // Object types
    'UID': 'uid',
    'ID': 'id',
    'Bag': 'bag',
    'Table': 'table',
    'VecSet': 'vec_set',
    'VecMap': 'vec_map',
    'ObjectBag': 'object_bag',
    'ObjectTable': 'object_table',
    'LinkedTable': 'linked_table',

    // Token types
    'Coin': genericType ? `${genericType.toLowerCase()}_coin` : 'coin',
    'Balance': genericType ? `${genericType.toLowerCase()}_balance` : 'balance',
    'TreasuryCap': 'treasury_cap',
    'CoinMetadata': 'coin_metadata',
    'Supply': 'supply',

    // Common types
    'TxContext': 'ctx',
    'address': 'recipient',
    'u64': 'amount',
    'u128': 'value',
    'u256': 'big_value',
    'u8': 'byte_val',
    'u16': 'short_val',
    'u32': 'int_val',
    'bool': 'is_valid',
    'String': 'name',
    'Url': 'url',
    'Option': genericType ? `maybe_${genericType.toLowerCase()}` : 'option',

    // Vector types
    'vector': genericType ? `${genericType.toLowerCase()}_list` : 'items',

    // Capability types
    'AdminCap': 'admin_cap',
    'OwnerCap': 'owner_cap',
    'UpgradeCap': 'upgrade_cap',
    'Publisher': 'publisher',

    // Clock & time
    'Clock': 'clock',

    // DeFi common types
    'Pool': 'pool',
    'Position': 'position',
    'Liquidity': 'liquidity',
    'Oracle': 'oracle',
    'PriceInfo': 'price_info',
  };

  // Context-aware naming based on function name
  if (context?.funcName) {
    const funcLower = context.funcName.toLowerCase();

    // Transfer functions
    if (funcLower.includes('transfer') && typeName === 'address') {
      return index > 0 ? `recipient_${index}` : 'recipient';
    }

    // Deposit/withdraw functions
    if (funcLower.includes('deposit') || funcLower.includes('withdraw')) {
      if (typeName === 'u64') return index > 0 ? `amount_${index}` : 'amount';
      if (typeName === 'Coin') return index > 0 ? `deposit_coin_${index}` : 'deposit_coin';
    }

    // Swap functions
    if (funcLower.includes('swap')) {
      if (context.paramIndex === 0 && typeName === 'Coin') return 'coin_in';
      if (context.paramIndex === 1 && typeName === 'Coin') return 'coin_out';
      if (typeName === 'u64') return index > 0 ? `min_out_${index}` : 'min_amount_out';
    }

    // Mint functions
    if (funcLower.includes('mint')) {
      if (typeName === 'u64') return 'mint_amount';
      if (typeName === 'TreasuryCap') return 'treasury';
    }

    // Burn functions
    if (funcLower.includes('burn')) {
      if (typeName === 'Coin') return 'burn_coin';
    }
  }

  const baseName = nameMap[typeName] || typeName.toLowerCase().replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
  return index > 0 ? `${baseName}_${index}` : baseName;
}

/**
 * Clean type string
 */
function cleanType(type: string): string {
  return type
    .replace(/\s+/g, ' ')
    .replace(/^\s+|\s+$/g, '')
    .replace(/,\s*/g, ', ')
    .replace(/,\s*$/, '');
}

/**
 * Convert decompiled module to Move source code string
 */
export function toMoveSource(module: DecompiledModule): string {
  const lines: string[] = [];

  lines.push(`// Decompiled Move module: ${module.moduleName}`);
  lines.push(`// Note: Variable names and comments are approximated`);
  lines.push('');
  lines.push(`module ${module.moduleName} {`);
  lines.push('');

  // Structs
  for (const struct of module.structs) {
    const abilities = struct.abilities.length > 0
      ? ` has ${struct.abilities.join(', ')}`
      : '';
    lines.push(`    struct ${struct.name}${abilities} {`);
    for (const field of struct.fields) {
      lines.push(`        ${field.name}: ${field.type},`);
    }
    lines.push('    }');
    lines.push('');
  }

  // Functions
  for (const func of module.functions) {
    const typeParams = func.typeParams.length > 0
      ? `<${func.typeParams.join(', ')}>`
      : '';
    const params = func.params.map(p => `${p.name}: ${p.type}`).join(', ');
    const returnType = func.returnType !== 'void' ? `: ${func.returnType}` : '';

    lines.push(`    ${func.visibility} fun ${func.name}${typeParams}(${params})${returnType} {`);
    lines.push(func.body || '        // ...');
    lines.push('    }');
    lines.push('');
  }

  lines.push('}');

  return lines.join('\n');
}

/**
 * Quick decompile function - main entry point
 */
export function decompileToMove(bytecode: string): string {
  try {
    const module = decompileBytecode(bytecode);
    return toMoveSource(module);
  } catch (error) {
    // If decompilation fails, return annotated bytecode
    return annotateByteCode(bytecode);
  }
}

/**
 * Annotate bytecode with comments for better readability
 */
function annotateByteCode(bytecode: string): string {
  const annotations: Record<string, string> = {
    'CopyLoc': '// Copy local variable',
    'MoveLoc': '// Move local variable (consume)',
    'StLoc': '// Store to local variable',
    'ImmBorrowLoc': '// Immutable borrow (&)',
    'MutBorrowLoc': '// Mutable borrow (&mut)',
    'ImmBorrowField': '// Borrow struct field (&)',
    'MutBorrowField': '// Borrow struct field (&mut)',
    'Call': '// Function call',
    'Pack': '// Create struct instance',
    'Unpack': '// Destructure struct',
    'Ret': '// Return from function',
    'BrTrue': '// Branch if true',
    'BrFalse': '// Branch if false',
    'Branch': '// Unconditional jump',
    'FreezeRef': '// Convert &mut to &',
    'LdU64': '// Load u64 constant',
    'LdTrue': '// Load true',
    'LdFalse': '// Load false',
    'Pop': '// Discard top of stack',
    'Abort': '// Abort execution',
  };

  const lines = bytecode.split('\n');
  const annotated: string[] = [];

  for (const line of lines) {
    annotated.push(line);

    // Add annotation for instruction lines
    const instrMatch = line.match(/^\s*\d+:\s*(\w+)/);
    if (instrMatch && annotations[instrMatch[1]]) {
      annotated.push(`        ${annotations[instrMatch[1]]}`);
    }
  }

  return annotated.join('\n');
}
