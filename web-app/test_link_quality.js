const http = require('http');

async function ask(prompt, model = 'gemma4:e4b') {
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
            timeout: 90000
        };

        const startTime = Date.now();
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
            res.on('end', () => {
                const elapsed = Date.now() - startTime;
                resolve({ text: fullText, time: elapsed });
            });
        });

        req.on('error', (e) => reject(new Error(`Request error: ${e.message}`)));
        req.on('timeout', () => { req.destroy(); reject(new Error('Timeout after 90s')); });
        req.write(postData);
        req.end();
    });
}

async function testLinkQuality() {
    const linkTests = [
        { prompt: 'show me the link for accommodation', expected: 'accommodation', name: 'Accommodation Link' },
        { prompt: 'where is the library?', expected: 'library', name: 'Library Link' },
        { prompt: 'give me academic support link', expected: 'academic', name: 'Academic Support' },
    ];

    console.log('--- Link Quality Test ---\n');
    
    for (const test of linkTests) {
        process.stdout.write(`Testing: ${test.name}... `);
        try {
            const result = await ask(test.prompt);
            const hasUrl = result.text.includes('http');
            const hasKeyword = result.text.toLowerCase().includes(test.expected);
            const urlLines = result.text.match(/https?:\/\/[^\s)]+/g) || [];
            
            if (hasUrl && hasKeyword) {
                console.log(`PASS (${urlLines.length} URLs, ${result.time}ms)`);
            } else if (hasUrl && !hasKeyword) {
                console.log(`PARTIAL (URLs present but may be irrelevant, ${result.time}ms)`);
                console.log(`  URLs: ${urlLines.slice(0, 2).join(', ')}`);
            } else {
                console.log(`FAIL (No URLs, ${result.time}ms)`);
            }
        } catch (err) {
            console.log(`ERROR: ${err.message}`);
        }
    }
}

// Check connectivity first
const checkReq = http.get('http://localhost:3000', (res) => {
    res.on('data', () => {});
    testLinkQuality();
}).on('error', (e) => {
    console.error('CRITICAL: localhost:3000 is unreachable. Ensure the dev server is running.');
    process.exit(1);
});
