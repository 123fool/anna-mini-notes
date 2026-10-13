import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { binary, toolDir, root, run } from './common.mjs';
import { startHost } from './rpc-host.mjs';
import './build-tool.mjs';

run('go', ['test', './...'], { cwd: toolDir });
const host = startHost(binary);
try {
  host.send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2.0' } });
  const init = await host.wait((f) => f.id === 1);
  assert.equal(init.result.protocolVersion, '2.0');
  assert.deepEqual(init.result.client_capabilities.sampling, {});
  host.send({ jsonrpc: '2.0', id: 2, method: 'describe' });
  const manifest = (await host.wait((f) => f.id === 2)).result;
  assert.equal(manifest.name, 'tool-mini-notes-summarizer-local');
  assert.deepEqual(manifest.host_capabilities, ['llm.sample']);
  assert.equal(manifest.tools[0].parameters[0].name, 'text');
  const app = JSON.parse(readFileSync(join(root, 'manifest.json')));
  const executa = JSON.parse(readFileSync(join(toolDir, 'executa.json')));
  assert.equal(app.required_executas[0].tool_id, manifest.name);
  assert.deepEqual(app.ui.host_api.tools, [manifest.name]);
  assert.equal(executa.tool_id, manifest.name);

  host.send({ jsonrpc: '2.0', id: 3, method: 'invoke', params: { tool: 'summarize', arguments: { text: '1. Follow up with the client\n2. Fix the login bug' }, context: { invoke_id: 'audit-3' } } });
  const reverse = await host.wait((f) => f.method === 'sampling/createMessage');
  assert.match(reverse.params.messages[0].content.text, /Follow up with the client/);
  assert.equal(reverse.params.metadata.executa_invoke_id, 'audit-3');
  assert.equal(reverse.params.context.invoke_id, 'audit-3');
  assert.equal(reverse.params.includeContext, 'none');
  assert.equal(reverse.params.maxTokens, 400);
  // A second host request must succeed while the invoke waits for reverse-RPC input.
  host.send({ jsonrpc: '2.0', id: 4, method: 'health' });
  assert.equal((await host.wait((f) => f.id === 4)).result.status, 'healthy');
  const summary = '[protocol:host-response] Client follow-up and login fix.';
  host.send({ jsonrpc: '2.0', id: reverse.id, result: { role: 'assistant', content: { type: 'text', text: summary } } });
  assert.equal((await host.wait((f) => f.id === 3)).result.data.summary, summary);

  host.send({ jsonrpc: '2.0', id: 5, method: 'invoke', params: { tool: 'summarize', arguments: { text: '   ' } } });
  assert.equal((await host.wait((f) => f.id === 5)).error.code, -32602);
  host.send({ jsonrpc: '2.0', id: 6, method: 'invoke', params: { tool: 'summarize', arguments: { text: 'Another note' }, invoke_id: 'audit-6' } });
  const reverse2 = await host.wait((f) => f.method === 'sampling/createMessage' && f.id !== reverse.id);
  host.send({ jsonrpc: '2.0', id: reverse2.id, error: { code: -32008, message: 'sampling disabled by test host' } });
  assert.equal((await host.wait((f) => f.id === 6)).error.code, -32008);
  host.send({ jsonrpc: '2.0', id: 7, method: 'describe' });
  assert.equal((await host.wait((f) => f.id === 7)).result.name, manifest.name);
  host.child.stdin.end();
  assert.equal(await host.exit, 0);
  mkdirSync(join(root, 'test-results'), { recursive: true });
  writeFileSync(join(root, 'test-results', 'protocol-transcript.jsonl'), host.transcript.map((f) => JSON.stringify(f)).join('\n') + '\n');
  console.log('PASS: v2, describe, reverse sampling, live reader, error propagation, repeated requests, EOF.');
} finally { host.child.kill(); }
