import { NextResponse } from 'next/server';

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
const MODEL_CACHE_TTL_MS = Number(process.env.OLLAMA_MODEL_CACHE_TTL_MS || 30_000);

let cachedModels: string[] | null = null;
let cachedAtMs = 0;
let cachedWarning: string | null = null;

function cleanText(value: string) {
  return String(value || '').trim();
}

function looksLikeEmbeddingModel(name: string) {
  const lower = name.toLowerCase();
  return lower.includes('embed') || lower.includes('embedding');
}

async function fetchInstalledModels(): Promise<{ models: string[]; warning?: string }> {
  const now = Date.now();
  if (cachedModels && now - cachedAtMs < MODEL_CACHE_TTL_MS) {
    return { models: cachedModels, warning: cachedWarning || undefined };
  }

  try {
    const res = await fetch(`${OLLAMA_BASE_URL.replace(/\/$/, '')}/api/tags`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      // Avoid Next.js caching a stale tags response.
      cache: 'no-store',
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const warning = `Ollama /api/tags failed (${res.status}): ${cleanText(text).slice(0, 200)}`;
      cachedModels = cachedModels || [];
      cachedAtMs = now;
      cachedWarning = warning;
      return { models: cachedModels, warning };
    }

    const data = (await res.json().catch(() => null)) as any;
    const rawModels: string[] = Array.isArray(data?.models)
      ? data.models.map((m: any) => cleanText(m?.name)).filter(Boolean)
      : [];

    const models = rawModels
      .filter((name) => !looksLikeEmbeddingModel(name))
      .sort((a, b) => a.localeCompare(b));

    cachedModels = models;
    cachedAtMs = now;
    cachedWarning = null;

    return { models };
  } catch (err: any) {
    const warning = `Failed to reach Ollama at ${OLLAMA_BASE_URL}: ${cleanText(err?.message || String(err))}`;
    cachedModels = cachedModels || [];
    cachedAtMs = now;
    cachedWarning = warning;
    return { models: cachedModels, warning };
  }
}

export async function GET() {
  const result = await fetchInstalledModels();
  return NextResponse.json({
    models: result.models,
    warning: result.warning,
  });
}
