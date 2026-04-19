import * as fs from "fs";
import * as path from "path";
import {
  extractPdfTextWithDiagnostics,
  hasPoorQuality,
  PdfExtractionDiagnostics,
} from "../lib/domains/rag/pdfExtract";

type FindingSeverity = "warning" | "error";

interface Finding {
  file: string;
  severity: FindingSeverity;
  reason: string;
  bytes: number;
  chars: number;
  parserUsed: PdfExtractionDiagnostics["parserUsed"];
  primaryLength: number;
  fallbackLength: number;
}

interface CliOptions {
  dir: string;
  out: string;
  limit: number;
  dirExplicit: boolean;
}

function parseArgs(): CliOptions {
  const fypDir = path.resolve(process.cwd(), "..");
  const defaults: CliOptions = {
    dir: path.join(fypDir, "pdf files", "scraped"),
    out: path.join(fypDir, "pdf_quality_report.json"),
    limit: 25,
    dirExplicit: false,
  };

  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const token = args[i];
    if (token === "--dir" && args[i + 1]) {
      defaults.dir = path.resolve(process.cwd(), args[i + 1]);
      defaults.dirExplicit = true;
      i += 1;
    } else if (token === "--out" && args[i + 1]) {
      defaults.out = path.resolve(process.cwd(), args[i + 1]);
      i += 1;
    } else if (token === "--limit" && args[i + 1]) {
      const parsed = Number(args[i + 1]);
      if (Number.isFinite(parsed) && parsed > 0) {
        defaults.limit = Math.floor(parsed);
      }
      i += 1;
    }
  }

  return defaults;
}

function collectPdfFiles(rootDir: string): string[] {
  const stack = [rootDir];
  const results: string[] = [];

  while (stack.length > 0) {
    const current = stack.pop() as string;
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      if (entry.isFile() && path.extname(entry.name).toLowerCase() === ".pdf") {
        results.push(fullPath);
      }
    }
  }

  return results.sort((a, b) => a.localeCompare(b));
}

function findReason(diagnostics: PdfExtractionDiagnostics, chars: number, bytes: number): string {
  if (chars === 0) return "No extractable text";
  if (diagnostics.parserUsed === "none") return "Both parsers failed";
  if (diagnostics.parserUsed === "pdf-parse-poor") return "Primary parser output poor quality";
  if (diagnostics.parserUsed === "pdf2json-poor") return "Fallback parser output poor quality";
  if (chars < 120 && bytes > 15_000) return "Very short output for large PDF";
  return "Low confidence extraction";
}

function scoreFinding(f: Finding): number {
  if (f.severity === "error") return 10_000 + f.bytes;
  return f.bytes;
}

async function run() {
  const options = parseArgs();

  if (!fs.existsSync(options.dir)) {
    console.error(`Source directory not found: ${options.dir}`);
    process.exit(1);
  }

  let files = collectPdfFiles(options.dir);

  if (files.length === 0 && !options.dirExplicit) {
    const fallbackDir = path.join(path.resolve(process.cwd(), ".."), "pdf files");
    if (fallbackDir !== options.dir && fs.existsSync(fallbackDir)) {
      const fallbackFiles = collectPdfFiles(fallbackDir);
      if (fallbackFiles.length > 0) {
        console.log(`No PDFs found in default scraped folder. Falling back to: ${fallbackDir}`);
        options.dir = fallbackDir;
        files = fallbackFiles;
      }
    }
  }

  if (files.length === 0) {
    console.log(`No PDF files found in: ${options.dir}`);
    process.exit(0);
  }

  console.log(`Scanning ${files.length} PDF files from: ${options.dir}`);

  const findings: Finding[] = [];
  let successCount = 0;

  for (let i = 0; i < files.length; i++) {
    const filePath = files[i];
    const relPath = path.relative(options.dir, filePath).replace(/\\/g, "/");

    let buffer: Buffer;
    try {
      buffer = fs.readFileSync(filePath);
    } catch (error: any) {
      findings.push({
        file: relPath,
        severity: "error",
        reason: `Read failure: ${error?.message || error}`,
        bytes: 0,
        chars: 0,
        parserUsed: "none",
        primaryLength: 0,
        fallbackLength: 0,
      });
      continue;
    }

    try {
      const diagnostics = await extractPdfTextWithDiagnostics(buffer, relPath);
      const chars = diagnostics.text.trim().length;
      const poor = hasPoorQuality(diagnostics.text, buffer.length);
      const severe = chars === 0 || diagnostics.parserUsed === "none";

      if (poor || severe) {
        findings.push({
          file: relPath,
          severity: severe ? "error" : "warning",
          reason: findReason(diagnostics, chars, buffer.length),
          bytes: buffer.length,
          chars,
          parserUsed: diagnostics.parserUsed,
          primaryLength: diagnostics.primaryLength,
          fallbackLength: diagnostics.fallbackLength,
        });
      } else {
        successCount += 1;
      }
    } catch (error: any) {
      findings.push({
        file: relPath,
        severity: "error",
        reason: `Parse crash: ${error?.message || error}`,
        bytes: buffer.length,
        chars: 0,
        parserUsed: "none",
        primaryLength: 0,
        fallbackLength: 0,
      });
    }

    if ((i + 1) % 25 === 0 || i + 1 === files.length) {
      console.log(`Progress: ${i + 1}/${files.length}`);
    }
  }

  findings.sort((a, b) => scoreFinding(b) - scoreFinding(a));

  const report = {
    generatedAt: new Date().toISOString(),
    scannedDir: options.dir,
    scannedPdfCount: files.length,
    goodCount: successCount,
    issueCount: findings.length,
    issues: findings,
    findings,
  };

  fs.writeFileSync(options.out, JSON.stringify(report, null, 2), "utf-8");

  const errorCount = findings.filter((f) => f.severity === "error").length;
  const warningCount = findings.length - errorCount;

  console.log("\nSummary:");
  console.log(`- Good extractions: ${successCount}`);
  console.log(`- Warnings: ${warningCount}`);
  console.log(`- Errors: ${errorCount}`);
  console.log(`- JSON report: ${options.out}`);

  if (findings.length > 0) {
    console.log(`\nTop ${Math.min(options.limit, findings.length)} problematic PDFs:`);
    for (const finding of findings.slice(0, options.limit)) {
      console.log(
        `- [${finding.severity.toUpperCase()}] ${finding.file} | parser=${finding.parserUsed} | chars=${finding.chars} | bytes=${finding.bytes} | ${finding.reason}`
      );
    }
    process.exitCode = 2;
  }
}

run().catch((error: any) => {
  console.error("PDF quality report failed:", error?.message || error);
  process.exit(1);
});