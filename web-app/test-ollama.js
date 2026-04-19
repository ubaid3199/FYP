fetch('http://127.0.0.1:11434/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'gpt-oss:20b',
    messages: [{ role: 'user', content: 'hello' }],
    stream: false,
  })
})
.then(async res => {
  console.log('Status:', res.status);
  const text = await res.text();
  console.log('Body:', text);
})
.catch(err => console.error(err));
