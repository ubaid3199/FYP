import re

path = 'C:/Users/Ubaid/Desktop/fyp/web-app/lib/domains/rag/hybridStore.ts'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Find and replace the writeFileSync line with directory creation
pattern = re.compile(r'(\s+fs\.writeFileSync\(VECTOR_STORE_PATH, JSON\.stringify\(data\)\);)')
match = pattern.search(content)
if match:
    indent = match.group(1)[:match.group(1).find('fs')]
    replacement = f'''{indent}const dir = path.dirname(VECTOR_STORE_PATH);
{indent}if (!fs.existsSync(dir)) {{
{indent}  fs.mkdirSync(dir, {{ recursive: true }});
{indent}}}
{indent}fs.writeFileSync(VECTOR_STORE_PATH, JSON.stringify(data));'''
    content = pattern.sub(replacement, content, count=1)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('saveToDisk fixed: added directory creation')
else:
    print('Pattern not found in file')
