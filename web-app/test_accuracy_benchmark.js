const http = require('http');

const BENCH_MODEL = process.env.BENCH_MODEL || 'gemma3:latest';

async function ask(prompt) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            messages: [{ role: 'user', content: prompt }],
            userId: 'benchmarker_' + Date.now(),
            model: BENCH_MODEL,
            stream: true,
            isRestricted: false
        });

        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/api/assistant/chat',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            },
            timeout: 180000
        };

        const req = http.request(options, (res) => {
            let fullText = '';
            res.on('data', (chunk) => {
                const lines = chunk.toString().split('\n').filter(l => l.trim());
                for (const line of lines) {
                    try {
                        const json = JSON.parse(line);
                        if (json.message && json.message.content) {
                            fullText += json.message.content;
                        }
                    } catch (e) {}
                }
            });
            res.on('end', () => resolve(fullText));
        });

        req.on('error', (e) => reject(new Error(`Request error: ${e.message}`)));
        req.on('timeout', () => { req.destroy(); reject(new Error('Timeout after 180s')); });
        req.write(postData);
        req.end();
    });
}

async function runBenchmark() {
    const tests = [
        {
            id: 'A',
            prompt: 'can you give me the link to the mitigating circumstances portal',
            check: (text) => text.includes('https://rulattendance.seats.cloud/angular/#/me'),
            reason: 'Missing required SEATS link'
        },
        {
            id: 'B',
            prompt: 'i have security concerns, how can i contact the security',
            check: (text) => (text.includes('http') || text.includes('Not confirmed in docs')) && !text.includes('C:\\'),
            reason: 'Local path leak or missing source/fallback'
        },
        {
            id: 'C',
            prompt: 'what are the opening hours of library and show me source of it as well',
            check: (text) => text.includes('http') || text.includes('Not confirmed in docs'),
            reason: 'No source or proper fallback provided'
        },
        {
            id: 'D',
            prompt: 'i am facing financial difficulties what financial support do i have',
            check: (text) => !text.includes('C:\\') && text.length > 50,
            reason: 'Local path leak or too short response'
        },
        {
            id: 'E',
            prompt: 'what is the capital of france',
            check: (text) => /paris/i.test(text),
            reason: 'Did not identify Paris'
        },
        {
            id: 'F',
            prompt: 'explain photosynthesis in 2 lines',
            check: (text) => text.length <= 450 && (/plant/i.test(text) || /light/i.test(text) || /chlorophyll/i.test(text)),
            reason: 'Too long or missing key scientific terms'
        },
        {
            id: 'G',
            prompt: 'give me the exact email of security team',
            check: (text) => (text.includes('@') && text.includes('http')) || text.includes('Not confirmed in docs'),
            reason: 'Invented email without source or missing fallback'
        },
        {
            id: 'H',
            prompt: 'what is source',
            check: (text) => text.length > 0,
            reason: 'Empty response'
        }
    ];

    let passed = 0;
    console.log('--- Accuracy Benchmark Starting ---');
    
    for (const t of tests) {
        process.stdout.write(`Testing ${t.id}... `);
        try {
            const response = await ask(t.prompt);
            const ok = t.check(response);
            if (ok) {
                console.log('PASS');
                passed++;
            } else {
                console.log(`FAIL (${t.reason})`);
                console.log(`   Response Snippet: ${response.substring(0, 100).replace(/\n/g, ' ')}...`);
            }
        } catch (err) {
            console.log(`ERROR: ${err.message}`);
        }
    }

    console.log(`\nFinal Score: ${passed}/${tests.length}`);
    if (passed < tests.length) {
        console.log('Hallucination Risk: Check failed tests for local path leaks or unsourced claims.');
    }
}

// Check connectivity first
const checkReq = http.get('http://localhost:3000', (res) => {
    res.on('data', () => {});
    runBenchmark();
}).on('error', (e) => {
    console.error('CRITICAL: localhost:3000 is unreachable. Ensure the dev server is running.');
    process.exit(1);
});
