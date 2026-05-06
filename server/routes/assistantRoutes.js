const express = require('express');

const router = express.Router();

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function looksLikeEmbeddingModel(name) {
  const lower = cleanText(name).toLowerCase();
  return lower.includes('embed') || lower.includes('embedding');
}

async function fetchJsonWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    const data = await res.json().catch(() => null);
    return { res, data };
  } finally {
    clearTimeout(timeout);
  }
}

async function retrieveContext(query) {
  const retrieveUrl = cleanText(process.env.HAYSTACK_RETRIEVE_URL);
  if (!retrieveUrl) return { contextText: '', sources: [] };

  const topK = Math.max(1, Number(process.env.HAYSTACK_TOP_K || 4));
  const apiKey = cleanText(process.env.HAYSTACK_API_KEY);

  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const { res, data } = await fetchJsonWithTimeout(
    retrieveUrl,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, top_k: topK }),
    },
    Math.max(1000, Number(process.env.HAYSTACK_TIMEOUT_MS || 5000))
  );

  if (!res.ok) {
    const msg = typeof data?.detail === 'string' ? data.detail : `Haystack retrieve failed (${res.status})`;
    return { contextText: '', sources: [], warning: msg };
  }

  const docs = Array.isArray(data?.documents) ? data.documents : [];
  const sources = [];
  const parts = [];
  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i] || {};
    const content = cleanText(doc.content);
    const source = cleanText(doc.source || doc?.meta?.source || 'haystack');
    if (!content) continue;
    sources.push(source);
    parts.push(`[Source ${i + 1} | ${source}]\n${content.slice(0, 1500)}`);
  }

  return { contextText: parts.join('\n\n'), sources };
}

// GET /api/assistant/models
router.get('/models', async (req, res) => {
  const baseUrl = cleanText(process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
  const tagsUrl = `${baseUrl}/api/tags`;

  try {
    const { res: upstream, data } = await fetchJsonWithTimeout(
      tagsUrl,
      { method: 'GET', headers: { 'Content-Type': 'application/json' } },
      Math.max(1000, Number(process.env.OLLAMA_TIMEOUT_MS || 5000))
    );

    if (!upstream.ok) {
      return res.status(502).json({ models: [], warning: `Ollama /api/tags failed (${upstream.status})` });
    }

    const raw = Array.isArray(data?.models) ? data.models : [];
    const models = raw
      .map((m) => cleanText(m?.name))
      .filter((name) => name && !looksLikeEmbeddingModel(name));

    return res.status(200).json({ models });
  } catch (error) {
    return res.status(502).json({ models: [], warning: `Failed to reach Ollama at ${tagsUrl}` });
  }
});

// POST /api/assistant/chat
// Body: { model?: string, messages: [{role, content}], isRestricted?: boolean }
router.post('/chat', async (req, res) => {
  const baseUrl = cleanText(process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
  const chatUrl = `${baseUrl}/api/chat`;
  const defaultModel = cleanText(process.env.OLLAMA_MODEL || 'gpt-oss:20b');

  const requestedModel = cleanText(req.body?.model);
  const model = requestedModel || defaultModel;
  const isRestricted = req.body?.isRestricted !== false; // default true
  const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];

  const lastUser = [...messages].reverse().find((m) => m && m.role === 'user' && typeof m.content === 'string');
  const query = cleanText(lastUser?.content || '');
  if (!query) {
    return res.status(400).json({ message: 'messages must include a user message' });
  }

  let contextText = '';
  let haystackWarning = undefined;
  try {
    const retrieval = await retrieveContext(query);
    contextText = cleanText(retrieval.contextText);
    haystackWarning = retrieval.warning;
  } catch (e) {
    haystackWarning = 'Context retrieval failed';
  }

  const systemPrompt = isRestricted
    ? `You are UniBot, a helpful assistant for University students.\n\nSTRICT RULES:\n- Use the CONTEXT for university-specific facts.\n- If the answer is not in CONTEXT, say "Not confirmed in docs" and suggest the next best official place to check.\n- Never invent URLs, emails, phone numbers, dates, deadlines, or policy details.\n\nCONTEXT:\n${contextText || 'No university documents found for this query.'}`
    : `You are UniBot, a helpful assistant.\n\nRULES:\n- Prefer the CONTEXT for university questions.\n- For non-university questions, you may answer from general knowledge.\n- Never invent URLs, emails, or phone numbers.\n\nCONTEXT:\n${contextText || 'No university documents found for this query.'}`;

  // Keep conversation short to avoid huge payloads.
  const maxRecent = Math.max(2, Number(process.env.OLLAMA_MAX_RECENT_MESSAGES || 8));
  const recent = messages
    .filter((m) => m && typeof m.role === 'string' && typeof m.content === 'string')
    .slice(-maxRecent)
    .map((m) => ({ role: m.role, content: String(m.content) }));

  const payload = {
    model,
    messages: [{ role: 'system', content: systemPrompt }, ...recent],
    stream: false,
  };

  try {
    const upstream = await fetch(chatUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      const detail = cleanText(data?.error || data?.message || 'Ollama chat failed');
      return res.status(502).json({ message: detail || 'AI model error' });
    }

    // Return an Ollama-like response shape so the frontend can read data.message.content
    const content = cleanText(data?.message?.content || '');
    return res.status(200).json({
      model,
      message: { role: 'assistant', content },
      contextWarning: haystackWarning,
    });
  } catch (error) {
    return res.status(502).json({ message: 'Failed to connect to AI model. Is Ollama running?' });
  }
});

module.exports = router;
