import { NextRequest, NextResponse } from "next/server";
import { getRAGStore } from "@/lib/domains/rag";
import { extractPdfTextRobust } from "@/lib/domains/rag/pdfExtract";
import { Document } from "@langchain/core/documents";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import mammoth from "mammoth";

function isValidHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function extractTextFromHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchLinkText(url: string): Promise<string> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent": "MyUni-RAG-Trainer/1.0",
      Accept: "text/html,text/plain;q=0.9,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch link (${response.status})`);
  }

  const contentType = response.headers.get("content-type") || "";
  const rawText = await response.text();

  if (contentType.includes("text/plain")) {
    return rawText.trim();
  }

  return extractTextFromHtml(rawText);
}

async function parseDocument(filePath: string, ext: string): Promise<string> {
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

export const maxDuration = 300; // Allow 300s for a full local ingest

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];
    const linksRaw = formData.get("links");
    const isIncremental = formData.get("isIncremental") === "true";

    let parsedLinks: unknown = [];
    if (typeof linksRaw === "string") {
      try {
        parsedLinks = JSON.parse(linksRaw);
      } catch {
        return NextResponse.json({ error: "Invalid links payload" }, { status: 400 });
      }
    }
    const links = Array.isArray(parsedLinks)
      ? parsedLinks.map((value) => String(value).trim()).filter(Boolean)
      : [];

    if ((!files || files.length === 0) && links.length === 0) {
      return NextResponse.json({ error: "No files or links provided" }, { status: 400 });
    }

    const rag = await getRAGStore();
    const docs: Document[] = [];

    // Process each uploaded file
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const ext = path.extname(file.name).toLowerCase();
      // Write buffer to a temp file for parsing
      const tempPath = path.join(os.tmpdir(), `upload_${Date.now()}_${file.name.replace(/\s+/g, '_')}`);
      fs.writeFileSync(tempPath, buffer);

      try {
        const text = await parseDocument(tempPath, ext);
        if (text.trim()) {
          docs.push(new Document({
            pageContent: text,
            metadata: { source: file.name },
          }));
        }
      } catch (err) {
        console.error(`Error parsing ${file.name}:`, err);
      } finally {
        // Cleanup temp file
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      }
    }

    let validLinkCount = 0;

    // Process each provided link as a text source
    for (const rawLink of links) {
      if (!isValidHttpUrl(rawLink)) {
        console.warn(`Skipping invalid training link: ${rawLink}`);
        continue;
      }

      try {
        const text = await fetchLinkText(rawLink);
        if (text.trim()) {
          docs.push(new Document({
            pageContent: text,
            metadata: { source: rawLink, sourceType: "link" },
          }));
          validLinkCount += 1;
        }
      } catch (err) {
        console.error(`Error fetching link ${rawLink}:`, err);
      }
    }

    if (docs.length === 0) {
      return NextResponse.json({ error: "No text could be extracted from the provided files or links" }, { status: 400 });
    }

    const ingestStats = await rag.ingestDocuments(docs, { append: isIncremental });

    if (ingestStats.embeddedChildChunks === 0) {
      return NextResponse.json({
        success: true,
        message: "No new unique content found. Existing RAG index already contains this information.",
        trainingStandard: "parent-child-hybrid-rag-v3",
        stats: {
          parentChunks: ingestStats.parentChunks,
          childChunks: ingestStats.childChunks,
          embeddedChildChunks: ingestStats.embeddedChildChunks,
          filesCount: files.length,
          linksCount: validLinkCount,
        },
        isIncremental,
      });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Successfully embedded ${ingestStats.embeddedChildChunks} child chunks from ${ingestStats.parentChunks} parent chunks using ${files.length} files and ${validLinkCount} links.`,
      trainingStandard: "parent-child-hybrid-rag-v3",
      stats: {
        parentChunks: ingestStats.parentChunks,
        childChunks: ingestStats.childChunks,
        embeddedChildChunks: ingestStats.embeddedChildChunks,
        filesCount: files.length,
        linksCount: validLinkCount,
      },
      isIncremental 
    });

  } catch (error: any) {
    console.error("Admin Train API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
