const { PDFParse } = require("pdf-parse");
const PDFParser = require("pdf2json");

export interface PdfExtractionDiagnostics {
  text: string;
  parserUsed: "pdf-parse" | "pdf2json" | "pdf-parse-poor" | "pdf2json-poor" | "none";
  primaryPoor: boolean;
  fallbackPoor: boolean;
  primaryLength: number;
  fallbackLength: number;
}

function normalizeText(value: string): string {
  return value
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/\u0000/g, "")
    .replace(/[ \f\v]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function hasPoorQuality(text: string, sourceBytes: number): boolean {
  const clean = normalizeText(text);
  if (!clean) return true;

  if (clean.length < 120 && sourceBytes > 15_000) return true;

  const replacementCount = (clean.match(/�/g) || []).length;
  if (replacementCount / Math.max(clean.length, 1) > 0.02) return true;

  const alphaCount = (clean.match(/[A-Za-z]/g) || []).length;
  if (clean.length > 200 && alphaCount / clean.length < 0.12) return true;

  return false;
}

async function parseWithPdfParse(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const parsed = await parser.getText();
    return normalizeText(parsed?.text || "");
  } finally {
    await parser.destroy();
  }
}

async function parseWithPdf2Json(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const parser = new PDFParser();

    parser.on("pdfParser_dataError", (err: any) => {
      reject(new Error(err?.parserError || "pdf2json parse error"));
    });

    parser.on("pdfParser_dataReady", (pdfData: any) => {
      try {
        const pages = Array.isArray(pdfData?.Pages) ? pdfData.Pages : [];
        const pageTexts: string[] = [];

        for (const page of pages) {
          const textItems = Array.isArray(page?.Texts) ? page.Texts : [];
          const parts: string[] = [];
          for (const item of textItems) {
            const runs = Array.isArray(item?.R) ? item.R : [];
            for (const run of runs) {
              const encoded = String(run?.T || "");
              if (!encoded) continue;
              try {
                parts.push(decodeURIComponent(encoded));
              } catch {
                parts.push(encoded);
              }
            }
          }
          if (parts.length) pageTexts.push(parts.join(" "));
        }

        resolve(normalizeText(pageTexts.join("\n\n")));
      } catch (error: any) {
        reject(new Error(error?.message || "Failed to transform pdf2json output"));
      }
    });

    parser.parseBuffer(buffer);
  });
}

export async function extractPdfTextRobust(buffer: Buffer, sourceLabel: string): Promise<string> {
  const diagnostics = await extractPdfTextWithDiagnostics(buffer, sourceLabel);
  return diagnostics.text;
}

export async function extractPdfTextWithDiagnostics(
  buffer: Buffer,
  sourceLabel: string
): Promise<PdfExtractionDiagnostics> {
  let primary = "";
  let primaryPoor = true;

  try {
    primary = await parseWithPdfParse(buffer);
    primaryPoor = hasPoorQuality(primary, buffer.length);
    if (!primaryPoor) {
      return {
        text: primary,
        parserUsed: "pdf-parse",
        primaryPoor,
        fallbackPoor: true,
        primaryLength: primary.length,
        fallbackLength: 0,
      };
    }
  } catch (error: any) {
    console.warn(`[RAG][PDF] Primary parser failed for ${sourceLabel}: ${error?.message || error}`);
  }

  let fallback = "";
  let fallbackPoor = true;

  try {
    fallback = await parseWithPdf2Json(buffer);
    fallbackPoor = hasPoorQuality(fallback, buffer.length);

    if (!fallbackPoor) {
      console.warn(`[RAG][PDF] Used fallback parser for ${sourceLabel}`);
      return {
        text: fallback,
        parserUsed: "pdf2json",
        primaryPoor,
        fallbackPoor,
        primaryLength: primary.length,
        fallbackLength: fallback.length,
      };
    }

    return {
      text: fallback || primary,
      parserUsed: fallback ? "pdf2json-poor" : "pdf-parse-poor",
      primaryPoor,
      fallbackPoor,
      primaryLength: primary.length,
      fallbackLength: fallback.length,
    };
  } catch (error: any) {
    console.warn(`[RAG][PDF] Fallback parser failed for ${sourceLabel}: ${error?.message || error}`);
    return {
      text: primary,
      parserUsed: primary ? "pdf-parse-poor" : "none",
      primaryPoor,
      fallbackPoor,
      primaryLength: primary.length,
      fallbackLength: 0,
    };
  }
}
