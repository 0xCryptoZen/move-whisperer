#!/usr/bin/env node
/**
 * MoveWhisperer - Local Server CLI
 * Run with: npx move-whisperer serve
 */

import { startServer } from '../src/server/index.js';

const port = parseInt(process.env.PORT || '3456', 10);
const host = process.env.HOST || '127.0.0.1';

console.log('Starting MoveWhisperer server...');
startServer({ port, host });
