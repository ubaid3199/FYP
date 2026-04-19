import { Document } from "@langchain/core/documents";
import { getRAGStore } from "@/lib/domains/rag";

type RetrieverProvider = "hybrid" | "haystack" | "auto";

export interface RetrieverStatus {
  configuredProvider: RetrieverProvider;
  activePreference: "hybrid" | "haystack";
  haystackConfigured: boolean;
  haystackHealthy: boolean | null;
  warning?: string;
}

interface RetrieverResult {
  docs: Document[];
  provider: "hybrid" | "haystack";
  fallbackUsed: boolean;
  warning?: string;
}

const RETRIEVER_PROVIDER = (process.env.RAG_RETRIEVER_PROVIDER || "auto").toLowerCase() as RetrieverProvider;
const HAYSTACK_RETRIEVE_URL = process.env.HAYSTACK_RETRIEVE_URL || "";
const HAYSTACK_API_KEY = process.env.HAYSTACK_API_KEY || "";
const HAYSTACK_QUERY_FIELD = process.env.HAYSTACK_QUERY_FIELD || "query";
const HAYSTACK_TOPK_FIELD = process.env.HAYSTACK_TOPK_FIELD || "top_k";
const HAYSTACK_HEALTH_URL = process.env.HAYSTACK_HEALTH_URL || "";
const RETRIEVER_HEALTH_TTL_MS = Number(process.env.RAG_RETRIEVER_HEALTH_TTL_MS || 60000);

let cachedHaystackHealth: { expiresAt: number; healthy: boolean; warning?: string } | null = null;

function getPreferredProvider(provider: RetrieverProvider): "hybrid" | "haystack" {
  if (provider === "hybrid") return "hybrid";
  return "haystack";
}

function isHaystackConfigured() {
  return Boolean(HAYSTACK_RETRIEVE_URL.trim());
}

function authHeaders() {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (HAYSTACK_API_KEY) {
    headers.Authorization = `Bearer ${HAYSTACK_API_KEY}`;
  }
  return headers;
}

async function checkHaystackHealth(timeoutMs: number): Promise<{ healthy: boolean; warning?: string }> {
  const now = Date.now();
  if (cachedHaystackHealth && cachedHaystackHealth.expiresAt > now) {
    return {
      healthy: cachedHaystackHealth.healthy,
      warning: cachedHaystackHealth.warning,
    };
  }

  if (!isHaystackConfigured()) {
    return { healthy: false, warning: "HAYSTACK_RETRIEVE_URL is not configured" };
  }

  if (!HAYSTACK_HEALTH_URL) {
    const result = {
      healthy: true,
      warning:
        "HAYSTACK_HEALTH_URL not set; skipping active health probe and relying on runtime retrieval fallback.",
    };
    cachedHaystackHealth = {
      expiresAt: now + RETRIEVER_HEALTH_TTL_MS,
      healthy: result.healthy,
      warning: result.warning,
    };
    return result;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(HAYSTACK_HEALTH_URL, {
      method: "GET",
      headers: authHeaders(),
      signal: controller.signal,
    });

    const result = response.ok
      ? { healthy: true as const }
      : {
          healthy: false as const,
          warning: `Haystack health probe returned ${response.status}`,
        };

    cachedHaystackHealth = {
      expiresAt: Date.now() + RETRIEVER_HEALTH_TTL_MS,
      healthy: result.healthy,
      warning: result.warning,
    };

    return result;
  } catch (error) {
    const warning = error instanceof Error ? error.message : "Unknown health probe failure";
    cachedHaystackHealth = {
      expiresAt: Date.now() + RETRIEVER_HEALTH_TTL_MS,
      healthy: false,
      warning,
    };
    return { healthy: false, warning };
  } finally {
    clearTimeout(timeout);
  }
}

function pickText(value: Record<string, unknown>): string {
  const candidates = [value.pageContent, value.content, value.text, value.answer, value.snippet];
  for (const item of candidates) {
    if (typeof item === "string" && item.trim()) return item.trim();
  }
  return "";
}

function normalizeHaystackDocs(payload: unknown): Document[] {
  const root = payload as Record<string, unknown> | unknown[];

  let rows: unknown[] = [];
  if (Array.isArray(root)) {
    rows = root;
  } else if (root && typeof root === "object") {
    const record = root as Record<string, unknown>;
    const candidates = [record.documents, record.results, record.answers, record.hits];
    for (const item of candidates) {
      if (Array.isArray(item)) {
        rows = item;
        break;
      }
    }
  }

  const docs: Document[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    const pageContent = pickText(item);
    if (!pageContent) continue;

    const metadata = (item.meta && typeof item.meta === "object"
      ? (item.meta as Record<string, unknown>)
      : item.metadata && typeof item.metadata === "object"
        ? (item.metadata as Record<string, unknown>)
        : {}) as Record<string, unknown>;

    const source =
      typeof item.source === "string"
        ? item.source
        : typeof metadata.source === "string"
          ? metadata.source
          : "haystack";

    docs.push(
      new Document({
        pageContent,
        metadata: {
          ...metadata,
          source,
        },
      })
    );
  }

  return docs;
}

async function retrieveFromHybrid(query: string, topK: number): Promise<Document[]> {
  const rag = await getRAGStore();
  return rag.retrieve(query, topK);
}

async function retrieveFromHaystack(query: string, topK: number, timeoutMs: number): Promise<Document[]> {
  if (!HAYSTACK_RETRIEVE_URL) {
    throw new Error("HAYSTACK_RETRIEVE_URL is not configured");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const body: Record<string, unknown> = {
    [HAYSTACK_QUERY_FIELD]: query,
    [HAYSTACK_TOPK_FIELD]: topK,
  };

  const headers = authHeaders();

  try {
    const response = await fetch(HAYSTACK_RETRIEVE_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const raw = await response.text();
      throw new Error(`Haystack returned ${response.status}: ${raw.slice(0, 280)}`);
    }

    const payload = (await response.json()) as unknown;
    const docs = normalizeHaystackDocs(payload);
    return docs.slice(0, topK);
  } finally {
    clearTimeout(timeout);
  }
}

export async function retrieveRagDocuments(
  query: string,
  topK: number,
  timeoutMs: number
): Promise<RetrieverResult> {
  const provider = RETRIEVER_PROVIDER;

  if (provider === "hybrid") {
    const docs = await retrieveFromHybrid(query, topK);
    return { docs, provider: "hybrid", fallbackUsed: false };
  }

  try {
    const docs = await retrieveFromHaystack(query, topK, timeoutMs);
    return { docs, provider: "haystack", fallbackUsed: false };
  } catch (error) {
    const warning = error instanceof Error ? error.message : "Unknown Haystack retrieval error";
    const docs = await retrieveFromHybrid(query, topK);
    return { docs, provider: "hybrid", fallbackUsed: true, warning };
  }
}

export async function getRetrieverStatus(timeoutMs: number): Promise<RetrieverStatus> {
  const provider = RETRIEVER_PROVIDER;
  const activePreference = getPreferredProvider(provider);

  if (activePreference === "hybrid") {
    return {
      configuredProvider: provider,
      activePreference,
      haystackConfigured: isHaystackConfigured(),
      haystackHealthy: null,
    };
  }

  if (!isHaystackConfigured()) {
    return {
      configuredProvider: provider,
      activePreference,
      haystackConfigured: false,
      haystackHealthy: false,
      warning: "HAYSTACK_RETRIEVE_URL is not configured. Hybrid fallback will be used.",
    };
  }

  const health = await checkHaystackHealth(Math.max(1000, Math.min(timeoutMs, 5000)));
  return {
    configuredProvider: provider,
    activePreference,
    haystackConfigured: true,
    haystackHealthy: health.healthy,
    warning: health.warning,
  };
}
