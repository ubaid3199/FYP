const fs = require('fs');
const path = require('path');
const http = require('http');

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = { label: 'run', out: '', model: process.env.BENCH_MODEL || 'gemma3:latest' };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--label' && args[i + 1]) parsed.label = args[++i];
    else if (a === '--out' && args[i + 1]) parsed.out = args[++i];
    else if (a === '--model' && args[i + 1]) parsed.model = args[++i];
  }
  return parsed;
}

function ask(prompt, model = 'gemma3:latest') {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const body = JSON.stringify({
      messages: [{ role: 'user', content: prompt }],
      userId: `bench_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
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
        res.on('data', (chunk) => {
          const lines = chunk.toString().split('\n').filter((l) => l.trim());
          for (const line of lines) {
            try {
              const json = JSON.parse(line);
              if (json.message && json.message.content) {
                text += json.message.content;
              }
            } catch {
              // Ignore partial/non-JSON stream fragments.
            }
          }
        });
        res.on('end', () => {
          resolve({
            ok: res.statusCode && res.statusCode >= 200 && res.statusCode < 300,
            statusCode: res.statusCode || 0,
            ms: Date.now() - startedAt,
            text,
          });
        });
      }
    );

    req.on('timeout', () => {
      req.destroy(new Error('Request timeout'));
    });
    req.on('error', (err) => reject(err));
    req.write(body);
    req.end();
  });
}

function hasLocalPathLeak(text) {
  return /pdf files\/|\\\\|\.md\b|[a-zA-Z]:\\/i.test(text);
}

function scoreCase(test, responseText) {
  const checks = test.checks || [];
  const detail = checks.map((c) => ({
    name: c.name,
    pass: Boolean(c.fn(responseText)),
  }));
  const pass = detail.every((x) => x.pass);
  return { pass, detail };
}

async function waitForServer(maxMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get('http://localhost:3000', (res) => {
          res.resume();
          resolve();
        });
        req.on('error', reject);
        req.setTimeout(3000, () => req.destroy(new Error('timeout')));
      });
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  return false;
}

async function run() {
  const cfg = parseArgs();
  const tests = [
    {
      id: 'T1',
      prompt: 'how can i apply for mitigating circumstances',
      checks: [
        { name: 'has-link', fn: (t) => /https?:\/\//i.test(t) },
        { name: 'no-local-path', fn: (t) => !hasLocalPathLeak(t) },
      ],
    },
    {
      id: 'T2',
      prompt: 'how can i apply for mitigating circumstances and give me source',
      checks: [
        { name: 'has-sources-heading', fn: (t) => /sources:/i.test(t) },
        { name: 'has-url', fn: (t) => /https?:\/\//i.test(t) },
      ],
    },
    {
      id: 'T3',
      prompt: 'hello',
      checks: [
        { name: 'no-sources-block', fn: (t) => !/sources:/i.test(t) },
        { name: 'no-local-path', fn: (t) => !hasLocalPathLeak(t) },
      ],
    },
    {
      id: 'T4',
      prompt: 'i am injured what should i do on campus',
      checks: [
        { name: 'actionable-answer', fn: (t) => t.length >= 50 },
        { name: 'no-local-path', fn: (t) => !hasLocalPathLeak(t) },
      ],
    },
    {
      id: 'T5',
      prompt: 'how do i contact security and provide source',
      checks: [
        { name: 'has-url-or-safe-fallback', fn: (t) => /https?:\/\//i.test(t) || /Not confirmed in docs/i.test(t) },
        { name: 'no-local-path', fn: (t) => !hasLocalPathLeak(t) },
      ],
    },
    {
      id: 'T6',
      prompt: 'financial support options for students with links',
      checks: [
        { name: 'has-link', fn: (t) => /https?:\/\//i.test(t) },
        { name: 'has-helpful-links-or-detail', fn: (t) => /helpful links\/forms:/i.test(t) || t.length > 120 },
      ],
    },
    {
      id: 'T7',
      prompt: 'library opening hours and give source',
      checks: [
        { name: 'has-source-or-safe-fallback', fn: (t) => /sources:/i.test(t) || /Not confirmed in docs/i.test(t) },
        { name: 'no-local-path', fn: (t) => !hasLocalPathLeak(t) },
      ],
    },
    {
      id: 'T8',
      prompt: 'give me links/forms for enrolment',
      checks: [
        { name: 'has-link', fn: (t) => /https?:\/\//i.test(t) },
        { name: 'no-local-path', fn: (t) => !hasLocalPathLeak(t) },
      ],
    },
    {
      id: 'T9',
      prompt: 'what is the source',
      checks: [
        { name: 'non-empty', fn: (t) => t.trim().length > 0 },
      ],
    },
    {
      id: 'T10',
      prompt: 'explain photosynthesis in 2 lines',
      checks: [
        { name: 'domain-general-answer', fn: (t) => /plant|light|photosynthesis|chlorophyll/i.test(t) },
      ],
    },
    {
      id: 'T11',
      prompt: 'where can i find examination timetable with links',
      checks: [
        { name: 'has-link-or-safe-fallback', fn: (t) => /https?:\/\//i.test(t) || /Not confirmed in docs/i.test(t) },
      ],
    },
    {
      id: 'T12',
      prompt: 'cost of living support options and forms',
      checks: [
        { name: 'has-link', fn: (t) => /https?:\/\//i.test(t) },
      ],
    },
  ];

  const ready = await waitForServer();
  if (!ready) {
    console.error('Server not reachable on localhost:3000');
    process.exit(2);
  }

  const results = [];
  let passCount = 0;

  console.log(`Starting benchmark run: ${cfg.label}`);
  for (const test of tests) {
    process.stdout.write(`- ${test.id} ... `);
    try {
      const res = await ask(test.prompt, cfg.model);
      const score = scoreCase(test, res.text);
      if (res.ok && score.pass) {
        console.log(`PASS (${res.ms}ms)`);
        passCount += 1;
      } else {
        console.log(`FAIL (${res.ms}ms)`);
      }

      results.push({
        id: test.id,
        prompt: test.prompt,
        statusCode: res.statusCode,
        ms: res.ms,
        pass: res.ok && score.pass,
        checks: score.detail,
        hasLocalPathLeak: hasLocalPathLeak(res.text),
        hasUrl: /https?:\/\//i.test(res.text),
        answerPreview: res.text.slice(0, 220).replace(/\s+/g, ' '),
      });
    } catch (err) {
      console.log(`ERROR (${err.message})`);
      results.push({
        id: test.id,
        prompt: test.prompt,
        error: err.message,
        pass: false,
      });
    }
  }

  const timings = results.filter((r) => typeof r.ms === 'number').map((r) => r.ms);
  timings.sort((a, b) => a - b);
  const avgMs = timings.length ? Math.round(timings.reduce((a, b) => a + b, 0) / timings.length) : 0;
  const p95Ms = timings.length ? timings[Math.max(0, Math.ceil(timings.length * 0.95) - 1)] : 0;

  const summary = {
    label: cfg.label,
    model: cfg.model,
    total: tests.length,
    passed: passCount,
    failed: tests.length - passCount,
    passRate: Number(((passCount / tests.length) * 100).toFixed(1)),
    avgMs,
    p95Ms,
    localPathLeaks: results.filter((r) => r.hasLocalPathLeak).length,
    urlResponses: results.filter((r) => r.hasUrl).length,
    ranAt: new Date().toISOString(),
  };

  console.log('--- Summary ---');
  console.log(summary);

  const report = { summary, results };
  if (cfg.out) {
    const outPath = path.resolve(cfg.out);
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`Report written: ${outPath}`);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
