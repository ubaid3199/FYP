const http = require('http');

const BENCH_MODEL = process.env.BENCH_MODEL || 'gemma4:e4b';
const TEST_LIGHT_MODEL = 'gemma3:latest';

async function ask(prompt, model) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            messages: [{ role: 'user', content: prompt }],
            userId: 'tester_' + Date.now(),
            model: model,
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
            timeout: 120000
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
        req.on('timeout', () => { req.destroy(); reject(new Error('Timeout after 120s')); });
        req.write(postData);
        req.end();
    });
}

async function runComparison() {
    const tests = [
        {
            prompt: 'What are the opening hours of the library?',
            name: 'Library Hours Query'
        },
        {
            prompt: 'how can i contact the security team?',
            name: 'Security Contact Query'
        },
        {
            prompt: 'show me the link to apply for accommodation',
            name: 'Accommodation Link Query'
        },
        {
            prompt: 'What is photosynthesis?',
            name: 'General Knowledge Query'
        }
    ];

    console.log('--- Model Comparison Test ---');
    console.log(`Testing with Heavy Model: ${BENCH_MODEL} and Light Model: ${TEST_LIGHT_MODEL}\n`);

    for (const test of tests) {
        console.log(`\n[${test.name}]`);
        console.log(`Prompt: "${test.prompt}"`);
        
        try {
            const startHeavy = Date.now();
            const heavyResponse = await ask(test.prompt, BENCH_MODEL);
            const heavyTime = Date.now() - startHeavy;
            console.log(`\nHeavy Model (${BENCH_MODEL}) [${heavyTime}ms]:`);
            console.log(`  Length: ${heavyResponse.length} chars`);
            console.log(`  Preview: ${heavyResponse.substring(0, 120).replace(/\n/g, ' ')}...`);
            console.log(`  Has URLs: ${heavyResponse.includes('http')}`);
            
            const startLight = Date.now();
            const lightResponse = await ask(test.prompt, TEST_LIGHT_MODEL);
            const lightTime = Date.now() - startLight;
            console.log(`\nLight Model (${TEST_LIGHT_MODEL}) [${lightTime}ms]:`);
            console.log(`  Length: ${lightResponse.length} chars`);
            console.log(`  Preview: ${lightResponse.substring(0, 120).replace(/\n/g, ' ')}...`);
            console.log(`  Has URLs: ${lightResponse.includes('http')}`);
        } catch (err) {
            console.log(`  ERROR: ${err.message}`);
        }
    }
}

// Check connectivity first
const checkReq = http.get('http://localhost:3000', (res) => {
    res.on('data', () => {});
    runComparison();
}).on('error', (e) => {
    console.error('CRITICAL: localhost:3000 is unreachable. Ensure the dev server is running.');
    process.exit(1);
});
