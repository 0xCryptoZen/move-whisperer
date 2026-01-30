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

  for (const line of lines) {
    const structMatch = line.match(/^struct\s+(\w+)(?:<[^>]+>)?\s+has\s+([\w,\s]+)\s*\{/);
    if (structMatch) {
      currentStruct = {
        name: structMatch[1],
        abilities: structMatch[2].split(',').map(a => a.trim()),
        fields: [],
      };
      inStruct = true;
      continue;
    }

    if (inStruct && currentStruct) {
      const fieldMatch = line.match(/^\s*(\w+):\s*(.+)$/);
      if (fieldMatch) {
        currentStruct.fields.push({
          name: fieldMatch[1],
          type: cleanType(fieldMatch[2]),
        });
      }

      if (line.includes('}')) {
        structs.push(currentStruct);
        currentStruct = null;
        inStruct = false;
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

  // Simpler approach: split by function patterns
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
  const parts = paramsStr.split(',');

  for (const part of parts) {
    const match = part.match(/(\w+):\s*(.+)/);
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
  _funcName: string
): string {
  const statements: string[] = [];
  const locals: Map<string, string> = new Map();
  const stack: string[] = [];

  // Initialize params in locals
  params.forEach((p, i) => {
    locals.set(`Arg${i}`, p.name);
  });

  // Parse local variable declarations
  for (const line of lines) {
    const localMatch = line.match(/^L\d+:\s*(\w+):\s*(.+)$/);
    if (localMatch) {
      const varName = generateVarName(localMatch[2]);
      locals.set(localMatch[1], varName);
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
    return '    // Complex bytecode - manual analysis required';
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
      statements.push(`let ${varName} = ${value};`);
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
        // For Pack, we'd need field info - simplify for now
        stack.push(`${structInfo.name} { ... }`);
      }
      break;
    }

    case 'Ret': {
      const returnVal = stack.pop();
      if (returnVal) {
        statements.push(`return ${returnVal};`);
      }
      break;
    }

    case 'FreezeRef': {
      // Convert &mut to & - just mark it
      const val = stack.pop();
      if (val?.startsWith('&mut ')) {
        stack.push(val.replace('&mut ', '&'));
      } else {
        stack.push(val || '?');
      }
      break;
    }

    case 'LdU8':
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

    case 'Pop': {
      stack.pop();
      break;
    }

    case 'BrTrue':
    case 'BrFalse':
    case 'Branch': {
      // Control flow - simplified
      const cond = opcode !== 'Branch' ? stack.pop() : null;
      if (cond) {
        statements.push(`// branch ${opcode === 'BrTrue' ? 'if' : 'if not'} ${cond}`);
      }
      break;
    }

    default:
      // Unknown opcode - add as comment
      if (annotation) {
        statements.push(`// ${opcode}: ${annotation}`);
      }
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
    const match = annotation.match(/(\w+):/);
    if (match && locals.has(match[1])) {
      return locals.get(match[1])!;
    }
  }
  if (operand) {
    return locals.get(operand) || operand;
  }
  return '?';
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
 * Generate variable name from type
 */
function generateVarName(type: string): string {
  const cleanedType = type.replace(/<.*>/, '').trim();
  const parts = cleanedType.split('::');
  const typeName = parts[parts.length - 1];

  const nameMap: Record<string, string> = {
    'UID': 'uid',
    'ID': 'id',
    'Bag': 'bag',
    'Table': 'table',
    'VecSet': 'vec_set',
    'Coin': 'coin',
    'Balance': 'balance',
    'TxContext': 'ctx',
    'address': 'addr',
    'u64': 'amount',
    'u8': 'value',
    'bool': 'flag',
    'String': 'str',
  };

  return nameMap[typeName] || typeName.toLowerCase();
}

/**
 * Clean type string
 */
function cleanType(type: string): string {
  return type
    .replace(/\s+/g, ' ')
    .replace(/^\s+|\s+$/g, '')
    .replace(/,\s*/g, ', ');
}

/**
 * Convert decompiled module to Move source code string
 */
export function toMoveSource(module: DecompiledModule): string {
  const lines: string[] = [];

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
