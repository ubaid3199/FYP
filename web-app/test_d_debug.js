const http = require('http');

async function ask(prompt) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            messages: [{ role: 'user', content: prompt }],
            userId: 'test_' + Date.now(),
            model: 'gemma4:e4b',
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
            timeout: 60000
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
        req.on('timeout', () => { req.destroy(); reject(new Error('Timeout after 60s')); });
        req.write(postData);
        req.end();
    });
}

async function test() {
    const prompt = 'i am facing financial difficulties what financial support do i have';
    console.log(`Testing: "${prompt}"\n`);
    
    try {
        const response = await ask(prompt);
        console.log(`Response length: ${response.length} chars\n`);
        console.log(`Has C:\\ leak: ${response.includes('C:\\')}\n`);
        console.log(`Full response:\n${response}`);
    } catch (err) {
        console.error(`ERROR: ${err.message}`);
    }
}

test();
