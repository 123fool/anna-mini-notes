import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, chmodSync, statSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { root, run } from './common.mjs';
import { startHost } from './rpc-host.mjs';

const arch = process.arch === 'x64' ? 'x86_64' : process.arch;
const platform = `${process.platform}-${arch}`;
const version = JSON.parse(readFileSync(join(root, 'package.json'))).version;
const executable = `mini-notes-summarizer${process.platform === 'win32' ? '.exe' : ''}`;
const key = platform.replace('win32-', 'windows-');
const archive = join(root, 'dist', `mini-notes-summarizer-${version}-${key}${process.platform === 'win32' ? '.zip' : '.tar.gz'}`);
const listing = run('tar', ['-tf', archive], { encoding: 'utf8', stdio: 'pipe' }).stdout.trim().split(/\r?\n/);
assert.deepEqual(listing.sort(), [`bin/${executable}`, 'manifest.json'].sort());
const expectedHash = readFileSync(`${archive}.sha256`, 'utf8').split(' ')[0];
assert.equal(createHash('sha256').update(readFileSync(archive)).digest('hex'), expectedHash);
mkdirSync(join(root, 'test-results'), { recursive: true });
const directory = mkdtempSync(join(root, 'test-results', 'archive-'));
run('tar', ['-xf', archive, '-C', directory]);
const manifest = JSON.parse(readFileSync(join(directory, 'manifest.json')));
assert.equal(manifest.name, 'tool-mini-notes-summarizer-local');
const entries = manifest.runtime.binary.entrypoint;
const entry = join(directory, entries[key] ?? entries.default);
assert.equal(basename(entry), executable);
if (process.platform !== 'win32') assert.equal(statSync(entry).mode & 0o777, 0o755);
chmodSync(entry, 0o755);
const host = startHost(entry);
try {
  host.send({ jsonrpc: '2.0', id: 1, method: 'describe' });
  assert.deepEqual((await host.wait((f) => f.id === 1)).result, manifest);
  host.child.stdin.end();
  assert.equal(await host.exit, 0);
  console.log(`PASS: ${key} archive root, checksum, entrypoint, permissions and native describe.`);
} finally { host.child.kill(); }
