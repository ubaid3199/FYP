const http = require('http');

async function testAssistant(model, timeoutMs = 180000) {
    return new Promise((resolve, reject) => {
        const postContent = JSON.stringify({
            messages: [{ role: 'user', content: 'i got injured is there any medical facilities on campus' }],
            userId: 'student_default',
            model: model
        });

        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/api/assistant/chat',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postContent)
            },
            timeout: timeoutMs
        };

        const req = http.request(options, (res) => {
            console.log(`--- Testing model: ${model} ---`);
            console.log(`HTTP Status: ${res.statusCode}`);
            
            let fullAnswer = '';
            let buffer = '';

            res.on('data', (chunk) => {
                const chunkStr = chunk.toString();
                buffer += chunkStr;
                let lines = buffer.split('\n');
                buffer = lines.pop();

                for (const line of lines) {
                    if (line.trim()) {
                        try {
                            const json = JSON.parse(line);
                            if (json.message && json.message.content) {
                                fullAnswer += json.message.content;
                            }
                        } catch (e) {}
                    }
                }
            });

            res.on('end', () => {
                if (buffer.trim()) {
                    try {
                        const json = JSON.parse(buffer);
                        if (json.message && json.message.content) {
                            fullAnswer += json.message.content;
                        }
                    } catch (e) {}
                }

                console.log(`Contains 'Sources:': ${fullAnswer.includes('Sources:')}`);
                const lines = fullAnswer.split('\n');
                console.log('--- First 10 lines starting with "- " ---');
                const listItems = lines.filter(l => l.trim().startsWith('- ')).slice(0, 10);
                listItems.forEach(l => console.log(l.trim()));
                
                const sourceLinks = lines.filter(l => l.trim().startsWith('- http://') || l.trim().startsWith('- https://'));
                console.log(`Count of source lines starting with http: ${sourceLinks.length}`);
                
                console.log('--- Full Final Answer ---');
                console.log(fullAnswer);
                console.log(`--- End test for ${model} ---\n`);
                resolve(sourceLinks.length > 0);
            });
        });

        req.on('timeout', () => {
            req.destroy();
            console.error(`Request for ${model} timed out after ${timeoutMs}ms`);
            resolve(false);
        });

        req.on('error', (e) => {
            console.error(`Error testing ${model}: ${e.message}`);
            resolve(false);
        });

        req.write(postContent);
        req.end();
    });
}

(async () => {
    try {
        const pass1 = await testAssistant('gemma3:1b');
        const pass2 = await testAssistant('gemma4:e2b', 180000);
        console.log('SUMMARY:');
        console.log(`Requirement Check (Actual URLs returned): ${(pass1 || pass2) ? 'PASS' : 'FAIL'}`);
    } catch (e) {
        console.error(e);
    }
})();
