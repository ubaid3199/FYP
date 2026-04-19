import { NextResponse } from "next/server";
import { getRetrieverStatus } from "@/lib/domains/rag/retriever";

export const maxDuration = 30;

export async function GET() {
  try {
    const status = await getRetrieverStatus(3000);

    return NextResponse.json({
      success: true,
      retriever: status,
      config: {
        provider: process.env.RAG_RETRIEVER_PROVIDER || "auto",
        healthTtlMs: Number(process.env.RAG_RETRIEVER_HEALTH_TTL_MS || 60000),
        hasHaystackRetrieveUrl: Boolean(process.env.HAYSTACK_RETRIEVE_URL),
        hasHaystackHealthUrl: Boolean(process.env.HAYSTACK_HEALTH_URL),
        hasHaystackApiKey: Boolean(process.env.HAYSTACK_API_KEY),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to inspect retriever status",
      },
      { status: 500 }
    );
  }
}
