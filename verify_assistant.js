const http = require('http');

async function ask(content) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      messages: [{ role: 'user', content: content }],
      userId: 'test_user_unique',
      model: 'gemma3:latest'
    });

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/assistant/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
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

    req.on('error', (e) => reject(e));
    req.write(postData);
    req.end();
  });
}

async function run() {
  const prompts = [
    'how can i apply for mitigating circumstances',
    'hello'
  ];

  for (const prompt of prompts) {
    console.log('--- Prompt: ' + prompt + ' ---');
    try {
      const response = await ask(prompt);
      console.log('Contains \"Helpful links/forms:\": ' + response.includes('Helpful links/forms:'));
      console.log('Contains \"Sources:\": ' + response.includes('Sources:'));
      console.log('First 500 chars: ' + response.substring(0, 500).replace(/\n/g, ' '));
    } catch (err) {
      console.error('Error:', err.message);
    }
    console.log('');
  }
}

run();
