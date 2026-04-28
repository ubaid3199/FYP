"""
Targeted scraper for isolated SharePoint sub-sections.
Navigates directly to each URL, saves the page, then follows all links found on that page.
Merges results into the existing _page_source_map.json.
"""
import json, os, re, sys, time, urllib.parse, hashlib
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError
from bs4 import BeautifulSoup

sys.stdout.reconfigure(encoding='utf-8')

SCRIPT_DIR   = Path(__file__).parent
OUTPUT_DIR   = SCRIPT_DIR.parent / "pdf files" / "scraped"
PAGE_MAP_FILE = OUTPUT_DIR / "_page_source_map.json"
COOKIES_FILE  = SCRIPT_DIR / "session_cookies.json"
NAV_TIMEOUT   = 90_000
MIN_CONTENT   = 150

# The isolated sections - navigate directly to each and crawl children
TARGET_SECTIONS = [
    "https://roehamptonprod.sharepoint.com/sites/portal/nest/studentservices/Pages/default.aspx",
    "https://roehamptonprod.sharepoint.com/sites/portal/nest/library/Pages/default.aspx",
    "https://roehamptonprod.sharepoint.com/sites/portal/nest/campus/Pages/default.aspx",
    "https://roehamptonprod.sharepoint.com/sites/portal/nest/it/Pages/default.aspx",
    "https://roehamptonprod.sharepoint.com/sites/portal/information/Pages/default.aspx",
    "https://roehamptonprod.sharepoint.com/sites/portal/information/academic/Pages/default.aspx",
    "https://roehamptonprod.sharepoint.com/sites/portal/information/examinations/Pages/default.aspx",
]

SKIP_PATTERNS = re.compile(
    r"^javascript:|\.css$|\.js$|/logout|/signout|/login|/signin|/_next|/api/"
    r"|/newsandevents/Pages/read|/newsandevents/Pages/events"
    r"|/_layouts/|\.pdf$|\.docx$|\.doc$",
    re.IGNORECASE,
)

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

def get_page_links(page, current_url):
    try:
        js_hrefs = page.evaluate("""
            () => Array.from(document.querySelectorAll('a[href]')).map(a => a.getAttribute('href'))
        """)
    except Exception:
        js_hrefs = []
    soup = BeautifulSoup(page.content(), "html.parser")
    bs_hrefs = [a.get("href", "") for a in soup.find_all("a", href=True)]
    all_hrefs = list(dict.fromkeys(js_hrefs + bs_hrefs))
    links = []
    for href in all_hrefs:
        if not href:
            continue
        full = urllib.parse.urljoin(current_url, href).split("#")[0]
        parsed = urllib.parse.urlparse(full)
        if parsed.scheme not in ("http", "https"):
            continue
        path = parsed.path.rstrip("/") or "/"
        norm = urllib.parse.urlunparse(parsed._replace(path=path, fragment=""))
        if "roehamptonprod.sharepoint.com/sites/portal" in norm and not SKIP_PATTERNS.search(norm):
            links.append(norm)
    return list(dict.fromkeys(links))

def scrape_page(page, url):
    try:
        resp = page.goto(url, timeout=NAV_TIMEOUT)
        if resp and resp.status >= 400:
            print(f"  [SKIP] HTTP {resp.status}: {url}")
            return None, None, []
        try:
            page.wait_for_load_state("networkidle", timeout=8_000)
            page.wait_for_timeout(1500)
        except PlaywrightTimeoutError:
            pass
        current_url = page.url
        title = page.title() or current_url
        raw_text = page.inner_text("body", timeout=15_000)
        body = clean_body(raw_text)
        links = get_page_links(page, current_url)
        return title, body, links
    except Exception as e:
        print(f"  [ERROR] {url}: {e}")
        return None, None, []

def run():
    # Load existing page source map
    existing_map = {}
    if PAGE_MAP_FILE.exists():
        try:
            existing_map = json.loads(PAGE_MAP_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    existing_urls = set(existing_map.values())
    print(f"[+] Existing page map: {len(existing_map)} entries")

    content_hashes = set()
    new_entries = 0

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, slow_mo=0)
        context = browser.new_context(
            viewport={"width": 1280, "height": 900},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36"
        )
        # Load saved session cookies
        if COOKIES_FILE.exists():
            context.add_cookies(json.loads(COOKIES_FILE.read_text(encoding="utf-8")))
            print(f"[+] Session cookies loaded")
        else:
            print("[!] No session cookies found - run main scraper first to log in")
            return

        page = context.new_page()
        visited = set(existing_urls)
        queue = list(TARGET_SECTIONS)

        while queue:
            url = queue.pop(0)
            if url in visited:
                continue
            visited.add(url)

            print(f"\n[>] Scraping: {url}")
            title, body, child_links = scrape_page(page, url)
            current_url = page.url  # may differ after redirect

            if not body or len(body.strip()) < MIN_CONTENT:
                print(f"  [SKIP] Too short or empty")
                continue

            # Dedup by content hash
            content_key = hashlib.sha256(body.encode("utf-8", errors="ignore")).hexdigest()
            if content_key in content_hashes:
                print(f"  [SKIP] Duplicate content")
                continue
            content_hashes.add(content_key)

            # Save markdown file
            header = f"# {title}\n\n> **Source:** {current_url}\n\n---\n\n"
            full_doc = header + body
            OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
            stem = sanitise_filename(title)
            filepath = unique_path(OUTPUT_DIR, stem, ".md")
            filepath.write_text(full_doc, encoding="utf-8")
            existing_map[filepath.name] = current_url
            new_entries += 1
            size_kb = round(len(full_doc) / 1024, 1)
            print(f"  [SAVED] {title[:60]} ({size_kb} kB) -> {filepath.name}")

            # Queue same-section child links
            for link in child_links:
                if link not in visited and link not in queue:
                    queue.append(link)

        browser.close()

    # Save updated page source map
    PAGE_MAP_FILE.write_text(json.dumps(existing_map, indent=2), encoding="utf-8")
    print(f"\n✅ Done! Saved {new_entries} new pages.")
    print(f"📄 Updated page source map: {PAGE_MAP_FILE}")

if __name__ == "__main__":
    run()
