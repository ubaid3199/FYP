import re

path = 'C:/Users/Ubaid/Desktop/fyp/web-app/lib/domains/rag/hybridStore.ts'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Add numGpu to OllamaEmbeddings config
old = """      const embeddings = new OllamaEmbeddings({ 
        model: process.env.OLLAMA_EMBEDDING_MODEL || "nomic-embed-text:latest",
        baseUrl: 'http://127.0.0.1:11434'
      });"""

new = """      const embeddings = new OllamaEmbeddings({ 
        model: process.env.OLLAMA_EMBEDDING_MODEL || "nomic-embed-text:latest",
        baseUrl: 'http://127.0.0.1:11434',
        numGpu: process.env.OLLAMA_NUM_GPU ? parseInt(process.env.OLLAMA_NUM_GPU) : -1
      });"""

if old in content:
    content = content.replace(old, new)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('GPU support added to OllamaEmbeddings')
else:
    print('Pattern not found, trying alternative...')
    # Try single quotes version
    old2 = '''      const embeddings = new OllamaEmbeddings({ 
        model: process.env.OLLAMA_EMBEDDING_MODEL || "nomic-embed-text:latest",
        baseUrl: 'http://127.0.0.1:11434'
      });'''
    if old2 in content:
        content = content.replace(old2, new)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print('GPU support added (alt pattern)')
    else:
        print('Still not found, checking...')
        idx = content.find('OllamaEmbeddings')
        print('Found at:', idx)
        print(repr(content[idx:idx+200]))
