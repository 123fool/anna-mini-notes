// anna-app-runtime-local 0.2.0a28 invokes plugins without initialize.
// This development-only launcher negotiates v2; all other frames are transparent.
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { toolDir } from './common.mjs';

const child = spawn('go', ['run', '.'], { cwd: toolDir, stdio: ['pipe', 'pipe', 'pipe'] });
const bootstrapID = 'anna-local-v2-bootstrap';
child.stderr.pipe(process.stderr);
child.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
child.on('exit', (code) => { process.exitCode = code ?? 1; });
createInterface({ input: child.stdout }).on('line', (line) => {
  const frame = JSON.parse(line);
  if (frame.id === bootstrapID) {
    if (frame.result?.protocolVersion !== '2.0' || !frame.result?.client_capabilities?.sampling) {
      console.error('Local v2 bootstrap failed');
      child.kill(); process.exitCode = 1;
    }
    return;
  }
  process.stdout.write(line + '\n');
});
child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: bootstrapID, method: 'initialize',
  params: { protocolVersion: '2.0', capabilities: { sampling: {} }, clientInfo: { name: 'anna-mini-notes-local-launcher', version: '0.1.0' } },
}) + '\n');
process.stdin.pipe(child.stdin);
