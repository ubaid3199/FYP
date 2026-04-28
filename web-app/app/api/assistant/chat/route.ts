import { getRetrieverStatus, retrieveRagDocuments } from '@/lib/domains/rag/retriever';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_MODEL_NAME = process.env.OLLAMA_MODEL || 'gpt-oss:20b';
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
const OLLAMA_MODEL_CACHE_TTL_MS = Number(process.env.OLLAMA_MODEL_CACHE_TTL_MS || 30_000);
const FALLBACK_CHAT_MODELS = new Set(['automatic', 'gemma3:1b', 'gemma3:latest', 'gemma4:e2b', 'gemma4:e4b', 'llava:llava', 'llava:latest', 'gpt-oss:20b', 'llama3']);
const MAX_RECENT_MESSAGES = Number(process.env.CHAT_MAX_RECENT_MESSAGES || 4);
const MAX_CONTEXT_CHARS = Number(process.env.RAG_MAX_CONTEXT_CHARS || 6000);
const RAG_RETRIEVAL_K = Number(process.env.RAG_RETRIEVAL_K || 6);
const RAG_TIMEOUT_MS = Number(process.env.RAG_TIMEOUT_MS || 5000);
const RAG_ENABLE_HEALTH_CHECK = process.env.RAG_ENABLE_HEALTH_CHECK === '1';
const OLLAMA_TEMPERATURE = Number(process.env.OLLAMA_TEMPERATURE || 0.15);
const OLLAMA_TOP_P = Number(process.env.OLLAMA_TOP_P || 0.9);
const OLLAMA_NUM_PREDICT = Number(process.env.OLLAMA_NUM_PREDICT || 512);
const OLLAMA_NUM_CTX = Number(process.env.OLLAMA_NUM_CTX || 4096);
const OLLAMA_NUM_BATCH = Number(process.env.OLLAMA_NUM_BATCH || 256);
const OLLAMA_NUM_THREAD = Number(
  process.env.OLLAMA_NUM_THREAD ||
    Math.max(2, Math.floor((typeof os.availableParallelism === 'function' ? os.availableParallelism() : os.cpus().length) * 0.9))
);
// Default to GPU acceleration for answer generation unless explicitly overridden.
const OLLAMA_NUM_GPU = process.env.OLLAMA_NUM_GPU ? Number(process.env.OLLAMA_NUM_GPU) : -1;
const OLLAMA_KEEP_ALIVE = process.env.OLLAMA_KEEP_ALIVE || '30m';
const MIN_DOC_RELEVANCE = Number(process.env.RAG_MIN_DOC_RELEVANCE || 0.02);
const WEAK_CONTEXT_THRESHOLD = Number(process.env.RAG_WEAK_CONTEXT_THRESHOLD || 0.18);
const SOURCE_FOLLOWUP_MIN_RELEVANCE = Number(process.env.RAG_SOURCE_FOLLOWUP_MIN_RELEVANCE || 0.55);
const TRUSTED_SOURCE_MIN_RELEVANCE = Number(process.env.RAG_TRUSTED_SOURCE_MIN_RELEVANCE || 0.70);
const MITIGATING_CIRCUMSTANCES_PORTAL_URL =
  process.env.MITIGATING_CIRCUMSTANCES_PORTAL_URL || 'https://roehamptonprod.sharepoint.com/sites/portal/nest/examinations/Pages/mitigating-circumstances.aspx';
const LEGACY_MITIGATING_LINKS = (
  process.env.MITIGATING_CIRCUMSTANCES_LEGACY_LINKS ||
  'https://rulattendance.seats.cloud/angular/#/me,https://roehamptonprod.sharepoint.com/sites/portal/nest/examinations/Pages/mitigating-circumstances.aspx,https://roehamptonprod.sharepoint.com/sites/portal/nest/examinations/Pages/Types-of-mitigating-circumstances-requests.aspx'
)
  .split(',')
  .map((value) => cleanText(value))
  .filter((value) => isHttpSource(value));
const SCRAPED_DOCS_DIR_SETTING = cleanText(process.env.SCRAPED_DOCS_DIR || 'scraped') || 'scraped';
const SCRAPED_DOCS_DIR = path.isAbsolute(SCRAPED_DOCS_DIR_SETTING)
  ? SCRAPED_DOCS_DIR_SETTING
  : path.join(process.cwd(), '..', 'pdf files', SCRAPED_DOCS_DIR_SETTING);
const PDF_SOURCE_MAP_PATH = path.join(SCRAPED_DOCS_DIR, 'pdfs', '_source_map.json');
const DOC_SOURCE_MAP_PATH = path.join(SCRAPED_DOCS_DIR, 'docs', '_source_map.json');
const PAGE_SOURCE_MAP_PATH = path.join(SCRAPED_DOCS_DIR, '_page_source_map.json');

let cachedPdfSourceByNormName: Record<string, string> | null = null;
let cachedPdfSourceMapMtimeMs = 0;
let cachedDocSourceByNormName: Record<string, string> | null = null;
let cachedDocSourceMapMtimeMs = 0;
let cachedPageSourceByNormName: Record<string, string> | null = null;
let cachedPageSourceByRelPath: Record<string, string> | null = null;
let cachedPageSourceMapMtimeMs = 0;
let cachedAllowedSourceUrls: Set<string> | null = null;
let cachedAllowedSourceUrlsPdfMtimeMs = 0;
let cachedAllowedSourceUrlsDocMtimeMs = 0;
let cachedAllowedSourceUrlsPageMtimeMs = 0;

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'have', 'your', 'what', 'when', 'where', 'which',
  'about', 'into', 'they', 'them', 'their', 'would', 'there', 'been', 'will', 'could', 'should', 'you',
  'are', 'was', 'were', 'how', 'can', 'our', 'any', 'please', 'help', 'tell', 'give', 'need', 'want',
]);

export const maxDuration = 300; // Allow 300s for slow local 20B LLM loads

let cachedInstalledChatModels: string[] | null = null;
let cachedInstalledChatModelsAtMs = 0;

function looksLikeEmbeddingModel(name: string) {
  const lower = cleanText(name).toLowerCase();
  return lower.includes('embed') || lower.includes('embedding');
}

async function getInstalledChatModels(): Promise<string[]> {
  const now = Date.now();
  if (cachedInstalledChatModels && now - cachedInstalledChatModelsAtMs < OLLAMA_MODEL_CACHE_TTL_MS) {
    return cachedInstalledChatModels;
  }

  try {
    const res = await fetch(`${OLLAMA_BASE_URL.replace(/\/$/, '')}/api/tags`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    if (!res.ok) {
      cachedInstalledChatModels = Array.from(FALLBACK_CHAT_MODELS).filter((m) => m !== 'automatic');
      cachedInstalledChatModelsAtMs = now;
      return cachedInstalledChatModels;
    }

    const data = (await res.json().catch(() => null)) as any;
    const rawModels: string[] = Array.isArray(data?.models)
      ? data.models.map((m: any) => cleanText(m?.name)).filter(Boolean)
      : [];

    const models = rawModels.filter((name) => !looksLikeEmbeddingModel(name));
    cachedInstalledChatModels = models;
    cachedInstalledChatModelsAtMs = now;
    return models;
  } catch {
    cachedInstalledChatModels = Array.from(FALLBACK_CHAT_MODELS).filter((m) => m !== 'automatic');
    cachedInstalledChatModelsAtMs = now;
    return cachedInstalledChatModels;
  }
}

function pickFirstAvailable(preferred: string[], available: Set<string>) {
  for (const name of preferred) {
    if (available.has(name)) return name;
  }
  return '';
}

function pickAutomaticModel(userText: string, available: Set<string>) {
  const q = cleanText(userText).toLowerCase();

  const wantsVision = /\b(image|photo|picture|screenshot|diagram|vision)\b/.test(q);
  if (wantsVision) {
    const vision = pickFirstAvailable(['llava:latest', 'llava:llava'], available);
    if (vision) return vision;
  }

  const isLongOrAnalytical = q.split(/\s+/).filter(Boolean).length > 25 || /\b(explain in detail|compare|analyze|analyse|comprehensive|step.by.step breakdown)\b/.test(q);
  if (isLongOrAnalytical) {
    const heavy = pickFirstAvailable(['gpt-oss:20b', 'gemma4:e4b', 'llama3'], available);
    if (heavy) return heavy;
  }

  if (isSimpleQuestion(userText)) {
    const light = pickFirstAvailable(['gemma3:latest', 'gemma3:1b'], available);
    if (light) return light;
  }

  const general = pickFirstAvailable(['gemma4:e4b', 'gemma4:e2b', 'gpt-oss:20b', 'llama3', 'gemma3:latest'], available);
  if (general) return general;

  // As a last resort, pick any installed model.
  return available.values().next().value || DEFAULT_MODEL_NAME;
}

function cleanText(value: string) {
  return value
    .replace(/\s+/g, ' ')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, ' ')
    .trim();
}

function tokenize(value: string) {
  return cleanText(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function stemToken(token: string) {
  // Very small stemming to improve match quality without heavy NLP.
  if (token.length <= 4) return token;
  if (token.endsWith('ies') && token.length > 5) return token.slice(0, -3) + 'y';
  if (token.endsWith('ing') && token.length > 6) return token.slice(0, -3);
  if (token.endsWith('ed') && token.length > 5) return token.slice(0, -2);
  if (token.endsWith('s') && token.length > 4) return token.slice(0, -1);
  return token;
}

function extractQueryTerms(query: string) {
  const tokens = tokenize(query)
    .map((token) => token.length >= 3 ? token : '')
    .filter((token) => token && !STOP_WORDS.has(token));

  const expanded: string[] = [];
  for (const token of tokens) {
    expanded.push(token);
    const stem = stemToken(token);
    if (stem && stem !== token) expanded.push(stem);
  }

  // De-dupe while keeping order.
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const term of expanded) {
    if (seen.has(term)) continue;
    seen.add(term);
    unique.push(term);
  }
  return unique;
}

function docRelevanceScore(queryTerms: string[], text: string) {
  if (queryTerms.length === 0) return 0;

  const tokens = tokenize(String(text || '').slice(0, 12000));
  if (tokens.length === 0) return 0;

  const tokenSet = new Set<string>();
  for (const token of tokens) {
    if (token.length < 3) continue;
    tokenSet.add(token);
    const stem = stemToken(token);
    if (stem) tokenSet.add(stem);
  }

  let matches = 0;
  for (const term of queryTerms) {
    if (!term) continue;
    if (tokenSet.has(term)) {
      matches += 1;
      continue;
    }

    // Prefix fallback helps with minor variants like "accommodat" vs "accommodation".
    if (term.length >= 5) {
      const foundPrefix = tokens.some((tok) => tok.startsWith(term) || term.startsWith(tok));
      if (foundPrefix) matches += 1;
    }
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

function isSecurityContactIntent(query: string) {
  const q = cleanText(query).toLowerCase();
  const mentionsSecurity = /(security|campus safety|safety and security|campus security|emergency)/.test(q);
  const asksContact = /(contact|reach|call|phone|email|number|help|report)/.test(q);
  return mentionsSecurity && asksContact;
}

function isSourceFollowUpQuery(query: string) {
  const q = cleanText(query).toLowerCase();
  return (
    /^(source\??|sources\??)$/.test(q) ||
    /(what is the source|what'?s the source|which source|where did you get that|where is that from|cite that|show the source for that)/.test(q)
  );
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

function isLinkOrFormRequestQuery(query: string) {
  const q = cleanText(query).toLowerCase();
  return /(link|links|url|urls|website|web page|webpage|form|forms|portal|source|sources|citation|reference)/.test(q);
}

function isSimpleQuestion(query: string) {
  const clean = cleanText(query).toLowerCase();
  if (!clean) return true;
  if (isSmallTalkQuery(clean)) return true;

  // Complex intent keywords always need a smarter model
  const hasComplexIntent = /(mental|health|wellbeing|support|welfare|counsel|anxiety|stress|depress|accommodation|mitigat|appeal|complaint|academic|finance|bursary|disability|tuition|withdraw|suspend|defer|extenuate|plagiarism|misconduct)/.test(clean);
  if (hasComplexIntent) return false;

  const hasExplicitLinkIntent = isLinkOrFormRequestQuery(clean);
  const wordCount = clean.split(/\s+/).filter(Boolean).length;
  return wordCount <= 6 && !hasExplicitLinkIntent;
}

function isMitigatingCircumstancesPortalQuery(query: string) {
  const q = cleanText(query).toLowerCase();
  const aboutMitigating = /(mitigat|mitigating circumstances|miligating|extenuating)/.test(q);
  const asksPortal = /(portal|link|url|page|apply|submission|submit)/.test(q);
  return aboutMitigating && asksPortal;
}

function isUniversityDomainQuery(query: string) {
  const q = cleanText(query).toLowerCase();
  if (!q) return false;
  return /(roehampton|university|campus|student|module|assessment|library|timetable|portal|bursary|finance|accommodation|security|wellbeing|disability|extenuat|mitigat|appeal|complaint|attendance)/.test(q);
}

function extractUrlsFromText(text: string) {
  const matches = cleanText(text).match(/https?:\/\/[^\s)\]]+/gi) || [];
  return matches.map((item) => item.replace(/[.,;]+$/, ''));
}

function isAuthOrLoginUrl(url: string) {
  const value = cleanText(url).toLowerCase();
  return (
    value.includes('sts.roehampton.ac.uk') ||
    value.includes('/adfs/') ||
    value.includes('/login') ||
    value.includes('/signin') ||
    value.includes('wa=wsignin1.0') ||
    value.includes('wtrealm=')
  );
}

function isBlockedAnswerUrl(url: string) {
  const value = cleanText(url).toLowerCase();
  return (
    value.includes('/_layouts/') ||
    value.includes('login_hint=') ||
    value.includes('/signin') ||
    value.includes('/login') ||
    value.includes('sts.roehampton.ac.uk') ||
    value.includes('/adfs/') ||
    value.includes('wa=wsignin1.0') ||
    value.includes('wtrealm=')
  );
}

function buildAllowedSourceUrlsIfNeeded() {
  let pdfMtimeMs = 0;
  let docMtimeMs = 0;
  let pageMtimeMs = 0;
  try {
    pdfMtimeMs = fs.statSync(PDF_SOURCE_MAP_PATH).mtimeMs;
  } catch {
    pdfMtimeMs = 0;
  }
  try {
    docMtimeMs = fs.statSync(DOC_SOURCE_MAP_PATH).mtimeMs;
  } catch {
    docMtimeMs = 0;
  }
  try {
    pageMtimeMs = fs.statSync(PAGE_SOURCE_MAP_PATH).mtimeMs;
  } catch {
    pageMtimeMs = 0;
  }

  if (
    cachedAllowedSourceUrls &&
    cachedAllowedSourceUrlsPdfMtimeMs === pdfMtimeMs &&
    cachedAllowedSourceUrlsDocMtimeMs === docMtimeMs &&
    cachedAllowedSourceUrlsPageMtimeMs === pageMtimeMs
  ) {
    return;
  }

  const allowed = new Set<string>();
  try {
    const raw = fs.readFileSync(PDF_SOURCE_MAP_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, string>;
    for (const value of Object.values(parsed || {})) {
      const url = cleanText(String(value || ''));
      if (isHttpSource(url) && !isBlockedAnswerUrl(url) && !isAuthOrLoginUrl(url)) {
        allowed.add(url);
      }
    }
  } catch {
    // Ignore map parse failures.
  }

  try {
    const raw = fs.readFileSync(DOC_SOURCE_MAP_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, string>;
    for (const value of Object.values(parsed || {})) {
      const url = cleanText(String(value || ''));
      if (isHttpSource(url) && !isBlockedAnswerUrl(url) && !isAuthOrLoginUrl(url)) {
        allowed.add(url);
      }
    }
  } catch {
    // Ignore map parse failures.
  }

  try {
    const raw = fs.readFileSync(PAGE_SOURCE_MAP_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, string>;
    for (const value of Object.values(parsed || {})) {
      const url = cleanText(String(value || ''));
      if (isHttpSource(url) && !isBlockedAnswerUrl(url) && !isAuthOrLoginUrl(url)) {
        allowed.add(url);
      }
    }
  } catch {
    // Ignore map parse failures.
  }

  allowed.add(MITIGATING_CIRCUMSTANCES_PORTAL_URL);
  for (const link of LEGACY_MITIGATING_LINKS) {
    if (isHttpSource(link) && !isBlockedAnswerUrl(link) && !isAuthOrLoginUrl(link)) {
      allowed.add(link);
    }
  }

  cachedAllowedSourceUrls = allowed;
  cachedAllowedSourceUrlsPdfMtimeMs = pdfMtimeMs;
  cachedAllowedSourceUrlsDocMtimeMs = docMtimeMs;
  cachedAllowedSourceUrlsPageMtimeMs = pageMtimeMs;
}

function isAllowedAnswerUrl(url: string) {
  const normalized = cleanText(url).replace(/[\],.;]+$/, '');
  if (!isHttpSource(normalized)) return false;
  if (isBlockedAnswerUrl(normalized) || isAuthOrLoginUrl(normalized)) return false;
  buildAllowedSourceUrlsIfNeeded();
  return Boolean(cachedAllowedSourceUrls?.has(normalized));
}

function sanitizeUrlsInText(text: string) {
  return String(text || '').replace(/https?:\/\/[^\s)\]>"]+/gi, (raw) => {
    const candidate = cleanText(raw).replace(/[\],.;]+$/, '');
    return isAllowedAnswerUrl(candidate) ? candidate : '[Not confirmed in docs]';
  });
}

function collectKeywordFallbackLinks(query: string, limit = 4) {
  buildAllowedSourceUrlsIfNeeded();
  const urls = Array.from(cachedAllowedSourceUrls || []);
  if (urls.length === 0) return [];
  const terms = extractQueryTerms(query).filter((term) => term.length >= 4);
  // Don't return random URLs when we have no keyword signal
  if (terms.length === 0) return [];

  const ranked = urls
    .map((url) => {
      const hay = url.toLowerCase();
      const score = terms.reduce((count, term) => (hay.includes(term) ? count + 1 : count), 0);
      return { url, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.url.length - b.url.length)
    .map((entry) => entry.url);

  if (ranked.length === 0) {
    return [];
  }

  return ranked.slice(0, limit);
}

function collectVerifiedLinksFromRanked(
  rankedDocs: Array<{ doc: any; score: number; recency: number }>,
  query: string,
  limit = 6
) {
  const seen = new Set<string>();
  const queryTerms = extractQueryTerms(query).filter((term) => term.length >= 4);
  const matched: string[] = [];
  const unmatched: string[] = [];

  for (const entry of rankedDocs) {
    // Only use the verified source URL — never extract URLs from raw page content
    const sourceUrl = resolveSourceUrl(entry.doc?.metadata?.source || '');
    if (!sourceUrl || !isAllowedAnswerUrl(sourceUrl) || seen.has(sourceUrl)) continue;
    seen.add(sourceUrl);

    const haystack = sourceUrl.toLowerCase();
    const termMatched = queryTerms.length === 0 || queryTerms.some((term) => haystack.includes(term));
    if (termMatched) matched.push(sourceUrl);
    else unmatched.push(sourceUrl);

    if (matched.length + unmatched.length >= limit * 2) break;
  }

  return [...matched, ...unmatched].slice(0, limit);
}

function buildRelatedLinksFormsAppendixFromRanked(
  rankedDocs: Array<{ doc: any; score: number; recency: number }>,
  limit = 5
) {
  const seen = new Set<string>();
  const lines: string[] = [];
  const minScore = 0.3;

  for (const entry of rankedDocs) {
    if (entry.score < minScore) continue;
    // Only use verified source URL — never content-extracted URLs
    const sourceUrl = resolveSourceUrl(entry.doc?.metadata?.source || '');
    if (!sourceUrl || !isAllowedAnswerUrl(sourceUrl) || seen.has(sourceUrl)) continue;
    seen.add(sourceUrl);

    const isFormLike = /(form|apply|application|portal|submit|request|booking|book)/i.test(sourceUrl);
    lines.push(`- ${isFormLike ? 'Form' : 'Link'}: ${sourceUrl}`);
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

function buildDocSourceMapIndexIfNeeded() {
  let mtimeMs = 0;
  try {
    mtimeMs = fs.statSync(DOC_SOURCE_MAP_PATH).mtimeMs;
  } catch {
    cachedDocSourceByNormName = {};
    cachedDocSourceMapMtimeMs = 0;
    return;
  }

  if (cachedDocSourceByNormName && cachedDocSourceMapMtimeMs === mtimeMs) return;

  const nextIndex: Record<string, string> = {};
  try {
    const raw = fs.readFileSync(DOC_SOURCE_MAP_PATH, 'utf-8');
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

  cachedDocSourceByNormName = nextIndex;
  cachedDocSourceMapMtimeMs = mtimeMs;
}

function buildPageSourceMapIndexIfNeeded() {
  let mtimeMs = 0;
  try {
    mtimeMs = fs.statSync(PAGE_SOURCE_MAP_PATH).mtimeMs;
  } catch {
    cachedPageSourceByNormName = {};
    cachedPageSourceByRelPath = {};
    cachedPageSourceMapMtimeMs = 0;
    return;
  }

  if (cachedPageSourceByNormName && cachedPageSourceByRelPath && cachedPageSourceMapMtimeMs === mtimeMs) return;

  const byNormName: Record<string, string> = {};
  const byRelPath: Record<string, string> = {};
  try {
    const raw = fs.readFileSync(PAGE_SOURCE_MAP_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, string>;

    for (const [key, url] of Object.entries(parsed || {})) {
      if (!url || !isHttpSource(url)) continue;

      const rel = cleanText(String(key).replace(/\\/g, '/'));
      if (rel) byRelPath[rel.toLowerCase()] = url;

      const base = path.basename(String(key));
      const norm = normalizeFileNameForMatch(base);
      if (norm && !byNormName[norm]) byNormName[norm] = url;
    }
  } catch {
    // Keep indexes empty if parsing fails.
  }

  cachedPageSourceByNormName = byNormName;
  cachedPageSourceByRelPath = byRelPath;
  cachedPageSourceMapMtimeMs = mtimeMs;
}

function resolveSourceUrl(source: string) {
  const clean = cleanText(source);
  if (!clean) return '';
  if (isHttpSource(clean)) return clean;

  buildPdfSourceMapIndexIfNeeded();
  buildDocSourceMapIndexIfNeeded();
  buildPageSourceMapIndexIfNeeded();
  const index = cachedPdfSourceByNormName || {};
  const docIndex = cachedDocSourceByNormName || {};
  const pageByName = cachedPageSourceByNormName || {};
  const pageByPath = cachedPageSourceByRelPath || {};

  const normalizedPath = clean.replace(/\\/g, '/').toLowerCase();
  if (pageByPath[normalizedPath]) return pageByPath[normalizedPath];

  const base = path.basename(clean.replace(/\\/g, '/'));
  const norm = normalizeFileNameForMatch(base);
  if (norm && index[norm]) return index[norm];
  if (norm && docIndex[norm]) return docIndex[norm];
  if (norm && pageByName[norm]) return pageByName[norm];

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
  const payload = JSON.stringify({ message: { role: 'assistant', content: sanitizeUrlsInText(message) }, done: true });
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
    const lastUserMessage = messages[messages.length - 1]?.content || "";

    const installedModels = await getInstalledChatModels();
    const available = new Set(installedModels.length > 0 ? installedModels : Array.from(FALLBACK_CHAT_MODELS).filter((m) => m !== 'automatic'));

    let modelName = DEFAULT_MODEL_NAME;
    if (requestedModel === 'automatic' || !requestedModel) {
      modelName = pickAutomaticModel(lastUserMessage, available);
    } else if (available.has(requestedModel)) {
      modelName = requestedModel;
    } else if (available.has(DEFAULT_MODEL_NAME)) {
      modelName = DEFAULT_MODEL_NAME;
    } else {
      modelName = available.values().next().value || DEFAULT_MODEL_NAME;
    }

    console.log(`[MyUni AI] Model selected: requested="${requestedModel || '(none)'}" resolved="${modelName}" available=${available.size}`);

    const sourceFollowUpQuery = isSourceFollowUpQuery(lastUserMessage);
    const sourceRequestedQuery = isSourceRequestedQuery(lastUserMessage);
    const linkOrFormRequestQuery = isLinkOrFormRequestQuery(lastUserMessage);
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
      .map((doc: any) => {
        const textScore = docRelevanceScore(queryTerms, doc?.pageContent || '');
        const sourceScore = docRelevanceScore(queryTerms, String(doc?.metadata?.source || ''));
        // Prefer body relevance, but allow source/URL signal to lift borderline matches.
        const score = Math.min(1, Math.max(textScore, sourceScore * 0.9));
        return {
          doc,
          score,
          recency: docRecencyScore(doc),
        };
      })
      .sort((a, b) => (b.score - a.score) || (b.recency - a.recency));

    const minRequiredRelevance = sourceFollowUpQuery
      ? Math.max(MIN_DOC_RELEVANCE, SOURCE_FOLLOWUP_MIN_RELEVANCE)
      : MIN_DOC_RELEVANCE;

    const filteredDocs = rankedDocs
      .filter((entry) => entry.score >= minRequiredRelevance || queryTerms.length === 0)
      .slice(0, RAG_RETRIEVAL_K)
      .map((entry) => entry.doc);
    const fallbackDocs = rankedDocs.slice(0, RAG_RETRIEVAL_K).map((entry) => entry.doc);
    const topRelevanceScore = rankedDocs[0]?.score ?? 0;
    const hasRetrievedDocs = relevantDocs.length > 0;
    const docsForContext = filteredDocs.length >= 2
      ? filteredDocs
      : [...filteredDocs, ...fallbackDocs].slice(0, RAG_RETRIEVAL_K);
    const weakContext =
      !hasRetrievedDocs ||
      docsForContext.length === 0 ||
      (queryTerms.length > 0 && topRelevanceScore < WEAK_CONTEXT_THRESHOLD);

    const contextChunks: string[] = [];
    let currentContextChars = 0;
    for (let i = 0; i < docsForContext.length; i++) {
      const rawSource = docsForContext[i]?.metadata?.source || 'unknown';
      const source = resolveSourceUrl(rawSource) || 'unverified-local-source';
      // Strip all inline URLs from page content — prevents the model from copying
      // SharePoint nav links, login redirects, or any unverified URL from scraped text.
      const rawContent = (docsForContext[i]?.pageContent || '').slice(0, 2000);
      const strippedContent = rawContent.replace(/https?:\/\/[^\s)\]>",]+/gi, '[link removed]');
      const clipped = cleanText(strippedContent);
      // Only include the verified source URL in the label, not in the body
      const nextChunk = `[Source ${i + 1} | ${source}]:\n${clipped}`;
      if (currentContextChars + nextChunk.length > MAX_CONTEXT_CHARS) break;
      contextChunks.push(nextChunk);
      currentContextChars += nextChunk.length;
    }

    let contextText = contextChunks.join('\n\n');
    
    if (!contextText.trim()) {
      contextText = "No specific university documentation found for this query.";
    }

    if (weakContext && !sourceFollowUpQuery && !isRestricted) {
      const fallbackGuidance = fallbackGuidanceForQuery(lastUserMessage);
      contextText += `\n\n[General Guidance]:\n${fallbackGuidance}`;
    }

    const actionWorkflowQuery = isActionWorkflowQuery(lastUserMessage);
    const contactDetailQuery = isContactDetailQuery(lastUserMessage);
    const factualDetailQuery = isFactualDetailQuery(lastUserMessage);
    const verifiedLinks = collectVerifiedLinksFromRanked(rankedDocs, lastUserMessage, 6);
    const keywordFallbackLinks = collectKeywordFallbackLinks(lastUserMessage, 6);
    const responseLinks = verifiedLinks.length > 0 ? verifiedLinks : keywordFallbackLinks;

    const securityContactIntent = isSecurityContactIntent(lastUserMessage);
    if (securityContactIntent && !sourceFollowUpQuery) {
      const linkLines = responseLinks.slice(0, 3).map((url) => `- Link: ${url}`);
      const helpfulSection = linkLines.length > 0
        ? `\n\nHelpful links/forms:\n${linkLines.join('\n')}`
        : '';

      return singleMessageStreamResponse(
        `Not confirmed in docs for exact Security contact details (phone/email) for this query.\n\nNext steps:\n- Use the official university directory/portal search for “Security” or “Campus Safety”.\n- If you’re on campus and it’s urgent, go to the nearest staffed reception/security point.\n- If there is immediate danger, call emergency services.${helpfulSection}`
      );
    }

    if (linkOrFormRequestQuery && !sourceFollowUpQuery && responseLinks.length > 0) {
      const linkLines = responseLinks.map((url) => {
        const isFormLike = /(form|apply|application|portal|submit|request|booking|book)/i.test(url);
        return `- ${isFormLike ? 'Form' : 'Link'}: ${url}`;
      });

      const intro = `Here are verified portal links/forms related to your request: "${cleanText(lastUserMessage)}".`;
      const sourcesSection = sourceRequestedQuery
        ? `\n\nSources:\n${responseLinks.map((url) => `- ${url}`).join('\n')}`
        : '';

      return singleMessageStreamResponse(`${intro}\n\nHelpful links/forms:\n${linkLines.join('\n')}${sourcesSection}`);
    }

    const trustedSourceDocs = rankedDocs
      .filter((entry) => entry.score >= TRUSTED_SOURCE_MIN_RELEVANCE)
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

    // Removed hard block for factualDetailQuery so the LLM can process the semantic context.

    if (linkOrFormRequestQuery && weakContext) {
      const fallbackLinks = collectKeywordFallbackLinks(lastUserMessage, 4);
      if (fallbackLinks.length > 0) {
        const lines = fallbackLinks.map((url) => {
          const isFormLike = /(form|apply|application|portal|submit|request|booking|book)/i.test(url);
          return `- ${isFormLike ? 'Form' : 'Link'}: ${url}`;
        });
        return singleMessageStreamResponse(
          `Not fully confirmed in docs for a precise answer. Here are relevant verified links/forms from the latest scraped portal data:\n\nHelpful links/forms:\n${lines.join('\n')}`
        );
      }
    }

    const isUniQuery = isUniversityDomainQuery(lastUserMessage);

    let systemPrompt = '';
    if (isRestricted) {
      systemPrompt = `You are MyUni AI, a helpful virtual assistant for University of Roehampton students.

STRICT RULES (follow exactly):
1) ONLY use facts present in CONTEXT below for university-specific details.
2) NEVER invent, guess, or construct any URL, link, or web address. If a URL is not present word-for-word in the CONTEXT below, do NOT include it in your answer under any circumstances.
3) NEVER invent names, room numbers, phone numbers, email addresses, dates, deadlines, or policies not stated in CONTEXT.
4) If CONTEXT does not contain the exact answer, say it is not confirmed in docs, state what CONTEXT does say (if anything relevant), and give the best next step (who/where to check).
5) Keep answers concise and practical. Start with a direct answer.
6) Only add source citations when the user explicitly asks for sources.
7) Always include at least one actionable next step.
8) Do not ask follow-up questions unless the query is genuinely ambiguous.
9) For links/forms: ONLY include a URL if it appears verbatim in the CONTEXT block below. Copy it exactly as written.
10) ABSOLUTE RULE: Do not output any text matching "http" unless it was copied directly from CONTEXT.`;
    } else {
      systemPrompt = `You are MyUni AI, a helpful assistant.

MODE RULES (follow exactly):
1) If the user question is about University of Roehampton (student services, campus, policies, portals, support), ONLY use facts present in CONTEXT below.
2) If the question is general (not Roehampton/university-specific), answer from general knowledge.
3) NEVER invent, guess, or construct any URL, link, or web address. If a URL is not present word-for-word in the CONTEXT below, do NOT include it.
4) For university contact details (emails/phones), only provide them if they appear verbatim in CONTEXT; otherwise say "Not confirmed in docs" and give a next step.
5) If the question is university-specific and CONTEXT does not contain the exact answer, say "Not confirmed in docs" and give the best next step.
6) Keep answers concise and practical. Start with a direct answer.
7) Only add source citations when the user explicitly asks for sources.
8) Always include at least one actionable next step for university-specific questions.
9) ABSOLUTE RULE: Do not output any text matching "http" unless it was copied directly from CONTEXT.`;
    }

    systemPrompt += `\n\nCONTEXT:\n${contextText}`;

    if (actionWorkflowQuery) {
      systemPrompt += `\n\n[ACTION WORKFLOW FORMAT]\nFor this query type, answer in this order:\n- Line 1: direct answer in one sentence.\n- Then: 2-5 concrete steps the student can take immediately.\n- If exact portal/page is not in CONTEXT, provide the best official channels and escalation path.\n- End with one short practical tip.`;
    }

    if (isRestricted) {
      systemPrompt += `\n\n[STRICT MODE]
    You must only answer university, campus, or student-life questions.
    If the question is unrelated, refuse briefly and redirect to university topics.`;

      if (weakContext) {
        systemPrompt += `\n\n[LOW CONTEXT CONFIDENCE]
The retrieved evidence is weak for this query.
    Do NOT add new university-specific facts.
    Say "Not confirmed in docs" and suggest concrete next steps to verify (Student Services, department office, or the official portal).`;
      }
    } else {
      systemPrompt += `\n\n[UNRESTRICTED MODE]\nYou may answer general questions.`;

      if (isUniQuery && weakContext) {
        systemPrompt += `\n\n[LOW CONTEXT CONFIDENCE]\nFor university-specific details: say "Not confirmed in docs" and suggest concrete next steps to verify (Student Services, department office, or the official portal).`;
      }
    }

    if (contactDetailQuery) {
      systemPrompt += `\n\n[CONTACT DETAIL SAFETY]\nFor email addresses, phone numbers, and contact details:\n- Only provide a specific detail if it appears verbatim in CONTEXT.\n- If not present verbatim, direct the student to Student Services or the official university website.\n- Do not infer contact details from weak or loosely related context.`;
    }

    if (sourceFollowUpQuery) {
      systemPrompt += `\n\n[SOURCE FOLLOW-UP SAFETY]\nThe user is asking for the source of a previous answer.\n- If CONTEXT is weak or no reliable source appears, say you cannot confirm the source.\n- Do not output or guess file paths, document names, or source tags unless they are strongly relevant in CONTEXT.`;
    }

    if (!sourceRequestedQuery) {
      systemPrompt += `\n\n[CITATION DISPLAY] Do not include any URLs, source tags, or a Sources section unless the user explicitly asks for sources or citations. For helpful links, only include them under "Helpful links/forms:" if they appear verbatim in the CONTEXT above.`;
    }

    // 3. Call Ollama chat API directly (v2 spec) and stream response
    const ollamaChatUrl = `${OLLAMA_BASE_URL.replace(/\/$/, '')}/api/chat`;
    console.log(`[MyUni AI] Sending request to Ollama: ${ollamaChatUrl} with model ${modelName}`);
    
    // Sanitize messages to only include role and content
    const recentMessages = messages.slice(-MAX_RECENT_MESSAGES);
    const sanitizedMessages = [
      { role: 'system', content: systemPrompt },
      ...recentMessages.map((m: any) => ({ role: m.role, content: m.content }))
    ];

    const shouldAppendSources = sourceRequestedQuery || sourceFollowUpQuery;
    const sourcesAppendix = shouldAppendSources
      ? buildSourcesAppendixFromRanked(rankedDocs, factualDetailQuery)
      : '';
    const relatedLinksAppendix = !sourceRequestedQuery && !sourceFollowUpQuery && !isSimpleQuestion(lastUserMessage) && linkOrFormRequestQuery
      ? buildRelatedLinksFormsAppendixFromRanked(rankedDocs)
      : '';
    const appendedTail = `${relatedLinksAppendix}${sourcesAppendix}`;
    const safeTail = sanitizeUrlsInText(appendedTail);
    const sourceLine = `${JSON.stringify({ message: { role: 'assistant', content: safeTail }, done: false })}\n`;

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    // RETURN STREAM IMMEDIATELY to prevent Next.js / Browser timeouts
    const mergedStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let ollamaResponse: Response;
        const fetchStart = Date.now();

        // Send a dummy space immediately to flush headers and keep connection alive
        controller.enqueue(encoder.encode(JSON.stringify({ message: { role: 'assistant', content: '' }, done: false }) + '\n'));

        try {
          ollamaResponse = await fetch(ollamaChatUrl, {
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
          
          if (!ollamaResponse.ok) {
            const errorText = await ollamaResponse.text();
            console.error(`[MyUni AI] Ollama Error (${ollamaResponse.status}):`, errorText);
            throw new Error(`Ollama API error: ${ollamaResponse.statusText}`);
          }
          
          if (!ollamaResponse.body) {
            controller.close();
            return;
          }
          
          const reader = ollamaResponse.body.getReader();
          let buffer = '';
          let sourceInjected = false;

          const emitLine = (line: string) => {
            controller.enqueue(encoder.encode(`${line}\n`));
          };

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

              if (parsed?.message?.content) {
                parsed.message.content = sanitizeUrlsInText(String(parsed.message.content));
              }

              if (!sourceInjected && parsed?.done === true && safeTail) {
                controller.enqueue(encoder.encode(sourceLine));
                sourceInjected = true;
              }

              emitLine(JSON.stringify(parsed));
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
              if (parsed?.message?.content) {
                parsed.message.content = sanitizeUrlsInText(String(parsed.message.content));
              }

              if (!sourceInjected && parsed?.done === true && safeTail) {
                controller.enqueue(encoder.encode(sourceLine));
                sourceInjected = true;
              }
              emitLine(JSON.stringify(parsed));
            }
          }
        } catch (err: any) {
          console.error("Ollama streaming error:", err);
          controller.enqueue(encoder.encode(JSON.stringify({ 
            message: { role: 'assistant', content: '\n[System]: Failed to connect to local AI model. It may be loading or restarting.' }, 
            done: true 
          }) + '\n'));
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
      'I had trouble completing that request. Please try again. If the problem persists, try selecting a lighter model like gemma3:latest from the dropdown.'
    );
  }
}
