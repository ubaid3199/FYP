import re

with open('C:/Users/Ubaid/Desktop/fyp/scraper/scrape.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace box-drawing characters with ASCII equivalents
content = content.replace('Ôä╣´©Å', '[+]')
content = content.replace('ÔÜá´©Å', '[INFO]')
content = content.replace('Ôå¬´©Å', '[SKIP]')
content = content.replace('Ôæá', '[+]')
content = content.replace('Ô£à', '[*]')
content = content.replace('Ôåá', '[FOUND]')
content = content.replace('ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔò','')

# Also replace any remaining non-ASCII box drawing chars
content = re.sub(r'[\u2500-\u259f]', '', content)

with open('C:/Users/Ubaid/Desktop/fyp/scraper/scrape.py', 'w', encoding='utf-8') as f:
    f.write(content)

print('Fixed encoding issues')