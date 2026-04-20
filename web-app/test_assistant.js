const http = require('http');

const postData = JSON.stringify({
  messages: [{ role: "user", content: "i got injured is there any medical facilities on campus" }],
  userId: "student_default",
  model: "gemma4:e2b"
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/assistant/chat',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': postData.length
  },
  timeout: 10000
};

const req = http.request(options, (res) => {
  console.log(`HTTP Status: ${res.statusCode}`);
  let fullAnswer = "";
  
  res.on('data', (chunk) => {
    const lines = chunk.toString().split('\n');
    for (const line of lines) {
      if (line.trim()) {
        try {
          const json = JSON.parse(line);
          if (json.message && json.message.content) {
            fullAnswer += json.message.content;
          }
        } catch (e) {
          // Ignore parse errors for potential non-JSON chunks or incomplete lines
        }
      }
    }
  });

  res.on('end', () => {
    console.log(`Contains 'Sources:': ${fullAnswer.includes('Sources:')}`);
    
    const lines = fullAnswer.split('\n');
    console.log('--- Lines starting with \"- \" (up to 6) ---');
    let dashCount = 0;
    for (const line of lines) {
       if (line.trim().startsWith('- ') && dashCount < 6) {
          console.log(line.trim());
          dashCount++;
       }
    }
    
    const httpLineCount = lines.filter(line => line.trim().startsWith('- http') || line.trim().startsWith('- https')).length;
    console.log(`Count of lines starting with '- http' or '- https': ${httpLineCount}`);
    
    console.log('\n--- Full Final Concatenated Answer ---');
    console.log(fullAnswer);
  });
});

req.on('error', (e) => {
  console.error(`Unreachable: ${e.message}`);
});

req.write(postData);
req.end();
