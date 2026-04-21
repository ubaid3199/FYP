import { getRetrieverStatus, retrieveRagDocuments } from '@/lib/domains/rag/retriever';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_MODEL_NAME = process.env.OLLAMA_MODEL || 'gpt-oss:20b';
const ALLOWED_CHAT_MODELS = new Set(['gemma3:1b', 'gemma3:latest', 'gemma4:e2b']);
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
const MITIGATING_CIRCUMSTANCES_PORTAL_URL =
  process.env.MITIGATING_CIRCUMSTANCES_PORTAL_URL || 'https://rulattendance.seats.cloud/angular/#/me';
const LEGACY_MITIGATING_LINKS = (
  process.env.MITIGATING_CIRCUMSTANCES_LEGACY_LINKS ||
  'https://roehamptonprod.sharepoint.com/sites/portal/nest/examinations/Pages/mitigating-circumstances.aspx,https://roehamptonprod.sharepoint.com/sites/portal/nest/examinations/Pages/Types-of-mitigating-circumstances-requests.aspx'
)
  .split(',')
  .map((value) => cleanText(value))
  .filter((value) => isHttpSource(value));
const PDF_SOURCE_MAP_PATH = path.join(process.cwd(), '..', 'pdf files', 'scraped', 'pdfs', '_source_map.json');

let cachedPdfSourceByNormName: Record<string, string> | null = null;
let cachedPdfSourceMapMtimeMs = 0;

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

function extractMostRecentYear(value: string) {
  const matches = value.match(/\b(20\d{2})\b/g) || [];
  const years = matches
    .map((item) => Number(item))
    .filter((year) => Number.isFinite(year) && year >= 2000 && year <= 2100);
  if (years.length === 0) return 0;
  return Math.max(...years);
}

function docRecencyScore(doc: any) {
  const source = cleanText(doc?.metadata?.source || '');
  const pageContent = cleanText((doc?.pageContent || '').slice(0, 2500));
  const sourceYear = extractMostRecentYear(source);
  const contentYear = extractMostRecentYear(pageContent);
  const year = Math.max(sourceYear, contentYear);
  if (!year) return 0;
  // Normalize recent years to a 0..1 range where newer years rank first.
  return Math.min(1, Math.max(0, (year - 2018) / 10));
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

function isContactDetailQuery(query: string) {
  const q = cleanText(query).toLowerCase();
  return /(email|e-mail|phone|telephone|tel|contact number|contact details)/.test(q);
}

function isSourceFollowUpQuery(query: string) {
  const q = cleanText(query).toLowerCase();
  return /(what is the source|what'?s the source|source\??|which source|citation|where did you get that|where is that from)/.test(q);
}

function isSourceRequestedQuery(query: string) {
  const q = cleanText(query).toLowerCase();
  return /(source|sources|citation|citations|reference|references|where.*from|show me (the )?source|proof)/.test(q);
}

function isSmallTalkQuery(query: string) {
  const q = cleanText(query).toLowerCase();
  return /^(hi|hello|hey|thanks|thank you|ok|okay|cool|great)\b/.test(q) || /how are you/.test(q);
}

function isFactualDetailQuery(query: string) {
  const q = cleanText(query).toLowerCase();
  return /(email|e-mail|phone|telephone|tel|contact|opening|hours|deadline|date|time|location|address|link|url|website|source|resource|reference)/.test(q);
}

function isMitigatingCircumstancesPortalQuery(query: string) {
  const q = cleanText(query).toLowerCase();
  const aboutMitigating = /(mitigat|mitigating circumstances|miligating|extenuating)/.test(q);
  const asksPortal = /(portal|link|url|page|apply|submission|submit)/.test(q);
  return aboutMitigating && asksPortal;
}

function extractUrlsFromText(text: string) {
  const matches = cleanText(text).match(/https?:\/\/[^\s)\]]+/gi) || [];
  return matches.map((item) => item.replace(/[.,;]+$/, ''));
}

function buildRelatedLinksFormsAppendixFromRanked(
  rankedDocs: Array<{ doc: any; score: number; recency: number }>,
  limit = 5
) {
  const seen = new Set<string>();
  const lines: string[] = [];
  const minScore = 0.45;

  for (const entry of rankedDocs) {
    if (entry.score < minScore) continue;

    const sourceUrl = resolveSourceUrl(entry.doc?.metadata?.source || '');
    const contentUrls = extractUrlsFromText(entry.doc?.pageContent || '');
    const candidates = sourceUrl ? [sourceUrl, ...contentUrls] : contentUrls;

    for (const url of candidates) {
      if (!isHttpSource(url) || seen.has(url)) continue;
      seen.add(url);

      const isFormLike = /(form|apply|application|portal|submit|request|booking|book)/i.test(url);
      lines.push(`- ${isFormLike ? 'Form' : 'Link'}: ${url}`);
      if (lines.length >= limit) break;
    }

    if (lines.length >= limit) break;
  }

  if (lines.length === 0) return '';
  return `\n\nHelpful links/forms:\n${lines.join('\n')}`;
}

function sourceLooksRelevant(source: string, queryTerms: string[]) {
  const normalizedSource = cleanText(source).toLowerCase();
  const meaningfulTerms = queryTerms.filter((term) => term.length >= 4);
  if (meaningfulTerms.length === 0) return true;
  return meaningfulTerms.some((term) => normalizedSource.includes(term));
}

function isHttpSource(source: string) {
  return /^https?:\/\//i.test(cleanText(source));
}

function normalizeFileNameForMatch(value: string) {
  return cleanText(value)
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/_\d+$/i, '')
    .replace(/[_\-]+/g, ' ')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildPdfSourceMapIndexIfNeeded() {
  let mtimeMs = 0;
  try {
    mtimeMs = fs.statSync(PDF_SOURCE_MAP_PATH).mtimeMs;
  } catch {
    cachedPdfSourceByNormName = {};
    cachedPdfSourceMapMtimeMs = 0;
    return;
  }

  if (cachedPdfSourceByNormName && cachedPdfSourceMapMtimeMs === mtimeMs) return;

  const nextIndex: Record<string, string> = {};
  try {
    const raw = fs.readFileSync(PDF_SOURCE_MAP_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, string>;

    for (const [key, url] of Object.entries(parsed || {})) {
      if (!url || !isHttpSource(url)) continue;
      const base = path.basename(String(key));
      const norm = normalizeFileNameForMatch(base);
      if (norm && !nextIndex[norm]) nextIndex[norm] = url;
    }
  } catch {
    // Keep index empty if parsing fails.
  }

  cachedPdfSourceByNormName = nextIndex;
  cachedPdfSourceMapMtimeMs = mtimeMs;
}

function resolveSourceUrl(source: string) {
  const clean = cleanText(source);
  if (!clean) return '';
  if (isHttpSource(clean)) return clean;

  buildPdfSourceMapIndexIfNeeded();
  const index = cachedPdfSourceByNormName || {};

  const base = path.basename(clean.replace(/\\/g, '/'));
  const norm = normalizeFileNameForMatch(base);
  if (norm && index[norm]) return index[norm];

  return '';
}

function hasResolvedHttpSource(source: string) {
  return Boolean(resolveSourceUrl(source));
}

function collectUniqueSources(docs: any[], limit = 5) {
  const seen = new Set<string>();
  const sources: string[] = [];

  for (const doc of docs) {
    const rawSource = cleanText(doc?.metadata?.source || 'unknown');
    const sourceUrl = resolveSourceUrl(rawSource);
    if (!sourceUrl || seen.has(sourceUrl)) continue;
    seen.add(sourceUrl);
    sources.push(sourceUrl);
    if (sources.length >= limit) break;
  }

  return sources;
}

function buildSourcesAppendixFromRanked(
  rankedDocs: Array<{ doc: any; score: number; recency: number }>,
  factualDetailQuery: boolean,
  limit = 5
) {
  const minSourceScore = factualDetailQuery ? 0.65 : 0.45;
  const docs = rankedDocs
    .filter((entry) => entry.score >= minSourceScore)
    .slice(0, limit)
    .map((entry) => entry.doc);

  const sources = collectUniqueSources(docs, limit);
  if (sources.length === 0) {
    if (rankedDocs.length === 0) return '';
    return `\n\nSources:\n- Not confirmed in docs (no verified URL source available)`;
  }
  return `\n\nSources:\n${sources.map((source) => `- ${source}`).join('\n')}`;
}

function singleMessageStreamResponse(message: string) {
  const payload = JSON.stringify({ message: { role: 'assistant', content: message }, done: true });
  return new Response(`${payload}\n`, {
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

export async function POST(req: Request) {
  try {
    const requestStartedAt = Date.now();
    const body = await req.json();
    const { messages, userId, isRestricted } = body;
    const requestedModel = typeof body?.model === 'string' ? body.model : '';
    const modelName = ALLOWED_CHAT_MODELS.has(requestedModel) ? requestedModel : DEFAULT_MODEL_NAME;
    const lastUserMessage = messages[messages.length - 1]?.content || "";
    const sourceFollowUpQuery = isSourceFollowUpQuery(lastUserMessage);
    const sourceRequestedQuery = isSourceRequestedQuery(lastUserMessage);
    const mitigatingPortalQuery = isMitigatingCircumstancesPortalQuery(lastUserMessage);
    const userMessages = Array.isArray(messages)
      ? messages.filter((m: any) => m?.role === 'user' && typeof m?.content === 'string').map((m: any) => m.content)
      : [];
    const priorUserMessage = userMessages.length >= 2 ? userMessages[userMessages.length - 2] : '';
    const retrievalQuery = sourceFollowUpQuery && priorUserMessage ? priorUserMessage : lastUserMessage;

    if (mitigatingPortalQuery) {
      const helpfulLines = [
        `- Form: ${MITIGATING_CIRCUMSTANCES_PORTAL_URL}`,
        ...LEGACY_MITIGATING_LINKS.map((link) => `- Link: ${link}`),
      ];

      if (sourceRequestedQuery || sourceFollowUpQuery) {
        const sources = [MITIGATING_CIRCUMSTANCES_PORTAL_URL, ...LEGACY_MITIGATING_LINKS]
          .map((link) => `- ${link}`)
          .join('\n');
        return singleMessageStreamResponse(
          `Use this Mitigating Circumstances portal link (latest): ${MITIGATING_CIRCUMSTANCES_PORTAL_URL}\n\nSources:\n${sources}`
        );
      }

      return singleMessageStreamResponse(
        `Use this Mitigating Circumstances portal link (latest): ${MITIGATING_CIRCUMSTANCES_PORTAL_URL}\n\nHelpful links/forms:\n${helpfulLines.join('\n')}`
      );
    }

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
      console.log("[MyUni AI] Starting retrieval for query:", retrievalQuery);
      const retrievalStart = Date.now();
      const retrieval = await retrieveRagDocuments(retrievalQuery, RAG_RETRIEVAL_K, RAG_TIMEOUT_MS);
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

    const queryTerms = extractQueryTerms(retrievalQuery);
    const rankedDocs = relevantDocs
      .map((doc: any) => ({
        doc,
        score: docRelevanceScore(queryTerms, doc?.pageContent || ''),
        recency: docRecencyScore(doc),
      }))
      .sort((a, b) => (b.score - a.score) || (b.recency - a.recency));

    const minRequiredRelevance = sourceFollowUpQuery
      ? Math.max(MIN_DOC_RELEVANCE, 0.85)
      : MIN_DOC_RELEVANCE;

    const filteredDocs = rankedDocs
      .filter((entry) => entry.score >= minRequiredRelevance || queryTerms.length === 0)
      .slice(0, 4)
      .map((entry) => entry.doc);
    const fallbackDocs = rankedDocs.slice(0, 4).map((entry) => entry.doc);
    const topRelevanceScore = rankedDocs[0]?.score ?? 0;
    const hasRetrievedDocs = relevantDocs.length > 0;
    const docsForContext = filteredDocs.length >= 2
      ? filteredDocs
      : [...filteredDocs, ...fallbackDocs].slice(0, 4);
    const weakContext = !hasRetrievedDocs || docsForContext.length === 0 || (queryTerms.length > 0 && topRelevanceScore < 0.75);

    const contextChunks: string[] = [];
    let currentContextChars = 0;
    for (let i = 0; i < docsForContext.length; i++) {
      const rawSource = docsForContext[i]?.metadata?.source || 'unknown';
      const source = resolveSourceUrl(rawSource) || 'unverified-local-source';
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

    if (weakContext && !sourceFollowUpQuery) {
      const fallbackGuidance = fallbackGuidanceForQuery(lastUserMessage);
      contextText += `\n\n[General Guidance]:\n${fallbackGuidance}`;
    }

    const actionWorkflowQuery = isActionWorkflowQuery(lastUserMessage);
    const contactDetailQuery = isContactDetailQuery(lastUserMessage);
    const factualDetailQuery = isFactualDetailQuery(lastUserMessage);

    const trustedSourceDocs = rankedDocs
      .filter((entry) => entry.score >= 0.9)
      .filter((entry) => sourceLooksRelevant(entry.doc?.metadata?.source || '', queryTerms))
      .filter((entry) => hasResolvedHttpSource(entry.doc?.metadata?.source || ''))
      .slice(0, 3)
      .map((entry) => entry.doc);

    if (sourceFollowUpQuery) {
      if (trustedSourceDocs.length === 0 || weakContext) {
        return singleMessageStreamResponse(
          'Not confirmed in docs. I do not have a verified source for that previous claim. Please check Student Services, Security, or the official university directory for a confirmed contact resource.'
        );
      }

      const lines = trustedSourceDocs.map((doc: any, index: number) => {
        const source = resolveSourceUrl(doc?.metadata?.source || '') || 'unknown';
        return `- [Source ${index + 1} | ${source}]`;
      });

      return singleMessageStreamResponse(`Verified sources:\n${lines.join('\n')}`);
    }

    if (factualDetailQuery && weakContext) {
      return singleMessageStreamResponse(
        'Not confirmed in docs. I cannot verify a reliable factual answer from the retrieved documents. Please use the official university directory, Student Services, or campus Security to confirm.'
      );
    }

    let systemPrompt = `You are MyUni AI, a precise virtual assistant for university students.

  Answer quality rules:
  1) Use facts present in CONTEXT for university-specific details where possible.
  2) Do not completely invent dates, policies, rooms, deadlines, names, or links.
  3) If context is insufficient, provide a generally helpful answer based on student life and your knowledge. Do not apologize excessively.
  4) Keep answers concise and practical. Start with a direct answer sentence.
  5) Only provide source/citation labels when the user explicitly asks for source/citation.
  6) Never return an apology-only refusal. Always include at least one actionable next step.
  7) If CONTEXT includes the requested fact, state it directly, then give a short supporting detail.
  8) Do not ask follow-up questions unless the user asked something ambiguous and CONTEXT is insufficient.
  9) Assist the user naturally. You may be conversational without being overly verbose.
  10) Prefer action-first output: exact steps the student can do now.
  11) Never fabricate or guess source paths/file names. Only reference source tags that actually appear in CONTEXT.
  12) If the retrieved context includes relevant links or forms for the user's request, include them for the user.

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

    if (contactDetailQuery) {
      systemPrompt += `\n\n[CONTACT DETAIL SAFETY]
For email addresses, phone numbers, and contact details:
- Only provide a specific detail if it appears verbatim in CONTEXT.
- If not present verbatim, say \"Not confirmed in docs\" and provide safe next steps (security desk, Student Services, official directory/helpdesk).
- Do not infer contact details from weak or loosely related context.`;
    }

    if (sourceFollowUpQuery) {
      systemPrompt += `\n\n[SOURCE FOLLOW-UP SAFETY]
The user is asking for the source of a previous answer.
- If CONTEXT is weak or no reliable source appears, respond: \"Not confirmed in docs.\"
- Do not output or guess file paths, document names, or source tags unless they are strongly relevant in CONTEXT.
- Never cite unrelated academic documents for operational contact/support questions.`;
    } else if (!sourceRequestedQuery) {
      systemPrompt += `\n\n[CITATION DISPLAY]
Do not include citations, source tags, or a Sources section unless the user explicitly asks for sources/citations.`;
      systemPrompt += `\nFor normal answers where links/forms are useful, include them under a heading exactly named "Helpful links/forms:" and do NOT include a "Sources:" heading.`;
    }

    // 3. Call Ollama chat API directly (v2 spec) and stream response
    console.log(`[MyUni AI] Sending request to Ollama: http://127.0.0.1:11434/api/chat with model ${modelName}`);
    
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
        model: modelName,
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

    const shouldAppendSources = sourceRequestedQuery || sourceFollowUpQuery;
    const sourcesAppendix = shouldAppendSources
      ? buildSourcesAppendixFromRanked(rankedDocs, factualDetailQuery)
      : '';
    const relatedLinksAppendix = !sourceRequestedQuery && !sourceFollowUpQuery && !isSmallTalkQuery(lastUserMessage)
      ? buildRelatedLinksFormsAppendixFromRanked(rankedDocs)
      : '';
    const appendedTail = `${relatedLinksAppendix}${sourcesAppendix}`;

    if (!ollamaResponse.body || !appendedTail) {
      return new Response(ollamaResponse.body, {
        headers: { 'Content-Type': 'text/event-stream' },
      });
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const sourceLine = `${JSON.stringify({ message: { role: 'assistant', content: appendedTail }, done: false })}\n`;

    const mergedStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const reader = ollamaResponse.body!.getReader();
        let buffer = '';
        let sourceInjected = false;

        const emitLine = (line: string) => {
          controller.enqueue(encoder.encode(`${line}\n`));
        };

        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const rawLine of lines) {
              const line = rawLine.trim();
              if (!line) continue;

              let parsed: any = null;
              try {
                parsed = JSON.parse(line);
              } catch {
                emitLine(line);
                continue;
              }

              if (!sourceInjected && parsed?.done === true) {
                controller.enqueue(encoder.encode(sourceLine));
                sourceInjected = true;
              }

              emitLine(line);
            }
          }

          if (buffer.trim()) {
            const line = buffer.trim();
            let parsed: any = null;
            try {
              parsed = JSON.parse(line);
            } catch {
              emitLine(line);
            }

            if (parsed) {
              if (!sourceInjected && parsed?.done === true) {
                controller.enqueue(encoder.encode(sourceLine));
                sourceInjected = true;
              }
              emitLine(line);
            }
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(mergedStream, {
      headers: { 'Content-Type': 'text/event-stream' },
    });
  } catch (error: any) {
    console.error("Chat API Error:", error);
    return singleMessageStreamResponse(
      'Not confirmed in docs. I could not complete the model request right now. Please try again in a moment, or switch to a lighter model like gemma3:1b.'
    );
  }
}
