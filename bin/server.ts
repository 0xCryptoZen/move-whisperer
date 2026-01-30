#!/usr/bin/env node
/**
 * Auto Sui Skill - Local Server CLI
 * Run with: npx auto-sui-skill serve
 */

import { startServer } from '../src/server/index.js';

const port = parseInt(process.env.PORT || '3456', 10);
const host = process.env.HOST || '127.0.0.1';

console.log('Starting Auto Sui Skill server...');
startServer({ port, host });
