import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cli, root, run } from './common.mjs';

const result = run(process.execPath, [cli, 'executa', 'dev', '--dir', 'executas/summarizer',
  '--mock-sampling', 'fixtures/sampling.jsonl', '--no-agent', '--no-image', '--no-upload',
  '--invoke', 'summarize', '--args', JSON.stringify({ text: 'Follow up with the client tomorrow. Fix the login bug.' }), '--json'],
  { encoding: 'utf8', stdio: 'pipe', timeout: 120000 });
const response = JSON.parse(result.stdout.trim());
assert.equal(response.success, true);
assert.equal(response.data.summary, '[fixture:mini-notes] Follow up with the client tomorrow and fix the login bug.');
assert.match(result.stderr, /sampling\/createMessage request/);
assert.match(result.stderr, /sampling\/createMessage completed/);
mkdirSync(join(root, 'test-results'), { recursive: true });
writeFileSync(join(root, 'test-results', 'sampling-result.json'), JSON.stringify(response, null, 2) + '\n');
writeFileSync(join(root, 'test-results', 'sampling-stderr.txt'), result.stderr);
console.log('PASS: real Executa runner issued sampling/createMessage and returned the fixture marker.');
