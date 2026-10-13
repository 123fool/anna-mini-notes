// Host-side only: the browser and Executa never receive the API key.
export function qwenConfig(env = process.env) {
  const apiKey = env.DASHSCOPE_API_KEY?.trim();
  if (!apiKey) throw new Error('请在本机 .env 中设置 DASHSCOPE_API_KEY，再运行 npm run dev:qwen。');
  return {
    apiKey,
    baseUrl: (env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1').replace(/\/$/, ''),
    model: env.QWEN_MODEL || 'qwen-plus',
  };
}

export async function completeWithQwen(args, config) {
  const messages = (args.messages || []).map(({ role, content }) => {
    const text = typeof content === 'string' ? content : content?.type === 'text' ? content.text : null;
    if (typeof text !== 'string') throw new Error('千问总结仅支持文本笔记。');
    return { role, content: text };
  });
  if (args.systemPrompt) messages.unshift({ role: 'system', content: args.systemPrompt });
  let response;
  try {
    response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: config.model, messages, max_tokens: args.maxTokens ?? 400, stream: false, enable_thinking: false }),
      signal: AbortSignal.timeout(45000),
    });
  } catch (error) {
    if (error.name === 'TimeoutError') throw new Error('千问请求超时，请重试。');
    throw new Error('无法连接千问，请检查 QWEN_BASE_URL 和网络连接。');
  }
  if (!response.ok) {
    const hint = response.status === 401 || response.status === 403 ? '请检查 API Key、所属地域和模型权限。'
      : response.status === 429 ? '请检查额度或稍后重试。' : '请检查接口地址和模型配置。';
    // Do not expose upstream response bodies, which can contain credentials.
    throw new Error(`千问请求失败（HTTP ${response.status}）。${hint}`);
  }
  const result = await response.json();
  const text = result.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) throw new Error('千问没有返回可用的总结，请重试。');
  return { role: 'assistant', content: { type: 'text', text }, model: result.model || config.model, stopReason: 'endTurn' };
}
