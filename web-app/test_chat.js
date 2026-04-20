const http = require('http');
const postData = JSON.stringify({
  messages: [{ role: 'user', content: 'i got injured is there any medical facilities on campus' }],
  userId: 'student_default',
  model: 'gemma3:1b'
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
  let fullAnswer = '';
  console.log('HTTP Status:', res.statusCode);
  
  res.on('data', (chunk) => {
    const lines = chunk.toString().split('\n').filter(l => l.trim());
    for (const d of lines) {
      try {
        const json = JSON.parse(d);
        if (json.message && json.message.content) {
          fullAnswer += json.message.content;
        }
      } catch (e) {}
    }
  });

  res.on('end', () => {
    console.log('Contains \"Sources:\":', fullAnswer.includes('Sources:'));
    const lines = fullAnswer.split('\n');
    let dashLines = lines.filter(l => l.trim().startsWith('- ')).slice(0, 6);
    dashLines.forEach(l => console.log(l.trim()));
    const httpLines = lines.filter(l => l.trim().startsWith('- http')).length;
    console.log('Count of lines starting with \"- http\":', httpLines);
  });
});

req.on('error', (e) => {
  console.error('Error:', e.message);
});

req.write(postData);
req.end();
