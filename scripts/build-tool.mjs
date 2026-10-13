import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { binary, toolDir, run } from './common.mjs';

mkdirSync(dirname(binary), { recursive: true });
run('go', ['build', '-trimpath', '-o', binary, '.'], { cwd: toolDir, env: { ...process.env, CGO_ENABLED: '0' } });
console.log(`Built ${binary}`);
