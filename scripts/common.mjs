import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const toolDir = join(root, 'executas', 'summarizer');
export const binary = join(root, 'dist', 'bin', `mini-notes-summarizer${process.platform === 'win32' ? '.exe' : ''}`);
export const cli = join(root, 'node_modules', '@anna-ai', 'cli', 'dist', 'cli.js');

export function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with ${result.status}`);
  return result;
}
