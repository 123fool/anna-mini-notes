import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

test('real Anna harness: storage CRUD and no-LLM tool routing', async ({ page }) => {
  const calls: unknown[] = [];
  page.on('request', (request) => {
    if (request.url().endsWith('/api/session/call')) {
      const data = request.postDataJSON();
      calls.push(data);
    }
  });
  await page.goto('/');
  const app = page.frameLocator('iframe').first();
  const input = app.getByLabel('What’s on your mind?');
  await expect(input).toBeEnabled();
  await expect(app.getByRole('button', { name: /Save note/ })).toBeDisabled();
  const notes = ['Follow up with the client tomorrow', 'Fix the login bug', 'Workshop ideas'];
  for (const content of notes) {
    await input.fill(content);
    await app.getByRole('button', { name: /Save note/ }).click();
    await expect(app.getByText(content, { exact: true })).toBeVisible();
    await expect(input).toHaveValue('');
  }
  await app.getByRole('button', { name: 'Delete note 2' }).click();
  await expect(app.getByText(notes[1], { exact: true })).toHaveCount(0);
  await expect(app.getByLabel('Note 1', { exact: true })).toBeVisible();
  await expect(app.getByLabel('Note 3', { exact: true })).toBeVisible();
  await expect(app.getByRole('button', { name: /Summarize/ })).toBeEnabled();
  // Reload only the iframe inside the same host session: notes must come back from storage.
  await page.locator('iframe').first().evaluate((element: HTMLIFrameElement) => { element.src = element.src; });
  await expect.poll(() => calls.filter((c: any) => c.ns === 'storage' && c.method === 'get').length).toBe(2);
  await expect(app.getByText(notes[0], { exact: true })).toBeVisible();
  await expect(app.getByText(notes[2], { exact: true })).toBeVisible();
  mkdirSync('test-results', { recursive: true });
  await page.locator('iframe').first().screenshot({ path: 'test-results/notes.png' });
  await app.getByRole('button', { name: /Summarize/ }).click();
  await expect(app.getByRole('alert')).toContainText(/no-llm|llm_disabled/);
  await expect(app.getByText(notes[0], { exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/harness.png', fullPage: true, mask: [page.locator('#frameUrl')] });
  await page.locator('iframe').first().screenshot({ path: 'test-results/no-llm.png' });
  writeFileSync('test-results/harness-rpc.jsonl', calls.map((c) => JSON.stringify(c)).join('\n') + '\n');
  expect(calls.some((c: any) => c.ns === 'storage' && c.method === 'get')).toBe(true);
  expect(calls.filter((c: any) => c.ns === 'storage' && c.method === 'set')).toHaveLength(4);
  expect(calls.some((c: any) => c.ns === 'tools' && c.method === 'invoke' && c.args.tool_id === 'tool-mini-notes-summarizer-local')).toBe(true);
  expect(calls.some((c: any) => c.ns === 'llm')).toBe(false);
});
