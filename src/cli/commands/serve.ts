/**
 * serve command - Start local server for web UI integration
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { startServer } from '../../server/index.js';

export function createServeCommand(): Command {
  const command = new Command('serve');

  command
    .description('Start local server for web UI integration')
    .option('-p, --port <port>', 'Server port', '3456')
    .option('-H, --host <host>', 'Server host', '127.0.0.1')
    .option('--open', 'Open web UI in browser after starting')
    .action(async (options) => {
      const port = parseInt(options.port, 10);
      const host = options.host;

      console.log(chalk.cyan('Starting MoveWhisperer server...'));

      startServer({ port, host });

      if (options.open) {
        // Open browser after a short delay
        setTimeout(() => {
          const url = `http://${host}:${port}`;
          const openCmd = process.platform === 'darwin'
            ? 'open'
            : process.platform === 'win32'
              ? 'start'
              : 'xdg-open';

          import('child_process').then(({ exec }) => {
            exec(`${openCmd} ${url}`);
          });
        }, 1000);
      }
    });

  return command;
}
