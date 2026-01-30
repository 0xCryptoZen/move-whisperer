import { NextRequest, NextResponse } from 'next/server';
import { decompileToMove } from '@/lib/decompiler';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { modules } = body;

    if (!modules || typeof modules !== 'object') {
      return NextResponse.json(
        { error: 'Invalid modules data' },
        { status: 400 }
      );
    }

    // Decompile each module
    const decompiled: Record<string, string> = {};
    const errors: Record<string, string> = {};

    for (const [moduleName, bytecode] of Object.entries(modules)) {
      try {
        decompiled[moduleName] = decompileToMove(bytecode as string);
      } catch (error) {
        errors[moduleName] = error instanceof Error ? error.message : 'Decompilation failed';
        // Fallback to original bytecode with annotation
        decompiled[moduleName] = `// Decompilation failed for ${moduleName}\n// Original bytecode:\n\n${bytecode}`;
      }
    }

    return NextResponse.json({
      decompiled,
      errors: Object.keys(errors).length > 0 ? errors : undefined,
      decompileAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Decompile error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to decompile' },
      { status: 500 }
    );
  }
}
