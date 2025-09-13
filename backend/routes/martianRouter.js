// Lightweight Martian router using OpenAI-compatible chat completions API
// Usage:
//  const router = new MartianRouter({ apiKey: process.env.MARTIAN_API_KEY })
//  const res = await router.route({ task: 'desc', prompt: '...', model_preferences: ['gpt-5','claude-4.1-sonnet'] })

class MartianRouter {
  constructor({ apiKey, baseURL } = {}) {
    if (!apiKey) throw new Error('MartianRouter requires apiKey');
    this.apiKey = apiKey;
    // Base URL should be the Martian API host without the trailing /v1
    this.baseURL = (baseURL || process.env.MARTIAN_API_BASE_URL || 'https://api.withmartian.com').replace(/\/$/, '');
    this.timeoutMs = 30_000;
  }

  normalizeModel(model) {
    if (!model) return 'openai/gpt-4.1-mini';
    const m = model.toLowerCase();
    if (m.startsWith('openai/')) return model;
    if (m.startsWith('anthropic/')) return model;
    // Common aliases
    const map = {
      'gpt-5': 'openai/gpt-5',
      'gpt-4.1-mini': 'openai/gpt-4.1-mini',
      'gpt-4o-mini': 'openai/gpt-4o-mini',
      'claude-4.1-sonnet': 'anthropic/claude-4.1-sonnet',
      'claude-4-sonnet': 'anthropic/claude-4.1-sonnet',
      'claude-4-opus': 'anthropic/claude-4-opus',
      'claude-4.1-haiku': 'anthropic/claude-4.1-haiku',
      'claude-3.5-sonnet': 'anthropic/claude-3.5-sonnet'
    };
    return map[m] || model;
  }

  async route({ task, prompt, model_preferences = ['openai/gpt-4.1-mini'], max_tokens = 800 }) {
    const models = Array.isArray(model_preferences) && model_preferences.length > 0
      ? model_preferences
      : ['openai/gpt-4.1-mini'];

    let lastError;
    for (const pref of models) {
      const model = this.normalizeModel(pref);
      try {
        const result = await this.completions({ model, task, prompt, max_tokens });
        return {
          content: result.content,
          model_used: model,
          cost: result.cost ?? 0,
        };
      } catch (err) {
        lastError = err;
        // Try next model
      }
    }
    throw lastError || new Error('All model attempts failed');
  }

  async completions({ model, task, prompt, max_tokens }) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseURL}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: 'You are an expert shipping optimization assistant. Respond with concise JSON when asked.' },
            task ? { role: 'system', content: `Task: ${task}` } : null,
            { role: 'user', content: prompt }
          ].filter(Boolean),
          max_tokens,
          temperature: 0.2,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Martian API error ${res.status}: ${text.slice(0, 500)}`);
      }
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || '';
      // Optional: compute a naive cost estimate if usage present
      const input = data.usage?.prompt_tokens || 0;
      const output = data.usage?.completion_tokens || 0;
      const cost = 0; // Unknown pricing; keep 0 to avoid misleading values
      return { content, cost, raw: data };
    } finally {
      clearTimeout(t);
    }
  }
}

module.exports = MartianRouter;
