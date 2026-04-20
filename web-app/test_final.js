const http = require('http');

const postData = JSON.stringify({
  messages: [{ role: 'user', content: 'i got injured is there any medical facilities on campus' }],
  userId: 'student_default',
  model: 'gemma4:e2b'
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/assistant/chat',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, (res) => {
  let fullAnswer = '';
  console.log('HTTP Status: ' + res.statusCode);
  
  res.on('data', (chunk) => {
    const lines = chunk.toString().split('\n');
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
    console.log('Contains Sources: ' + fullAnswer.includes('Sources:'));
    const lines = fullAnswer.split('\n');
    let dashCount = 0;
    for (const l of lines) {
       if (l.trim().startsWith('- ') && dashCount < 6) {
          console.log(l.trim());
          dashCount++;
       }
    }
    
    const httpLineCount = lines.filter(l => l.trim().startsWith('- http')).length;
    console.log('Count of - http lines: ' + httpLineCount);
    process.exit(0);
  });
});

req.on('error', (e) => {
  console.log('Unreachable: ' + e.message);
  process.exit(1);
});

req.write(postData);
req.end();

setTimeout(() => {
  console.log('Request timed out after 120 seconds');
  process.exit(1);
}, 120000);
