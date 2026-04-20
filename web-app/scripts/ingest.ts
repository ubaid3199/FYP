import { Document } from "@langchain/core/documents";
import { OllamaEmbeddings } from "@langchain/ollama";
import { HybridRAG } from "../lib/rag";
import { extractPdfTextRobust } from "../lib/domains/rag/pdfExtract";
import * as fs from "fs";
import * as path from "path";
import mammoth from "mammoth";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

// We read the chat model name from .env
const MODEL_NAME = process.env.OLLAMA_MODEL || "llama3";
// We hardcode the best embedding model or read from env
const EMBEDDING_MODEL = process.env.OLLAMA_EMBEDDING_MODEL || "nomic-embed-text";
const fypDir = path.resolve(process.cwd(), "..");
const sourceDocsDir = path.join(fypDir, "pdf files", "scraped");
const pdfSourceMapPath = path.join(sourceDocsDir, "pdfs", "_source_map.json");

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

function extractSourceUrlFromContent(text: string): string | null {
  const sourceLine = text.match(/^>\s*\*\*Source:\*\*\s*(https?:\/\/\S+)/im);
  if (!sourceLine || !sourceLine[1]) return null;
  return sourceLine[1].trim();
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
  console.log("Looking for documents in:", sourceDocsDir);

  if (!fs.existsSync(sourceDocsDir)) {
    console.error("Source documents folder not found:", sourceDocsDir);
    process.exit(1);
  }

  const files = collectDocumentPaths(sourceDocsDir);
  const pdfSourceMap = loadPdfSourceMap();
  const normalizedPdfMapIndex = buildNormalizedPdfMapIndex(pdfSourceMap);
  const markdownSourceIndex = buildMarkdownSourceIndex(sourceDocsDir);
  
  const docs: Document[] = [];
  
  for (const filePath of files) {
    const relName = path.relative(sourceDocsDir, filePath);
    try {
      console.log(`Parsing ${relName}...`);
      const text = await parseDocument(filePath);
      if (text.trim()) {
        const ext = path.extname(filePath).toLowerCase();
        const markdownUrl = extractSourceUrlFromContent(text);
        const pdfUrl = ext === ".pdf"
          ? resolvePdfSourceFromMap(filePath, pdfSourceMap, normalizedPdfMapIndex, markdownSourceIndex)
          : null;
        const source = markdownUrl || pdfUrl || path.relative(fypDir, filePath).replace(/\\/g, "/");

        docs.push(new Document({
          pageContent: text,
          metadata: { source },
        }));
      }
    } catch (e) {
      console.warn(`⚠️  Skipping ${relName} (parse error):`, (e as Error).message);
    }
  }

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
