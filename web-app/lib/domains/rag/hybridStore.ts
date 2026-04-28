import { OllamaEmbeddings } from "@langchain/ollama";
import { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import Fuse from "fuse.js";
import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";

// Cosine similarity helper
function cosineSimilarity(a: number[], b: number[], normA?: number, normB?: number) {
  let dotProduct = 0;
  let mA = normA ?? 0;
  let mB = normB ?? 0;

  for(let i = 0; i < a.length; i++){
      dotProduct += (a[i] * b[i]);
      if (normA === undefined) mA += (a[i]*a[i]);
      if (normB === undefined) mB += (b[i]*b[i]);
  }

  if (normA === undefined) mA = Math.sqrt(mA);
  if (normB === undefined) mB = Math.sqrt(mB);

  if (!mA || !mB) return 0;
  return dotProduct / (mA * mB);
}

function vectorNorm(v: number[]) {
  let sum = 0;
  for (let i = 0; i < v.length; i++) sum += v[i] * v[i];
  return Math.sqrt(sum);
}

function getTopKByScore<T extends { score: number }>(items: T[], topK: number): T[] {
  if (topK <= 0) return [];
  const top: T[] = [];

  for (const item of items) {
    if (top.length < topK) {
      top.push(item);
      continue;
    }

    // Find current min score entry and replace only if better.
    let minIndex = 0;
    for (let i = 1; i < top.length; i++) {
      if (top[i].score < top[minIndex].score) minIndex = i;
    }

    if (item.score > top[minIndex].score) {
      top[minIndex] = item;
    }
  }

  return top.sort((a, b) => b.score - a.score);
}

const RAG_SCHEMA_VERSION = 3;
const EMBEDDING_BATCH_SIZE = Number(process.env.RAG_EMBED_BATCH_SIZE || 24);
const PARENT_CHUNK_SIZE = Number(process.env.RAG_PARENT_CHUNK_SIZE || 2600);
const PARENT_CHUNK_OVERLAP = Number(process.env.RAG_PARENT_CHUNK_OVERLAP || 300);
const CHILD_CHUNK_SIZE = Number(process.env.RAG_CHILD_CHUNK_SIZE || 800);
const CHILD_CHUNK_OVERLAP = Number(process.env.RAG_CHILD_CHUNK_OVERLAP || 150);
const RETRIEVAL_CACHE_TTL_MS = Number(process.env.RAG_RETRIEVAL_CACHE_TTL_MS || 60000);
const RETRIEVAL_CACHE_MAX_ITEMS = Number(process.env.RAG_RETRIEVAL_CACHE_MAX_ITEMS || 200);
const MIN_VECTOR_SIMILARITY = Number(process.env.RAG_MIN_VECTOR_SIMILARITY || 0.12);
const MIN_HYBRID_SCORE = Number(process.env.RAG_MIN_HYBRID_SCORE || 0);
const RAG_DEBUG_METRICS = process.env.RAG_DEBUG_METRICS === "1";

interface RetrievalMetrics {
  totalQueries: number;
  cacheHits: number;
  cacheMisses: number;
  totalLatencyMs: number;
}

const VECTOR_STORE_DIR = process.env.VECTOR_STORE_DIR || path.join(process.cwd(), ".vector_store");
const VECTOR_STORE_PATH = path.join(VECTOR_STORE_DIR, "hybrid_store.json");

function getStoreMtimeMs() {
  try {
    return fs.statSync(VECTOR_STORE_PATH).mtimeMs;
  } catch {
    return 0;
  }
}

function stableHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function childSignature(doc: Document) {
  const source = String(doc.metadata?.source || "unknown");
  const parentId = String(doc.metadata?.parentId || "");
  return stableHash(`${source}::${parentId}::${normalizeText(doc.pageContent)}`);
}

interface ParentEntry {
  id: string;
  doc: Document;
}

interface EmbeddingEntry {
  id: string;
  embedding: number[];
  norm: number;
  doc: Document;
  parentId: string;
  docIndex: number;
}

interface RetrievalCandidate {
  doc: Document;
  docIndex: number;
  parentId: string;
  score: number;
}

interface IngestStats {
  parentChunks: number;
  childChunks: number;
  embeddedChildChunks: number;
}

export class HybridRAG {
  fuse: Fuse<Document>;
  parentDocuments: ParentEntry[];
  parentById: Map<string, Document>;
  documents: Document[];
  embeddingsStore: EmbeddingEntry[];
  retrievalCache: Map<string, { expiresAt: number; docs: Document[] }>;
  metrics: RetrievalMetrics;

  constructor(private embeddings: OllamaEmbeddings) {
    this.parentDocuments = [];
    this.parentById = new Map();
    this.documents = [];
    this.embeddingsStore = [];
    this.retrievalCache = new Map();
    this.metrics = {
      totalQueries: 0,
      cacheHits: 0,
      cacheMisses: 0,
      totalLatencyMs: 0,
    };
    this.fuse = new Fuse([], {
      keys: ["pageContent"],
      includeScore: true,
      threshold: 0.6,
    });
  }

  private rebuildIndexes() {
    this.parentById = new Map(this.parentDocuments.map((entry) => [entry.id, entry.doc]));
    this.fuse = new Fuse(this.documents, {
      keys: ["pageContent"],
      includeScore: true,
      threshold: 0.6,
    });
  }

  getMetricsSnapshot() {
    const avgLatencyMs = this.metrics.totalQueries
      ? Math.round(this.metrics.totalLatencyMs / this.metrics.totalQueries)
      : 0;

    return {
      ...this.metrics,
      cacheHitRate: this.metrics.totalQueries
        ? Number((this.metrics.cacheHits / this.metrics.totalQueries).toFixed(3))
        : 0,
      avgLatencyMs,
    };
  }

  private clearRetrievalCache() {
    this.retrievalCache.clear();
  }

  private pruneRetrievalCache() {
    const now = Date.now();
    for (const [key, value] of this.retrievalCache) {
      if (value.expiresAt <= now) {
        this.retrievalCache.delete(key);
      }
    }

    if (this.retrievalCache.size <= RETRIEVAL_CACHE_MAX_ITEMS) return;

    const overflow = this.retrievalCache.size - RETRIEVAL_CACHE_MAX_ITEMS;
    let removed = 0;
    for (const key of this.retrievalCache.keys()) {
      this.retrievalCache.delete(key);
      removed += 1;
      if (removed >= overflow) break;
    }
  }

  async loadFromDisk() {
    if (fs.existsSync(VECTOR_STORE_PATH)) {
      try {
        const raw = fs.readFileSync(VECTOR_STORE_PATH, "utf-8");
        const data = JSON.parse(raw);

        this.documents = data.documents || [];

        this.parentDocuments = Array.isArray(data.parentDocuments)
          ? data.parentDocuments.map((entry: any, idx: number) => ({
              id: String(entry?.id || `legacy-parent-${idx}`),
              doc: entry?.doc,
            }))
          : this.documents.map((doc, idx) => ({
              id: `legacy-parent-${idx}`,
              doc,
            }));

        this.embeddingsStore = (data.embeddingsStore || []).map((entry: any, idx: number) => ({
          ...entry,
          parentId:
            String(entry?.parentId || entry?.doc?.metadata?.parentId || `legacy-parent-${idx}`),
          docIndex: Number.isFinite(entry?.docIndex) ? entry.docIndex : idx,
          norm: entry.norm ?? vectorNorm(entry.embedding),
        }));

        if (this.embeddingsStore.length > 0 && this.documents.length === 0) {
          this.documents = this.embeddingsStore.map((entry) => entry.doc);
        }

        this.rebuildIndexes();
        this.clearRetrievalCache();

        console.log(
          `Successfully loaded Hybrid RAG store with ${this.parentDocuments.length} parent chunks and ${this.documents.length} child chunks.`
        );
      } catch (e) {
        console.error("Failed to parse hybrid_store.json", e);
      }
    } else {
      console.log("No hybrid_store.json found. Run npm run ingest first!");
    }
  }

  async saveToDisk() {
    const data = {
      version: RAG_SCHEMA_VERSION,
      parentDocuments: this.parentDocuments,
      embeddingsStore: this.embeddingsStore,
      documents: this.documents,
    };
    const dir = path.dirname(VECTOR_STORE_PATH);

    if (!fs.existsSync(dir)) {

      fs.mkdirSync(dir, { recursive: true });

    }

    fs.writeFileSync(VECTOR_STORE_PATH, JSON.stringify(data));
    console.log("Saved hybrid store securely to disk.");
  }

  private async buildParentChildDocs(docs: Document[]) {
    const parentSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: PARENT_CHUNK_SIZE,
      chunkOverlap: PARENT_CHUNK_OVERLAP,
    });
    const childSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: CHILD_CHUNK_SIZE,
      chunkOverlap: CHILD_CHUNK_OVERLAP,
    });

    const parentEntries: ParentEntry[] = [];
    const childDocs: Document[] = [];

    for (const baseDoc of docs) {
      const source = String(baseDoc.metadata?.source || "unknown");
      const parentChunks = await parentSplitter.splitDocuments([baseDoc]);

      for (let pIndex = 0; pIndex < parentChunks.length; pIndex++) {
        const parentChunk = parentChunks[pIndex];
        const normalizedParent = normalizeText(parentChunk.pageContent);
        if (!normalizedParent) continue;

        const parentId = stableHash(`${source}::${pIndex}::${normalizedParent}`);
        const parentDoc = new Document({
          pageContent: normalizedParent,
          metadata: {
            ...baseDoc.metadata,
            source,
            parentId,
            level: "parent",
          },
        });

        parentEntries.push({ id: parentId, doc: parentDoc });

        const splitChildren = await childSplitter.splitDocuments([parentDoc]);
        for (const child of splitChildren) {
          const normalizedChild = normalizeText(child.pageContent);
          if (!normalizedChild) continue;

          childDocs.push(
            new Document({
              pageContent: normalizedChild,
              metadata: {
                ...child.metadata,
                ...baseDoc.metadata,
                source,
                parentId,
                level: "child",
              },
            })
          );
        }
      }
    }

    return { parentEntries, childDocs };
  }

  async ingestDocuments(docs: Document[], options: { append?: boolean } = { append: false }): Promise<IngestStats> {
    const appendMode = Boolean(options.append);
    const { parentEntries, childDocs } = await this.buildParentChildDocs(docs);
    console.log(
      `Prepared ${parentEntries.length} parent chunks and ${childDocs.length} child chunks for embedding.`
    );

    if (!appendMode) {
      this.parentDocuments = [];
      this.parentById.clear();
      this.embeddingsStore = [];
      this.documents = [];
    }

    this.clearRetrievalCache();

    const existingChildHashes = new Set<string>();
    if (appendMode) {
      for (const existing of this.documents) {
        existingChildHashes.add(childSignature(existing));
      }
    }

    const filteredChildren: Document[] = [];
    const requiredParentIds = new Set<string>();
    for (const child of childDocs) {
      const signature = childSignature(child);
      if (existingChildHashes.has(signature)) continue;
      existingChildHashes.add(signature);
      filteredChildren.push(child);
      requiredParentIds.add(String(child.metadata?.parentId || ""));
    }

    if (filteredChildren.length === 0) {
      console.log("No new unique child chunks found for ingestion.");
      return {
        parentChunks: parentEntries.length,
        childChunks: childDocs.length,
        embeddedChildChunks: 0,
      };
    }

    const parentMap = new Map(parentEntries.map((entry) => [entry.id, entry.doc]));
    const newParentEntries: ParentEntry[] = [];
    for (const parentId of requiredParentIds) {
      if (!parentId) continue;
      if (appendMode && this.parentById.has(parentId)) continue;
      const parentDoc = parentMap.get(parentId);
      if (parentDoc) {
        newParentEntries.push({ id: parentId, doc: parentDoc });
      }
    }

    if (newParentEntries.length > 0) {
      this.parentDocuments = [...this.parentDocuments, ...newParentEntries];
    }

    const startDocIndex = this.documents.length;
    console.log(`Embedding ${filteredChildren.length} child chunks into Vector Store... this might take a minute!`);

    for (let i = 0; i < filteredChildren.length; i += EMBEDDING_BATCH_SIZE) {
      const batchDocs = filteredChildren.slice(i, i + EMBEDDING_BATCH_SIZE);
      const texts = batchDocs.map((d) => d.pageContent);
      console.log(`Embedding child chunks ${i + 1}-${Math.min(i + batchDocs.length, filteredChildren.length)}/${filteredChildren.length}`);

      const batchEmbeddings = await this.embeddings.embedDocuments(texts);
      for (let j = 0; j < batchDocs.length; j++) {
        const docIndex = startDocIndex + i + j;
        const doc = batchDocs[j];
        const embedding = batchEmbeddings[j];
        this.embeddingsStore.push({
          id: `child-${docIndex}`,
          embedding,
          norm: vectorNorm(embedding),
          doc,
          parentId: String(doc.metadata?.parentId || ""),
          docIndex,
        });
      }
    }

    this.documents = [...this.documents, ...filteredChildren];
    this.rebuildIndexes();
    await this.saveToDisk();

    return {
      parentChunks: parentEntries.length,
      childChunks: childDocs.length,
      embeddedChildChunks: filteredChildren.length,
    };
  }

  async retrieve(query: string, topK: number = 5): Promise<Document[]> {
    if (this.documents.length === 0 || this.embeddingsStore.length === 0) return [];

    const retrievalStart = Date.now();
    this.metrics.totalQueries += 1;

    const normalizedQuery = query.trim().toLowerCase();
    const cacheKey = `${topK}:${normalizedQuery}`;
    const now = Date.now();
    const cached = this.retrievalCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      this.metrics.cacheHits += 1;
      const latencyMs = Date.now() - retrievalStart;
      this.metrics.totalLatencyMs += latencyMs;

      if (RAG_DEBUG_METRICS) {
        console.log(
          `[MyUni RAG Metrics] cache=hit latency=${latencyMs}ms topK=${topK} query="${query.slice(0, 60)}"`
        );
      }
      return cached.docs;
    }

    this.metrics.cacheMisses += 1;

    this.pruneRetrievalCache();

    // 1. Vector Search (Semantic)
    const queryEmbedding = await this.embeddings.embedQuery(query);
    const queryNorm = vectorNorm(queryEmbedding);

    const candidateK = Math.max(topK * 4, 8);
    const vectorScored = this.embeddingsStore.map((entry) => ({
      doc: entry.doc,
      docIndex: entry.docIndex,
      parentId: entry.parentId,
      score: cosineSimilarity(queryEmbedding, entry.embedding, queryNorm, entry.norm),
    }));

    const vectorResults = getTopKByScore(vectorScored, candidateK).filter(
      (result) => result.score >= MIN_VECTOR_SIMILARITY
    );
    
    // 2. Keyword Search (BM25 equivalent via Fuse options)
    const fuseResults = this.fuse.search(query).slice(0, candidateK);

    // Reciprocal Rank Fusion (Combining vector & keyword scores)
    const combinedScores = new Map<string, RetrievalCandidate>();
    const k = 60; 

    vectorResults.forEach((result, index) => {
      const rrfScore = 1 / (k + index + 1);
      const key = `idx-${result.docIndex}`;
      combinedScores.set(key, {
        doc: result.doc,
        docIndex: result.docIndex,
        parentId: result.parentId,
        score: rrfScore,
      });
    });

    fuseResults.forEach((result: any, index: number) => {
      const key = `idx-${result.refIndex}`;
      const current = combinedScores.get(key);
      const rrfScore = 1 / (k + index + 1);
      combinedScores.set(key, {
        doc: result.item,
        docIndex: result.refIndex,
        parentId: String(result.item?.metadata?.parentId || current?.parentId || ""),
        score: (current?.score || 0) + rrfScore,
      });
    });

    const hybridSorted = getTopKByScore(Array.from(combinedScores.values()), topK)
      .filter((item) => item.score >= MIN_HYBRID_SCORE);

    const rankedChildren =
      hybridSorted.length > 0
        ? hybridSorted
        : getTopKByScore(Array.from(combinedScores.values()), candidateK);

    const parentScores = new Map<string, { score: number; doc: Document }>();
    for (const child of rankedChildren) {
      const parentId = child.parentId || `legacy-parent-${child.docIndex}`;
      const parentDoc = this.parentById.get(parentId) || child.doc;
      const previous = parentScores.get(parentId);
      if (!previous || child.score > previous.score) {
        parentScores.set(parentId, { score: child.score, doc: parentDoc });
      }
    }

    const sorted = getTopKByScore(
      Array.from(parentScores.values()).map((entry) => ({ score: entry.score, doc: entry.doc })),
      topK
    ).map((entry) => entry.doc);

    this.retrievalCache.set(cacheKey, {
      expiresAt: Date.now() + RETRIEVAL_CACHE_TTL_MS,
      docs: sorted,
    });

    const latencyMs = Date.now() - retrievalStart;
    this.metrics.totalLatencyMs += latencyMs;

    if (RAG_DEBUG_METRICS) {
      const topVectorScore = vectorResults[0]?.score?.toFixed(3) ?? "n/a";
      const topHybridScore = hybridSorted[0]?.score?.toFixed(4) ?? "n/a";
      console.log(
        `[MyUni RAG Metrics] cache=miss latency=${latencyMs}ms vectorCandidates=${vectorScored.length} vectorAfterThreshold=${vectorResults.length} fuseHits=${fuseResults.length} hybridAfterThreshold=${hybridSorted.length} parentHits=${sorted.length} topVector=${topVectorScore} topHybrid=${topHybridScore} topK=${topK}`
      );

      if (this.metrics.totalQueries % 10 === 0) {
        const snapshot = this.getMetricsSnapshot();
        console.log(
          `[MyUni RAG Metrics] summary queries=${snapshot.totalQueries} hitRate=${snapshot.cacheHitRate} avgLatency=${snapshot.avgLatencyMs}ms cacheSize=${this.retrievalCache.size}`
        );
      }
    }

    return sorted;
  }
}

// Global Singleton for Next.js App Router (Prevents reloading the store on every request)
let globalRagStore: HybridRAG | null = null;
let globalLoadingPromise: Promise<HybridRAG> | null = null;
let globalStoreLoadedAtMtimeMs = 0;

export async function getRAGStore() {
  console.log("[MyUni RAG] getRAGStore called. Store exists:", !!globalRagStore, "Loading:", !!globalLoadingPromise);
  if (globalRagStore) {
    const currentStoreMtime = getStoreMtimeMs();
    if (currentStoreMtime <= globalStoreLoadedAtMtimeMs) {
      return globalRagStore;
    }

    console.log("[MyUni RAG] Detected updated hybrid_store.json on disk. Reloading store...");
    globalRagStore = null;
  }
  if (globalLoadingPromise) return globalLoadingPromise;

  globalLoadingPromise = (async () => {
    console.log("[MyUni RAG] Initializing store globally...");
    try {
      const embeddings = new OllamaEmbeddings({ 
        model: process.env.OLLAMA_EMBEDDING_MODEL || "nomic-embed-text:latest",
        baseUrl: 'http://127.0.0.1:11434',
      });
      const store = new HybridRAG(embeddings);
      await store.loadFromDisk();
      console.log("[MyUni RAG] Store initialized successfully.");
      globalRagStore = store;
      globalStoreLoadedAtMtimeMs = getStoreMtimeMs();
      return store;
    } catch (err) {
      console.error("[MyUni RAG] Initialization FAILED:", err);
      globalLoadingPromise = null;
      throw err;
    } finally {
      globalLoadingPromise = null;
    }
  })();

  return globalLoadingPromise;
}
