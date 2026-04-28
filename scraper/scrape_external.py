"""
Public pages scraper (no login needed).
Scrapes roehampton.ac.uk and roehamptonsu.com using requests+BeautifulSoup.
Saves as .md files into the same scraped output directory.
"""
import json, re, sys, time, urllib.parse, hashlib
from pathlib import Path
from collections import deque
import requests
from bs4 import BeautifulSoup

sys.stdout.reconfigure(encoding='utf-8')

OUTPUT_DIR    = Path(__file__).parent.parent / "pdf files" / "scraped"
PAGE_MAP_FILE = OUTPUT_DIR / "_page_source_map.json"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
    "Accept-Language": "en-GB,en;q=0.9",
}
TIMEOUT      = 20
MIN_CONTENT  = 200
MAX_PAGES    = 300  # limit per domain to avoid runaway crawl

ALLOWED_DOMAINS = {
    "www.roehampton.ac.uk",
    "roehampton.ac.uk",
    "roehamptonsu.com",
    "www.roehamptonsu.com",
}

SKIP_PATTERNS = re.compile(
    r"\.(css|js|json|xml|ico|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot|map)(\?|$)"
    r"|/logout|/signout|/login|/signin"
    r"|/tag/|/author/|/feed/"
    r"|moodle\.roehampton|learn\.roehampton"
    r"|/wp-json/|/xmlrpc"
    r"|/newsandevents/"
    r"|/past-exam|/exam-papers|pastexam"
    r"|[?&](page|p|lang)=\d",
    re.IGNORECASE,
)

SEEDS = [
    # Roehampton main site
    "https://www.roehampton.ac.uk/current-students/",
    "https://www.roehampton.ac.uk/student-life/",
    "https://www.roehampton.ac.uk/student-support/",
    "https://www.roehampton.ac.uk/student-support/mental-health-and-wellbeing/",
    "https://www.roehampton.ac.uk/student-support/disability-and-dyslexia/",
    "https://www.roehampton.ac.uk/student-support/financial-support/",
    "https://www.roehampton.ac.uk/student-support/careers/",
    "https://www.roehampton.ac.uk/student-support/international-students/",
    "https://www.roehampton.ac.uk/student-support/accommodation/",
    "https://www.roehampton.ac.uk/about-us/campus/",
    "https://www.roehampton.ac.uk/about-us/",
    "https://www.roehampton.ac.uk/library/",
    "https://www.roehampton.ac.uk/study-with-us/",
    # Student Union
    "https://roehamptonsu.com/",
    "https://roehamptonsu.com/advice",
    "https://roehamptonsu.com/activities",
    "https://roehamptonsu.com/help",
    "https://roehamptonsu.com/voice",
]

def sanitise_filename(text, max_len=90):
    text = re.sub(r"[^\w\s\-]", "", text)
    text = re.sub(r"\s+", "_", text.strip())
    return text[:max_len] or "page"

def unique_path(directory, stem, suffix):
    path = directory / f"{stem}{suffix}"
    counter = 1
    while path.exists():
        path = directory / f"{stem}_{counter}{suffix}"
        counter += 1
    return path

def normalise_url(href, base):
    try:
        full = urllib.parse.urljoin(base, href).split("#")[0]
        p = urllib.parse.urlparse(full)
        if p.scheme not in ("http", "https"):
            return ""
        path = p.path.rstrip("/") or "/"
        return urllib.parse.urlunparse(p._replace(path=path, fragment=""))
    except Exception:
        return ""

def allowed(url):
    try:
        netloc = urllib.parse.urlparse(url).netloc.lower()
        return netloc in ALLOWED_DOMAINS
    except Exception:
        return False

def clean_body(raw_text):
    lines = [l.rstrip() for l in raw_text.splitlines()]
    cleaned, prev_blank = [], False
    for line in lines:
        is_blank = line.strip() == ""
        if is_blank and prev_blank:
            continue
        cleaned.append(line)
        prev_blank = is_blank
    return "\n".join(cleaned).strip()

def extract_text(soup):
    # Remove nav, footer, scripts
    for tag in soup.select("nav, footer, script, style, [class*='cookie'], [class*='banner'], [id*='nav']"):
        tag.decompose()
    main = soup.find("main") or soup.find("article") or soup.find("div", class_=re.compile(r"content|main|body", re.I)) or soup.body
    return main.get_text(separator="\n") if main else soup.get_text(separator="\n")

def scrape_url(url):
    try:
        resp = requests.get(url, headers=HEADERS, timeout=TIMEOUT, allow_redirects=True)
        if resp.status_code >= 400:
            return None, None, []
        ct = resp.headers.get("Content-Type", "")
        if "text/html" not in ct:
            return None, None, []
        soup = BeautifulSoup(resp.text, "html.parser")
        title = soup.title.get_text(strip=True) if soup.title else url
        body = clean_body(extract_text(soup))
        links = []
        for a in soup.find_all("a", href=True):
            norm = normalise_url(a["href"], url)
            if norm and allowed(norm) and not SKIP_PATTERNS.search(norm):
                links.append(norm)
        return title, body, list(dict.fromkeys(links))
    except Exception as e:
        print(f"  [ERROR] {url}: {e}")
        return None, None, []

def run():
    existing_map = {}
    if PAGE_MAP_FILE.exists():
        try:
            existing_map = json.loads(PAGE_MAP_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    existing_urls = set(existing_map.values())
    print(f"[+] Existing page map: {len(existing_map)} entries")

    content_hashes = set()
    visited = set(existing_urls)
    queue = deque(s for s in SEEDS if s not in visited)
    scraped_count = 0
    page_counts = {}  # per-domain page count to enforce MAX_PAGES

    while queue:
        url = queue.popleft()
        if url in visited:
            continue
        visited.add(url)

        domain = urllib.parse.urlparse(url).netloc.lower()
        if page_counts.get(domain, 0) >= MAX_PAGES:
            print(f"  [LIMIT] Max pages reached for {domain}, skipping {url[:60]}")
            continue

        print(f"\n[{scraped_count+1}] {url[:90]}")
        title, body, child_links = scrape_url(url)

        if not body or len(body.strip()) < MIN_CONTENT:
            print(f"  [SKIP] Too short or empty")
            continue

        content_key = hashlib.sha256(body.encode("utf-8", errors="ignore")).hexdigest()
        if content_key in content_hashes:
            print(f"  [SKIP] Duplicate content")
            continue
        content_hashes.add(content_key)

        header = f"# {title}\n\n> **Source:** {url}\n\n---\n\n"
        full_doc = header + body
        stem = sanitise_filename(title)
        filepath = unique_path(OUTPUT_DIR, stem, ".md")
        filepath.write_text(full_doc, encoding="utf-8")
        existing_map[filepath.name] = url
        page_counts[domain] = page_counts.get(domain, 0) + 1
        scraped_count += 1
        print(f"  [SAVED] {title[:60]} ({round(len(full_doc)/1024,1)} kB) -> {filepath.name}")

        for link in child_links:
            if link not in visited:
                queue.append(link)

        time.sleep(0.3)  # polite crawl delay

    PAGE_MAP_FILE.write_text(json.dumps(existing_map, indent=2), encoding="utf-8")
    print(f"\n✅ Done! Scraped {scraped_count} external pages.")
    print(f"📄 Updated page source map: {PAGE_MAP_FILE}")

if __name__ == "__main__":
    run()
