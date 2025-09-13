/*
  MartianRouter (custom, lightweight)
  - Uses Martian’s OpenAI-compatible endpoint: POST /v1/chat/completions
  - Normalizes model ids (e.g., 'gpt-5' -> 'openai/gpt-5') per docs
  - Retries over provided model_preferences until one succeeds
  - Docs: https://app.withmartian.com/docs/index.html
*/

class MartianRouter {
  constructor({ apiKey, baseURL = 'https://api.withmartian.com/v1' }) {
    if (!apiKey) throw new Error('MartianRouter requires apiKey');
    this.apiKey = apiKey;
    this.baseURL = baseURL.replace(/\/$/, '');
  }

  async route({ task, prompt, model_preferences = [], max_tokens = 800 }) {
    const candidates = model_preferences.length > 0 ? model_preferences : ['openai/gpt-4.1-mini'];

    let lastError = null;
    for (const candidate of candidates) {
      const model = this.normalizeModelId(candidate);
      try {
        const res = await fetch(`${this.baseURL}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            max_tokens,
            messages: [
              { role: 'system', content: `You are an assistant helping with task: ${task}` },
              { role: 'user', content: prompt },
            ],
          }),
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Martian API error (${res.status}): ${text}`);
        }

        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content || '';
        return {
          content,
          model_used: data?.model || model,
          cost: 0, // cost not returned; can be estimated via dashboard if needed
        };
      } catch (err) {
        lastError = err;
        // try next model
      }
    }

    throw lastError || new Error('All model candidates failed');
  }

  normalizeModelId(id) {
    // If id already namespaced (provider/model), pass through
    if (id.includes('/')) return id;

    const lower = id.toLowerCase();
    // Common shorthands → provider/model per docs
    if (lower.startsWith('gpt')) return `openai/${id}`; // e.g., gpt-5 -> openai/gpt-5
    if (lower.startsWith('o1') || lower.startsWith('o3') || lower.startsWith('o4')) return `openai/${id}`;
    if (lower.startsWith('claude')) {
      // map to Anthropic Claude Sonnet/Opus variants when generic
      if (lower.includes('sonnet')) return 'anthropic/claude-sonnet-4-20250514';
      if (lower.includes('opus')) return 'anthropic/claude-opus-4-20250514';
      return 'anthropic/claude-sonnet-4-20250514';
    }
    // fall back: assume OpenAI family
    return `openai/${id}`;
  }
}

module.exports = MartianRouter;
