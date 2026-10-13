import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

export function startHost(binary) {
  const child = spawn(binary, [], { stdio: ['pipe', 'pipe', 'pipe'] });
  const frames = [];
  const transcript = [];
  const waiters = [];
  let stderr = '';
  let fatal;
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const exit = new Promise((resolve, reject) => {
    child.on('error', (e) => { fatal = e; reject(e); });
    child.on('exit', (code) => resolve(code));
  });
  createInterface({ input: child.stdout }).on('line', (line) => {
    try {
      const message = JSON.parse(line);
      if (message.jsonrpc !== '2.0') throw new Error(`Non-protocol stdout: ${line}`);
      frames.push(message);
      transcript.push({ direction: 'tool->host', ...message });
      for (const waiter of [...waiters]) if (waiter.predicate(message)) waiter.finish(message);
    } catch (e) { fatal = e; child.kill(); }
  });
  const send = (message) => {
    transcript.push({ direction: 'host->tool', ...message });
    return child.stdin.write(`${JSON.stringify(message)}\n`);
  };
  function wait(predicate, timeout = 8000) {
    if (fatal) return Promise.reject(fatal);
    const existing = frames.find(predicate);
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        waiters.splice(waiters.indexOf(waiter), 1);
        reject(fatal || new Error(`Timed out waiting for protocol frame; stderr: ${stderr}`));
      }, timeout);
      const waiter = { predicate, finish: (message) => {
        clearTimeout(timer); waiters.splice(waiters.indexOf(waiter), 1); resolve(message);
      } };
      waiters.push(waiter);
    });
  }
  return { child, send, wait, frames, transcript, exit, logs: () => stderr };
}
