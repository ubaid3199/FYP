import re

path = 'C:/Users/Ubaid/Desktop/fyp/web-app/lib/domains/rag/hybridStore.ts'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Check if VECTOR_STORE_DIR is defined
if 'VECTOR_STORE_DIR' not in content:
    # Replace the line that defines VECTOR_STORE_PATH
    old_line = 'const VECTOR_STORE_PATH = path.join(VECTOR_STORE_DIR, "hybrid_store.json");'
    new_lines = '''const VECTOR_STORE_DIR = process.env.VECTOR_STORE_DIR || path.join(__dirname, "..", "..", "..", ".vector_store");
const VECTOR_STORE_PATH = path.join(VECTOR_STORE_DIR, "hybrid_store.json");'''
    content = content.replace(old_line, new_lines)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('FIXED: Added VECTOR_STORE_DIR definition')
else:
    print('OK: VECTOR_STORE_DIR already defined')
