import { getRetrieverStatus, retrieveRagDocuments } from '@/lib/domains/rag/retriever';
import os from 'node:os';

const MODEL_NAME = process.env.OLLAMA_MODEL || 'gpt-oss:20b';
const MAX_RECENT_MESSAGES = Number(process.env.CHAT_MAX_RECENT_MESSAGES || 4);
const MAX_CONTEXT_CHARS = Number(process.env.RAG_MAX_CONTEXT_CHARS || 2200);
const RAG_RETRIEVAL_K = Number(process.env.RAG_RETRIEVAL_K || 4);
const RAG_TIMEOUT_MS = Number(process.env.RAG_TIMEOUT_MS || 2500);
const RAG_ENABLE_HEALTH_CHECK = process.env.RAG_ENABLE_HEALTH_CHECK === '1';
const OLLAMA_TEMPERATURE = Number(process.env.OLLAMA_TEMPERATURE || 0.1);
const OLLAMA_TOP_P = Number(process.env.OLLAMA_TOP_P || 0.9);
const OLLAMA_NUM_PREDICT = Number(process.env.OLLAMA_NUM_PREDICT || 220);
const OLLAMA_NUM_CTX = Number(process.env.OLLAMA_NUM_CTX || 2048);
const OLLAMA_NUM_BATCH = Number(process.env.OLLAMA_NUM_BATCH || 256);
const OLLAMA_NUM_THREAD = Number(
  process.env.OLLAMA_NUM_THREAD ||
    Math.max(2, Math.floor((typeof os.availableParallelism === 'function' ? os.availableParallelism() : os.cpus().length) * 0.9))
);
const OLLAMA_NUM_GPU = process.env.OLLAMA_NUM_GPU ? Number(process.env.OLLAMA_NUM_GPU) : undefined;
const OLLAMA_KEEP_ALIVE = process.env.OLLAMA_KEEP_ALIVE || '30m';
const MIN_DOC_RELEVANCE = Number(process.env.RAG_MIN_DOC_RELEVANCE || 0.02);

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'have', 'your', 'what', 'when', 'where', 'which',
  'about', 'into', 'they', 'them', 'their', 'would', 'there', 'been', 'will', 'could', 'should', 'you',
  'are', 'was', 'were', 'how', 'can', 'our', 'any', 'please', 'help', 'tell', 'give', 'need', 'want',
]);

export const maxDuration = 300; // Allow 300s for slow local 20B LLM loads

function cleanText(value: string) {
  return value
    .replace(/\s+/g, ' ')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, ' ')
    .trim();
}

function extractQueryTerms(query: string) {
  return cleanText(query)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function docRelevanceScore(queryTerms: string[], text: string) {
  if (queryTerms.length === 0) return 0;
  const haystack = cleanText(text).toLowerCase();
  let matches = 0;
  for (const term of queryTerms) {
    if (haystack.includes(term)) matches += 1;
  }
  return matches / queryTerms.length;
}

function fallbackGuidanceForQuery(query: string) {
  const q = cleanText(query).toLowerCase();

  if (/library|libary|study space|study room|reading room/.test(q)) {
    return [
      'If exact library closing hours are unavailable in documents, guide the user to verify through the library front desk, official campus website timetable page, or student app notices.',
      'Offer practical next step: ask for their campus/location so you can suggest where to check first.',
    ].join(' ');
  }

  if (/accommodation|accomodation|housing|hostel|dorm|residence/.test(q)) {
    return [
      'If exact accommodation contact details are unavailable, guide the user to Student Services, Housing/Accommodation Office, or Campus Help Desk.',
      'Provide a short escalation order: Student Services desk -> Accommodation office email/phone -> Registrar/International office (if applicable).',
      'Ask one clarification question (on-campus vs off-campus) to tailor the guidance.',
    ].join(' ');
  }

  return [
    'When exact details are missing, provide best-effort university support channels (Student Services, department office, official website/help desk) and ask one concise clarification question.',
  ].join(' ');
}

function isActionWorkflowQuery(query: string) {
  const q = cleanText(query).toLowerCase();
  return /(book|reserve|ticket|raise|contact|reach|open|opening|hours|admission|apply|grade|marks|cost of living|finance|bursary|support)/.test(q);
}

export async function POST(req: Request) {
  try {
    const requestStartedAt = Date.now();
    const body = await req.json();
    const { messages, userId, isRestricted } = body;
    const lastUserMessage = messages[messages.length - 1]?.content || "";

    // 1. Retrieve Context using Hybrid Search
    console.log(`[MyUni AI] Processing request: "${lastUserMessage.substring(0, 50)}..."`);
    let retrieverStatus: any = {
      activePreference: process.env.RAG_RETRIEVER_PROVIDER === 'hybrid' ? 'hybrid' : 'haystack',
      warning: undefined,
    };

    if (RAG_ENABLE_HEALTH_CHECK) {
      console.log("[MyUni AI] Resolving retriever provider...");
      retrieverStatus = await getRetrieverStatus(Math.min(RAG_TIMEOUT_MS, 2500));
      if (retrieverStatus.warning) {
        console.warn(`[MyUni AI] Retriever status warning: ${retrieverStatus.warning}`);
      }
    }
    
    let relevantDocs: any[] = [];
    let retrieverProvider = 'hybrid';
    let retrieverFallbackUsed = false;
    try {
      console.log("[MyUni AI] Starting retrieval for query:", lastUserMessage);
      const retrievalStart = Date.now();
      const retrieval = await retrieveRagDocuments(lastUserMessage, RAG_RETRIEVAL_K, RAG_TIMEOUT_MS);
      relevantDocs = retrieval.docs;
      retrieverProvider = retrieval.provider;
      retrieverFallbackUsed = retrieval.fallbackUsed;
      const retrievalMs = Date.now() - retrievalStart;
      if (retrieval.warning) {
        console.warn(`[MyUni AI] Retriever warning: ${retrieval.warning}`);
      }
      console.log(
        `[MyUni AI] Retrieval finished in ${retrievalMs}ms. Provider=${retrieverProvider} fallback=${retrieverFallbackUsed} docs=${relevantDocs.length}.`
      );
    } catch (e: any) {
      console.warn("[MyUni AI] RAG Retrieval failed or timed out:", e.message);
    }

    const queryTerms = extractQueryTerms(lastUserMessage);
    const rankedDocs = relevantDocs
      .map((doc: any) => ({
        doc,
        score: docRelevanceScore(queryTerms, doc?.pageContent || ''),
      }))
      .sort((a, b) => b.score - a.score);

    const filteredDocs = rankedDocs
      .filter((entry) => entry.score >= MIN_DOC_RELEVANCE || queryTerms.length === 0)
      .slice(0, 4)
      .map((entry) => entry.doc);
    const fallbackDocs = rankedDocs.slice(0, 4).map((entry) => entry.doc);
    const hasRetrievedDocs = relevantDocs.length > 0;
    const docsForContext = filteredDocs.length >= 2
      ? filteredDocs
      : [...filteredDocs, ...fallbackDocs].slice(0, 4);
    const weakContext = !hasRetrievedDocs || docsForContext.length === 0;

    const contextChunks: string[] = [];
    let currentContextChars = 0;
    for (let i = 0; i < docsForContext.length; i++) {
      const source = docsForContext[i]?.metadata?.source || 'unknown';
      const clipped = cleanText((docsForContext[i]?.pageContent || '').slice(0, 1500));
      const nextChunk = `[Source ${i + 1} | ${source}]:\n${clipped}`;
      if (currentContextChars + nextChunk.length > MAX_CONTEXT_CHARS) break;
      contextChunks.push(nextChunk);
      currentContextChars += nextChunk.length;
    }

    let contextText = contextChunks.join('\n\n');
    
    if (!contextText.trim()) {
      contextText = "No specific university documentation found for this query.";
    }

    if (weakContext) {
      const fallbackGuidance = fallbackGuidanceForQuery(lastUserMessage);
      contextText += `\n\n[Source General Guidance]:\n${fallbackGuidance}`;
    }

    const actionWorkflowQuery = isActionWorkflowQuery(lastUserMessage);

    let systemPrompt = `You are MyUni AI, a precise virtual assistant for university students.

  Answer quality rules:
  1) Use facts present in CONTEXT for university-specific details where possible.
  2) Do not completely invent dates, policies, rooms, deadlines, names, or links.
  3) If context is insufficient, provide a generally helpful answer based on student life and your knowledge. Do not apologize excessively.
  4) Keep answers concise and practical. Start with a direct answer sentence.
  5) When using context facts, cite source tags like [Source 1].
  6) Never return an apology-only refusal. Always include at least one actionable next step.
  7) If CONTEXT includes the requested fact, state it directly, then give a short supporting detail.
  8) Do not ask follow-up questions unless the user asked something ambiguous and CONTEXT is insufficient.
  9) Assist the user naturally. You may be conversational without being overly verbose.
  10) Prefer action-first output: exact steps the student can do now.

  CONTEXT:
  ${contextText}`;

    if (actionWorkflowQuery) {
      systemPrompt += `\n\n[ACTION WORKFLOW FORMAT]\nFor this query type, answer in this order:\n- Line 1: direct answer in one sentence.\n- Then: 2-5 concrete steps the student can take immediately.\n- If exact portal/page is not in CONTEXT, say \"Not confirmed in docs\" once, then provide the best official channels and escalation path.\n- End with one short practical tip, not a disclaimer.`;
    }

    if (isRestricted) {
      systemPrompt += `\n\n[STRICT MODE]
    You must only answer university, campus, or student-life questions.
    If the question is unrelated, refuse briefly and redirect to university topics.`;

      if (weakContext) {
        systemPrompt += `\n\n[LOW CONTEXT CONFIDENCE]
The retrieved evidence is weak for this query.
    Provide the most helpful general guidance you can, based on common university practices, 
    and suggest concrete next steps for the student to investigate.`;
      }
    } else {
      systemPrompt += `\n\n[UNRESTRICTED MODE]
    You may answer general questions, but for university details prioritize CONTEXT and cite sources.`;
    }

    // 3. Call Ollama chat API directly (v2 spec) and stream response
    console.log(`[MyUni AI] Sending request to Ollama: http://127.0.0.1:11434/api/chat with model ${MODEL_NAME}`);
    
    // Sanitize messages to only include role and content (some Ollama versions are strict)
    const recentMessages = messages.slice(-MAX_RECENT_MESSAGES);
    const sanitizedMessages = [
      { role: 'system', content: systemPrompt },
      ...recentMessages.map((m: any) => ({ role: m.role, content: m.content }))
    ];

    const fetchStart = Date.now();
    const ollamaResponse = await fetch('http://127.0.0.1:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL_NAME,
        messages: sanitizedMessages,
        stream: true,
        keep_alive: OLLAMA_KEEP_ALIVE,
        options: {
          temperature: OLLAMA_TEMPERATURE,
          top_p: OLLAMA_TOP_P,
          num_predict: OLLAMA_NUM_PREDICT,
          num_ctx: OLLAMA_NUM_CTX,
          num_batch: OLLAMA_NUM_BATCH,
          num_thread: OLLAMA_NUM_THREAD,
          ...(Number.isFinite(OLLAMA_NUM_GPU) ? { num_gpu: OLLAMA_NUM_GPU } : {}),
        },
      }),
    });
    console.log(`[MyUni AI] Ollama responded in ${Date.now() - fetchStart}ms. Status: ${ollamaResponse.status}`);
    console.log(
      `[MyUni AI] Timing summary: total=${Date.now() - requestStartedAt}ms promptMessages=${recentMessages.length} retriever=${retrieverProvider} fallback=${retrieverFallbackUsed} preferred=${retrieverStatus.activePreference}`
    );

    if (!ollamaResponse.ok) {
      const errorText = await ollamaResponse.text();
      console.error(`[MyUni AI] Ollama Error (${ollamaResponse.status}):`, errorText);
      throw new Error(`Ollama API error: ${ollamaResponse.statusText}`);
    }

    // Return the raw streaming response to the client
    return new Response(ollamaResponse.body, {
      headers: { 'Content-Type': 'text/event-stream' },
    });
  } catch (error: any) {
    console.error("Chat API Error:", error);
    return new Response(JSON.stringify({ 
      error: "AI Generation failed. Ensure Ollama is running locally." 
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
