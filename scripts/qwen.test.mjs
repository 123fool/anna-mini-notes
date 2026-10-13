import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn, execFileSync } from 'node:child_process';
import { chromium } from '@playwright/test';
import { completeWithQwen, qwenConfig } from './qwen.mjs';

test('Qwen host adapter: HTTP mapping, errors and real Anna UI/tool/sampling path', { timeout: 120000 }, async () => {
  const requests = [];
  let status = 200;
  let summary = '[provider-fixture] 明天跟进客户，并修复登录问题。';
  const provider = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    requests.push({ path: req.url, authorization: req.headers.authorization, body: JSON.parse(body) });
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(status === 200 ? { model: 'qwen-plus', choices: [{ message: { content: summary } }] } : { error: { message: 'secret-body-must-not-leak' } }));
  });
  await new Promise((resolve) => provider.listen(0, '127.0.0.1', resolve));
  const config = qwenConfig({ DASHSCOPE_API_KEY: 'fixture-key', QWEN_BASE_URL: `http://127.0.0.1:${provider.address().port}/v1` });
  let host;
  let browser;
  let output = '';
  try {
    assert.throws(() => qwenConfig({}), /DASHSCOPE_API_KEY/);
    const args = { systemPrompt: 'Summarize notes.', maxTokens: 400, messages: [{ role: 'user', content: { type: 'text', text: '明天跟进客户' } }] };
    assert.equal((await completeWithQwen(args, config)).content.text, summary);
    assert.equal(requests[0].path, '/v1/chat/completions');
    assert.equal(requests[0].authorization, 'Bearer fixture-key');
    assert.deepEqual(requests[0].body.messages, [{ role: 'system', content: 'Summarize notes.' }, { role: 'user', content: '明天跟进客户' }]);
    assert.equal(requests[0].body.max_tokens, 400);
    status = 401;
    await assert.rejects(completeWithQwen(args, config), (error) => /HTTP 401/.test(error.message) && !error.message.includes('secret-body'));
    status = 200;
    summary = '';
    await assert.rejects(completeWithQwen(args, config), /没有返回可用的总结/);
    summary = '[provider-fixture] 明天跟进客户，并修复登录问题。';
    host = spawn(process.execPath, ['scripts/dev.mjs', '--qwen', '--port', '5181'], {
      env: { ...process.env, DASHSCOPE_API_KEY: config.apiKey, QWEN_BASE_URL: config.baseUrl, QWEN_MODEL: config.model },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    host.stdout.on('data', (data) => { output += data; });
    host.stderr.on('data', (data) => { output += data; });
    const deadline = Date.now() + 60000;
    while (true) {
      if (host.exitCode !== null) throw new Error(`Harness exited: ${output}`);
      try { if ((await fetch('http://localhost:5181')).ok) break; } catch {}
      if (Date.now() > deadline) throw new Error(`Harness startup timeout: ${output}`);
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
    const page = await browser.newPage();
    const calls = [];
    const toolResponses = [];
    page.on('response', async (response) => {
      if (response.url().endsWith('/api/session/call') && response.request().postDataJSON()?.ns === 'tools') {
        toolResponses.push(await response.json());
      }
    });
    page.on('request', (request) => {
      if (request.url().endsWith('/api/session/call')) calls.push(request.postDataJSON());
    });
    await page.goto('http://localhost:5181');
    const app = page.frameLocator('iframe').first();
    const input = app.getByLabel('What’s on your mind?');
    await input.fill('明天跟进客户，并修复登录问题');
    await app.getByRole('button', { name: /Save note/ }).click();
    await app.getByRole('button', { name: /Summarize/ }).click();
    await Promise.race([
      app.getByText(summary, { exact: true }).waitFor({ timeout: 45000 }),
      app.getByRole('alert').waitFor({ timeout: 45000 }).then(async () => {
        throw new Error(`Unexpected summary error: ${await app.getByRole('alert').textContent()}\n${JSON.stringify(toolResponses)}\n${output}`);
      }),
    ]);
    assert.equal(await page.locator('#iframe-src').textContent(), 'Mini Notes');
    assert(calls.some((call) => call.ns === 'tools' && call.method === 'invoke'));
    assert(!calls.some((call) => call.ns === 'llm'));
    assert.match(requests.at(-1).body.messages.at(-1).content, /明天跟进客户/);
    assert.match(output, /sampling\/createMessage request/);
    assert.match(output, /sampling\/createMessage completed/);
    status = 401;
    await app.getByRole('button', { name: /Summarize/ }).click();
    await app.getByRole('alert').filter({ hasText: 'HTTP 401' }).waitFor({ timeout: 45000 });
    assert(!output.includes('fixture-key'));
  } finally {
    await browser?.close();
    if (host?.exitCode === null) {
      if (process.platform === 'win32') {
        try { execFileSync('taskkill', ['/PID', String(host.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {}
      } else host.kill('SIGTERM');
    }
    provider.closeAllConnections();
    await new Promise((resolve) => provider.close(resolve));
  }
});
