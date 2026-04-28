const fs = require('fs');
const path = require('path');
const http = require('http');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const scrapedDirSetting = (process.env.SCRAPED_DOCS_DIR || 'scraped').trim();
const scrapedRoot = path.isAbsolute(scrapedDirSetting)
  ? scrapedDirSetting
  : path.resolve(process.cwd(), '..', 'pdf files', scrapedDirSetting);

const pageMapPath = path.join(scrapedRoot, '_page_source_map.json');
const pdfMapPath = path.join(scrapedRoot, 'pdfs', '_source_map.json');

function loadJson(filePath) {
  if (!fs.existsSync(filePath)) return {};
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeUrl(url) {
  return String(url || '').trim();
}

function extractUrls(text) {
  const matches = String(text || '').match(/https?:\/\/[^\s)\]>"']+/gi) || [];
  return Array.from(new Set(matches.map(normalizeUrl)));
}

function hasLocalPathLeak(text) {
  return /pdf files\/|\\\\|\.md\b|[a-zA-Z]:\\/i.test(String(text || ''));
}

function ask(prompt, model = 'gemma3:latest') {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const body = JSON.stringify({
      messages: [{ role: 'user', content: prompt }],
      userId: `linkcheck_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      model,
      stream: true,
    });

    const req = http.request(
      {
        hostname: 'localhost',
        port: 3000,
        path: '/api/assistant/chat',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: 180000,
      },
      (res) => {
        let text = '';
        res.on('data', (d) => {
          const lines = d.toString().split('\n').filter((line) => line.trim());
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line);
              if (parsed?.message?.content) {
                text += String(parsed.message.content);
              }
            } catch {
              // Ignore partial/non-JSON fragments.
            }
          }
        });
        res.on('end', () => {
          if (!(res.statusCode >= 200 && res.statusCode < 300)) {
            resolve({ ok: false, statusCode: res.statusCode || 0, text, ms: Date.now() - started });
          } else {
            resolve({ ok: true, statusCode: res.statusCode || 0, text, ms: Date.now() - started });
          }
        });
      }
    );

    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Request timeout')));
    req.write(body);
    req.end();
  });
}

async function run() {
  const pageMap = loadJson(pageMapPath);
  const pdfMap = loadJson(pdfMapPath);
  const allowedLinks = new Set([
    ...Object.values(pageMap).map(normalizeUrl),
    ...Object.values(pdfMap).map(normalizeUrl),
    'https://rulattendance.seats.cloud/angular/#/me',
  ].filter((x) => x.startsWith('http://') || x.startsWith('https://')));

  const tests = [
    { id: 'L1', prompt: 'how can i apply for mitigating circumstances and give links/forms and sources', keywords: ['mitigating', 'circumstances'] },
    { id: 'L2', prompt: 'where can i find examination timetable with links and source', keywords: ['exam', 'timetable'] },
    { id: 'L3', prompt: 'cost of living support options and forms with links', keywords: ['cost', 'support'] },
    { id: 'L4', prompt: 'how do i contact security and provide source', keywords: ['security'] },
    { id: 'L5', prompt: 'give me links/forms for enrolment', keywords: ['enrol'] },
  ];

  const results = [];
  let passCount = 0;

  for (const test of tests) {
    try {
      const res = await ask(test.prompt);
      const urls = extractUrls(res.text);
      const inMap = urls.filter((u) => allowedLinks.has(u));
      const outOfMap = urls.filter((u) => !allowedLinks.has(u));
      const hasKeyword = test.keywords.some((k) => String(res.text).toLowerCase().includes(k));
      const pass =
        res.ok &&
        !hasLocalPathLeak(res.text) &&
        urls.length > 0 &&
        inMap.length > 0 &&
        outOfMap.length === 0 &&
        hasKeyword;

      if (pass) passCount += 1;

      results.push({
        id: test.id,
        prompt: test.prompt,
        pass,
        statusCode: res.statusCode,
        ms: res.ms,
        urlCount: urls.length,
        inMapCount: inMap.length,
        outOfMapCount: outOfMap.length,
        hasLocalPathLeak: hasLocalPathLeak(res.text),
        hasKeyword,
        urls,
        outOfMap,
        preview: String(res.text).slice(0, 240).replace(/\s+/g, ' '),
      });
    } catch (error) {
      results.push({
        id: test.id,
        prompt: test.prompt,
        pass: false,
        error: error.message,
      });
    }
  }

  const summary = {
    scrapedRoot,
    pageMapEntries: Object.keys(pageMap).length,
    pdfMapEntries: Object.keys(pdfMap).length,
    allowedLinkCount: allowedLinks.size,
    total: tests.length,
    passed: passCount,
    failed: tests.length - passCount,
    passRate: Number(((passCount / tests.length) * 100).toFixed(1)),
    ranAt: new Date().toISOString(),
  };

  const outPath = path.resolve(process.cwd(), 'benchmark_links_grounding.json');
  fs.writeFileSync(outPath, JSON.stringify({ summary, results }, null, 2), 'utf8');

  console.log(JSON.stringify({ summary, outPath }, null, 2));
  for (const row of results) {
    console.log(`${row.id}: ${row.pass ? 'PASS' : 'FAIL'} (urls=${row.urlCount || 0}, inMap=${row.inMapCount || 0}, outOfMap=${row.outOfMapCount || 0})`);
    if (row.outOfMap && row.outOfMap.length > 0) {
      console.log(`  outOfMap sample: ${row.outOfMap.slice(0, 2).join(' | ')}`);
    }
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
