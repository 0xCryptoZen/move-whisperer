#!/usr/bin/env node

/**
 * CLI entry point for MoveWhisperer
 */

import { run } from '../src/cli/index.js';

run().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
