import re

path = 'C:/Users/Ubaid/Desktop/fyp/web-app/lib/domains/rag/hybridStore.ts'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix saveToDisk to create directory
old = '''     fs.writeFileSync(VECTOR_STORE_PATH, JSON.stringify(data));
     console.log("Saved hybrid store securely to disk.");'''

new = '''     const dir = path.dirname(VECTOR_STORE_PATH);
     if (!fs.existsSync(dir)) {
       fs.mkdirSync(dir, { recursive: true });
     }
     fs.writeFileSync(VECTOR_STORE_PATH, JSON.stringify(data));
     console.log("Saved hybrid store securely to disk.");'''

if old in content:
    content = content.replace(old, new)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('saveToDisk fixed: directory creation added')
else:
    print('Pattern not found')
    # Show context around line 254
    idx = content.find('writeFileSync(VECTOR_STORE_PATH')
    if idx >= 0:
        print('Found writeFileSync at:', idx)
        print(repr(content[idx-50:idx+100]))
