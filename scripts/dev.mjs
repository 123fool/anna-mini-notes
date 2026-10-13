import { existsSync, readFileSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { qwenConfig, completeWithQwen } from './qwen.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
if (existsSync(resolve(root, '.env'))) loadEnvFile(resolve(root, '.env'));
const useQwen = process.argv.includes('--qwen');
let config;
try { if (useQwen) config = qwenConfig(); }
catch (error) { console.error(error.message); process.exit(1); }
// Child Python/Go processes need no provider credentials.
delete process.env.DASHSCOPE_API_KEY;

// Narrow adapter for the pinned CLI 0.1.58. Reuses its server, Python dispatcher,
// SDK, storage and tool routing; no vendor files are modified.
const cli = resolve(root, 'node_modules/@anna-ai/cli/dist');
const { HarnessServer } = await import(new URL('../node_modules/@anna-ai/cli/dist/server-I1u9nZ3j.js', import.meta.url));
const { BridgeRequestError } = await import(new URL('../node_modules/@anna-ai/cli/dist/bridge-AUYNkzAw.js', import.meta.url));
const { runDev } = await import(new URL('../node_modules/@anna-ai/cli/dist/dev-C2fxScoq.js', import.meta.url));
const listen = HarnessServer.prototype.listen;
HarnessServer.prototype.listen = async function () {
  if (config) this.bridge.onRequest('host.llm.complete', async (args) => {
    try { return await completeWithQwen(args, config); }
    catch (error) { throw new BridgeRequestError('qwen_error', error.message); }
  });
  return listen.call(this);
};
HarnessServer.prototype.serveDashboard = async function (res) {
  const html = readFileSync(resolve(cli, 'dashboard.html'), 'utf8')
    .replace('iframeSrc.textContent = url;', 'iframeSrc.textContent = "Mini Notes";')
    .replace(/<title>[^<]*<\/title>/, '<title>Mini Notes</title>');
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  res.end(html);
};
if (config) console.log(`千问宿主已启用：${config.model}（密钥仅在本机服务端使用）`);
const portFlag = process.argv.indexOf('--port');
process.exitCode = await runDev({
  cwd: root, manifestPath: 'manifest.json', port: portFlag < 0 ? 5180 : Number(process.argv[portFlag + 1]),
  userId: 1, noLlm: true, storageMode: 'legacy', webMode: 'local',
});
