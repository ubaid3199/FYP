import re

path = 'C:/Users/Ubaid/Desktop/fyp/web-app/lib/domains/rag/hybridStore.ts'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Check if VECTOR_STORE_DIR is DEFINED (not just referenced)
if not re.search(r'const\s+VECTOR_STORE_DIR\s*=', content):
    # Replace the line that defines VECTOR_STORE_PATH
    old = 'const VECTOR_STORE_PATH = path.join(VECTOR_STORE_DIR, "hybrid_store.json");'
    new = '''const VECTOR_STORE_DIR = process.env.VECTOR_STORE_DIR || path.join(__dirname, "..", "..", "..", ".vector_store");
const VECTOR_STORE_PATH = path.join(VECTOR_STORE_DIR, "hybrid_store.json");'''
    content = content.replace(old, new)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('FIXED: Added VECTOR_STORE_DIR definition')
else:
    print('OK: VECTOR_STORE_DIR already defined')
