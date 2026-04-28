import { Document } from "@langchain/core/documents";
import { OllamaEmbeddings } from "@langchain/ollama";
import { HybridRAG } from "../lib/rag";
import { extractPdfTextRobust } from "../lib/domains/rag/pdfExtract";
import * as fs from "fs";
import * as path from "path";
import mammoth from "mammoth";
import dotenv from "dotenv";
  import { createHash } from "crypto";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

// We read the chat model name from .env
const MODEL_NAME = process.env.OLLAMA_MODEL || "llama3";
// We hardcode the best embedding model or read from env
const EMBEDDING_MODEL = process.env.OLLAMA_EMBEDDING_MODEL || "nomic-embed-text";
const fypDir = path.resolve(process.cwd(), "..");
const scrapedDocsDirSetting = (process.env.SCRAPED_DOCS_DIR || "scraped").trim();
const sourceDocsDir = path.isAbsolute(scrapedDocsDirSetting)
  ? scrapedDocsDirSetting
  : path.join(fypDir, "pdf files", scrapedDocsDirSetting);
const pdfSourceMapPath = path.join(sourceDocsDir, "pdfs", "_source_map.json");
const docSourceMapPath = path.join(sourceDocsDir, "docs", "_source_map.json");
const pageSourceMapPath = path.join(sourceDocsDir, "_page_source_map.json");

function normalizeNameForMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/_\d+$/i, "")
    .replace(/[_\-]+/g, " ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripDuplicateSuffixFromPath(filePathValue: string): string {
  return filePathValue.replace(/_(\d+)(\.[a-z0-9]+)$/i, "$2");
}

function shouldExcludeByRules(params: { relPath: string; source: string; text: string }) {
  const rel = (params.relPath || "").toLowerCase().replace(/\\/g, "/");
  const src = (params.source || "").toLowerCase();
  const head = (params.text || "").slice(0, 5000).toLowerCase();

  const examRegexes: RegExp[] = [
    /\bexam\s*sample(s)?\b/i,
    /\bpast\s*exam(s)?\b/i,
    /\bsample\s*exam(s)?\b/i,
  ];

  const newsEventsRegexes: RegExp[] = [
    // Prefer URL/path signals to avoid excluding unrelated prose.
    /(^|[\/\-_\s])news($|[\/\-_\s])/i,
    /(^|[\/\-_\s])event(s)?($|[\/\-_\s])/i,
    /news\s*(and|&)\s*events/i,
  ];

  const haystacks = [rel, src, head];
  for (const rx of examRegexes) {
    if (haystacks.some((h) => rx.test(h))) return { exclude: true, reason: "exam" as const };
  }
  // For news/events, require at least one strong signal from URL/path OR header-like text.
  const strongHaystacks = [rel, src, head.slice(0, 300)];
  for (const rx of newsEventsRegexes) {
    if (strongHaystacks.some((h) => rx.test(h))) return { exclude: true, reason: "news_events" as const };
  }

  return { exclude: false as const, reason: null as null };
}

function extractSourceUrlFromContent(text: string): string | null {
  const patterns = [
    /^SOURCE_URL:\s*(https?:\/\/\S+)/im,
    /^>\s*\*\*Source:\*\*\s*(https?:\/\/\S+)/im,
    /\*\*Original Webpage Link:\*\*\s*(https?:\/\/\S+)/im
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) return match[1].trim();
  }
  return null;
}

function loadPdfSourceMap(): Record<string, string> {
  if (!fs.existsSync(pdfSourceMapPath)) return {};
  try {
    const raw = fs.readFileSync(pdfSourceMapPath, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function loadPageSourceMap(): Record<string, string> {
  if (!fs.existsSync(pageSourceMapPath)) return {};
  try {
    const raw = fs.readFileSync(pageSourceMapPath, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function loadDocSourceMap(): Record<string, string> {
  if (!fs.existsSync(docSourceMapPath)) return {};
  try {
    const raw = fs.readFileSync(docSourceMapPath, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function buildNormalizedDocMapIndex(docSourceMap: Record<string, string>): Record<string, string> {
  const index: Record<string, string> = {};

  for (const [key, url] of Object.entries(docSourceMap)) {
    if (!url) continue;

    const keyNorm = normalizeNameForMatch(path.basename(key));
    if (keyNorm && !index[keyNorm]) {
      index[keyNorm] = url;
    }

    const keyWithoutDup = stripDuplicateSuffixFromPath(path.basename(key));
    const keyWithoutDupNorm = normalizeNameForMatch(keyWithoutDup);
    if (keyWithoutDupNorm && !index[keyWithoutDupNorm]) {
      index[keyWithoutDupNorm] = url;
    }
  }

  return index;
}

function resolveDocSourceFromMap(
  filePath: string,
  docSourceMap: Record<string, string>,
  normalizedDocMapIndex: Record<string, string>
): string | null {
  const relFromRoot = path.relative(sourceDocsDir, filePath).replace(/\\/g, "/");
  if (docSourceMap[relFromRoot]) return docSourceMap[relFromRoot];

  const relFromDocs = path.relative(path.join(sourceDocsDir, "docs"), filePath).replace(/\\/g, "/");
  const withPrefix = `docs/${relFromDocs}`;
  if (docSourceMap[withPrefix]) return docSourceMap[withPrefix];

  const strippedBaseName = stripDuplicateSuffixFromPath(path.basename(filePath));
  const stemKey = normalizeNameForMatch(strippedBaseName);
  if (stemKey && normalizedDocMapIndex[stemKey]) return normalizedDocMapIndex[stemKey];

  return null;
}

function buildNormalizedPdfMapIndex(pdfSourceMap: Record<string, string>): Record<string, string> {
  const index: Record<string, string> = {};

  for (const [key, url] of Object.entries(pdfSourceMap)) {
    if (!url) continue;

    const keyNorm = normalizeNameForMatch(path.basename(key));
    if (keyNorm && !index[keyNorm]) {
      index[keyNorm] = url;
    }

    const keyWithoutDup = stripDuplicateSuffixFromPath(path.basename(key));
    const keyWithoutDupNorm = normalizeNameForMatch(keyWithoutDup);
    if (keyWithoutDupNorm && !index[keyWithoutDupNorm]) {
      index[keyWithoutDupNorm] = url;
    }
  }

  return index;
}

function buildMarkdownSourceIndex(rootDir: string): Record<string, string> {
  const index: Record<string, string> = {};
  const stack: string[] = [rootDir];

  while (stack.length > 0) {
    const current = stack.pop() as string;
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      if (!/\.md$/i.test(entry.name)) continue;

      try {
        const text = fs.readFileSync(fullPath, "utf-8");
        const sourceUrl = extractSourceUrlFromContent(text);
        if (!sourceUrl) continue;

        const stemKey = normalizeNameForMatch(path.basename(fullPath));
        if (stemKey && !index[stemKey]) {
          index[stemKey] = sourceUrl;
        }
      } catch {
        // Ignore malformed markdown files during indexing.
      }
    }
  }

  return index;
}

function resolveMarkdownSourceFromMap(filePath: string, pageSourceMap: Record<string, string>): string | null {
  const relFromRoot = path.relative(sourceDocsDir, filePath).replace(/\\/g, "/");
  if (pageSourceMap[relFromRoot]) return pageSourceMap[relFromRoot];

  const stemKey = normalizeNameForMatch(path.basename(filePath));
  if (stemKey) {
    for (const [key, url] of Object.entries(pageSourceMap)) {
      if (normalizeNameForMatch(path.basename(key)) === stemKey) {
        return url;
      }
    }
  }

  return null;
}

function resolvePdfSourceFromMap(
  filePath: string,
  pdfSourceMap: Record<string, string>,
  normalizedPdfMapIndex: Record<string, string>,
  markdownSourceIndex: Record<string, string>
): string | null {
  const relFromRoot = path.relative(sourceDocsDir, filePath).replace(/\\/g, "/");
  if (pdfSourceMap[relFromRoot]) return pdfSourceMap[relFromRoot];

  const relFromPdfs = path.relative(path.join(sourceDocsDir, "pdfs"), filePath).replace(/\\/g, "/");
  const withPrefix = `pdfs/${relFromPdfs}`;
  if (pdfSourceMap[withPrefix]) return pdfSourceMap[withPrefix];

  const strippedBaseName = stripDuplicateSuffixFromPath(path.basename(filePath));
  const stemKey = normalizeNameForMatch(strippedBaseName);
  if (stemKey && normalizedPdfMapIndex[stemKey]) return normalizedPdfMapIndex[stemKey];
  if (stemKey && markdownSourceIndex[stemKey]) return markdownSourceIndex[stemKey];

  return null;
}

async function parseDocument(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  
  if (ext === ".txt" || ext === ".md") {
    return fs.readFileSync(filePath, "utf-8");
  } else if (ext === ".pdf") {
    const buffer = fs.readFileSync(filePath);
    return extractPdfTextRobust(buffer, filePath);
  } else if (ext === ".docx") {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }
  return "";
}

function collectDocumentPaths(rootDir: string): string[] {
  const collected: string[] = [];
  const stack: string[] = [rootDir];

  while (stack.length > 0) {
    const current = stack.pop() as string;
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      if (/\.(pdf|txt|docx|md)$/i.test(entry.name)) {
        collected.push(fullPath);
      }
    }
  }

  return collected;
}

async function run() {
  console.log("Using chat model:", MODEL_NAME);
  console.log("Using embedding model:", EMBEDDING_MODEL);
  console.log("Using SCRAPED_DOCS_DIR:", scrapedDocsDirSetting);
  console.log("Looking for documents in:", sourceDocsDir);

  if (!fs.existsSync(sourceDocsDir)) {
    console.error("Source documents folder not found:", sourceDocsDir);
    process.exit(1);
  }

  const files = collectDocumentPaths(sourceDocsDir);
  const pdfSourceMap = loadPdfSourceMap();
  const docSourceMap = loadDocSourceMap();
  const pageSourceMap = loadPageSourceMap();
  const normalizedPdfMapIndex = buildNormalizedPdfMapIndex(pdfSourceMap);
  const normalizedDocMapIndex = buildNormalizedDocMapIndex(docSourceMap);
  const markdownSourceIndex = buildMarkdownSourceIndex(sourceDocsDir);
  
  const docs: Document[] = [];
  const seenSourceContent = new Set<string>();
  const seenContentHash = new Set<string>();

  let skippedExam = 0;
  let skippedNewsEvents = 0;
  let skippedEmpty = 0;
  let skippedDuplicates = 0;
  
  for (const filePath of files) {
    const relName = path.relative(sourceDocsDir, filePath);
    try {
      console.log(`Parsing ${relName}...`);
      const text = await parseDocument(filePath);
      if (text.trim()) {
        const ext = path.extname(filePath).toLowerCase();
        const markdownUrl = ext === ".md"
          ? resolveMarkdownSourceFromMap(filePath, pageSourceMap) || extractSourceUrlFromContent(text)
          : extractSourceUrlFromContent(text);
        const pdfUrl = ext === ".pdf"
          ? resolvePdfSourceFromMap(filePath, pdfSourceMap, normalizedPdfMapIndex, markdownSourceIndex)
          : null;
        const docUrl = ext === ".docx"
          ? resolveDocSourceFromMap(filePath, docSourceMap, normalizedDocMapIndex)
          : null;
        const source = markdownUrl || pdfUrl || path.relative(fypDir, filePath).replace(/\\/g, "/");
        const resolvedSource = markdownUrl || pdfUrl || docUrl || path.relative(fypDir, filePath).replace(/\\/g, "/");

        const exclusion = shouldExcludeByRules({ relPath: relName, source: resolvedSource, text });
        if (exclusion.exclude) {
          if (exclusion.reason === "exam") skippedExam += 1;
          if (exclusion.reason === "news_events") skippedNewsEvents += 1;
          console.log(`  [SKIP] Excluded (${exclusion.reason}): ${relName}`);
          continue;
        }

        // Skip duplicate scrape artifacts that point to the same source/content.
        const textHash = createHash("sha256").update(text).digest("hex");
        const sourceContentKey = `${resolvedSource}::${textHash}`;
        if (seenSourceContent.has(sourceContentKey)) {
          skippedDuplicates += 1;
          continue;
        }
        seenSourceContent.add(sourceContentKey);

        // Also suppress exact content duplicates across different filenames.
        if (seenContentHash.has(textHash)) {
          skippedDuplicates += 1;
          continue;
        }
        seenContentHash.add(textHash);

        docs.push(new Document({
          pageContent: text,
          metadata: { source: resolvedSource },
        }));
      }
      else {
        skippedEmpty += 1;
      }
    } catch (e) {
      console.warn(`⚠️  Skipping ${relName} (parse error):`, (e as Error).message);
    }
  }

  console.log(
    `Exclusions: exam=${skippedExam} news/events=${skippedNewsEvents} empty=${skippedEmpty} duplicates=${skippedDuplicates}`
  );

  console.log(`Successfully parsed ${docs.length} base documents. Preparing parent-child chunks...`);

  const embeddings = new OllamaEmbeddings({
    model: EMBEDDING_MODEL, 
    baseUrl: "http://127.0.0.1:11434"
  });

  const rag = new HybridRAG(embeddings);
  
  try {
    const stats = await rag.ingestDocuments(docs);
    console.log(
      `Ingest summary: parent chunks=${stats.parentChunks}, child chunks=${stats.childChunks}, embedded child chunks=${stats.embeddedChildChunks}`
    );
    console.log("Ingestion Complete! You can now ask questions about all your documents.");
  } catch (e) {
    console.error("Ingestion failed. Ensure Ollama is running and the model works for embeddings:", e);
  }
}

run();
