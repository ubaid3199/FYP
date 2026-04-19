import { NextResponse } from "next/server";
import { getRAGStore } from "@/lib/domains/rag";

export const maxDuration = 60;

export async function GET() {
  try {
    const rag = await getRAGStore();

    const metrics = rag.getMetricsSnapshot();
    const response = {
      success: true,
      metrics,
      store: {
        parentDocumentsCount: rag.parentDocuments.length,
        documentsCount: rag.documents.length,
        embeddingsCount: rag.embeddingsStore.length,
        retrievalCacheSize: rag.retrievalCache.size,
      },
      config: {
        debugEnabled: process.env.RAG_DEBUG_METRICS === "1",
        retrievalCacheTtlMs: Number(process.env.RAG_RETRIEVAL_CACHE_TTL_MS || 60000),
        retrievalCacheMaxItems: Number(process.env.RAG_RETRIEVAL_CACHE_MAX_ITEMS || 200),
        minVectorSimilarity: Number(process.env.RAG_MIN_VECTOR_SIMILARITY || 0.12),
        minHybridScore: Number(process.env.RAG_MIN_HYBRID_SCORE || 0),
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to load RAG metrics" },
      { status: 500 }
    );
  }
}
