import { Document } from "@langchain/core/documents";
import { OllamaEmbeddings } from "@langchain/ollama";
import { HybridRAG } from "../lib/rag";
import * as fs from "fs";
import * as path from "path";
import mammoth from "mammoth";
const { PDFParse } = require("pdf-parse");
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

// We read the chat model name from .env
const MODEL_NAME = process.env.OLLAMA_MODEL || "llama3";
// We hardcode the best embedding model or read from env
const EMBEDDING_MODEL = process.env.OLLAMA_EMBEDDING_MODEL || "nomic-embed-text";
const fypDir = path.resolve(process.cwd(), "..");
const sourceDocsDir = path.join(fypDir, "pdf files", "scraped");

async function parseDocument(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  
  if (ext === ".txt" || ext === ".md") {
    return fs.readFileSync(filePath, "utf-8");
  } else if (ext === ".pdf") {
    const buffer = fs.readFileSync(filePath);
    const parser = new PDFParse({ data: buffer });
    try {
      const parsed = await parser.getText();
      return parsed.text || "";
    } finally {
      await parser.destroy();
    }
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
  
  const docs: Document[] = [];
  
  for (const filePath of files) {
    const relName = path.relative(sourceDocsDir, filePath);
    try {
      console.log(`Parsing ${relName}...`);
      const text = await parseDocument(filePath);
      if (text.trim()) {
        docs.push(new Document({
          pageContent: text,
          metadata: { source: path.relative(fypDir, filePath).replace(/\\/g, "/") },
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
