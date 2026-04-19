"""
University of Roehampton Portal Scraper  (v2 — Full Crawl + Markdown Output)
=============================================================================
Uses Playwright to log into the student portal and crawl EVERY reachable page
on the same domain, saving each as a structured Markdown (.md) file.

Output: .md files saved to  ../pdf files/scraped/
        PDFs saved to       ../pdf files/scraped/pdfs/
        (directly compatible with the MyUni AI Training Studio upload)

Usage:
  python scrape.py                   # Interactive login (browser opens visibly)
  python scrape.py --headless        # Headless — reuses saved session cookies
  python scrape.py --discover        # Print all URLs found, don't save files
  python scrape.py --max-pages 300   # Override page limit (default 300)
"""

import argparse
from collections import deque
import hashlib
import json
import os
import re
import urllib.parse
from pathlib import Path

from dotenv import load_dotenv
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError
from bs4 import BeautifulSoup
import requests

# ─────────────────────────────────────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────────────────────────────────────
load_dotenv()

PORTAL_URL   = os.getenv("PORTAL_URL", "https://portal.roehampton.ac.uk")
USERNAME     = os.getenv("PORTAL_USERNAME", "")
PASSWORD     = os.getenv("PORTAL_PASSWORD", "")

SCRIPT_DIR   = Path(__file__).parent
OUTPUT_DIR   = SCRIPT_DIR.parent / "pdf files" / "scraped"
PDF_SUBDIR   = OUTPUT_DIR / "pdfs"
COOKIES_FILE = SCRIPT_DIR / "session_cookies.json"

# Pages / URL schemes we never want
SKIP_PATTERNS = re.compile(
    r"^javascript:"
    r"|\.(css|js|json|xml|ico|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot|map)(\?|$)"
    r"|/logout|/signout|/sign-out|/log-out"
    r"|/login|/signin"
    r"|/_next|/__nextjs|/api/",
    re.IGNORECASE,
)

MAX_PAGES   = 300
NAV_TIMEOUT = 30_000   # ms per page navigation
MIN_CONTENT = 0        # save everything — SharePoint pages are JS-rendered and often short
NAV_RETRIES = 2
RETRY_BACKOFF_SECONDS = 1.5

# Set dynamically after login (see main())
HOME_DOMAIN      = ""   # e.g. roehamptonprod.sharepoint.com
HOME_PATH_PREFIX = ""   # e.g. /sites/portal  (keeps crawl scoped)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def same_domain(url: str) -> bool:
    """Return True if the URL is on the same portal domain (detected after login)."""
    try:
        parsed = urllib.parse.urlparse(url)
        if parsed.netloc != HOME_DOMAIN:
            return False
        # If we have a path prefix (SharePoint sites), stay within it
        if HOME_PATH_PREFIX and not parsed.path.startswith(HOME_PATH_PREFIX):
            return False
        return True
    except Exception:
        return False


def should_skip(url: str) -> bool:
    return bool(SKIP_PATTERNS.search(url))


def is_pdf_url(url: str) -> bool:
    return url.lower().split("?")[0].endswith(".pdf")


def normalise_url(url: str, base: str) -> str:
    # Reject javascript: and other non-HTTP schemes immediately
    if url.startswith(("javascript:", "mailto:", "tel:", "#", "data:", "void")):
        return ""
    full = urllib.parse.urljoin(base, url)
    # strip fragment & trailing slash (except root)
    full = full.split("#")[0]
    parsed = urllib.parse.urlparse(full)
    # Only allow http/https
    if parsed.scheme not in ("http", "https"):
        return ""
    path = parsed.path.rstrip("/") or "/"
    return urllib.parse.urlunparse(parsed._replace(path=path, fragment=""))


def sanitise_filename(text: str, max_len: int = 90) -> str:
    text = re.sub(r"[^\w\s\-]", "", text)
    text = re.sub(r"\s+", "_", text.strip())
    return text[:max_len] or "page"


def unique_path(directory: Path, stem: str, suffix: str) -> Path:
    path = directory / f"{stem}{suffix}"
    counter = 1
    while path.exists():
        path = directory / f"{stem}_{counter}{suffix}"
        counter += 1
    return path


def fetch_with_retry(page, url: str):
    """Navigate with retry/backoff to reduce transient timeout failures."""
    last_error = None

    for attempt in range(1, NAV_RETRIES + 2):
        try:
            return page.goto(url, timeout=NAV_TIMEOUT)
        except PlaywrightTimeoutError as e:
            last_error = e
            if attempt > NAV_RETRIES:
                break
            wait_s = RETRY_BACKOFF_SECONDS * attempt
            print(f"  ⏰  Timeout (attempt {attempt}/{NAV_RETRIES + 1}): {url} — retrying in {wait_s:.1f}s")
            page.wait_for_timeout(int(wait_s * 1000))
        except Exception as e:
            last_error = e
            if attempt > NAV_RETRIES:
                break
            wait_s = RETRY_BACKOFF_SECONDS * attempt
            print(f"  ⚠️  Nav error (attempt {attempt}/{NAV_RETRIES + 1}): {url} — retrying in {wait_s:.1f}s")
            page.wait_for_timeout(int(wait_s * 1000))

    raise last_error if last_error else RuntimeError(f"Navigation failed for {url}")


def get_page_content(page, current_url: str) -> tuple[str, str]:
    """
    Extract rendered content directly from the live browser DOM.
    Uses page.inner_text() — the only reliable method for SharePoint/JS-rendered pages.
    Returns (title, content_as_markdown_string).
    """
    # Wait for SharePoint main content zone to appear (up to 8s)
    for sel in [
        "div[role='main']",
        "div[class*='CanvasSection']",
        "div[class*='ms-rtestate']",
        "div[class*='zone']",
        "main",
        "article",
    ]:
        try:
            page.wait_for_selector(sel, timeout=5_000)
            break
        except PlaywrightTimeoutError:
            continue

    # Get page title
    try:
        title = page.title() or current_url
    except Exception:
        title = current_url

    # Get ALL visible text from the page as rendered by the browser
    try:
        raw_text = page.inner_text("body", timeout=8_000)
    except Exception:
        raw_text = ""

    # Clean up the raw text into tidy markdown
    lines = [l.rstrip() for l in raw_text.splitlines()]
    # Remove consecutive blank lines
    cleaned: list[str] = []
    prev_blank = False
    for line in lines:
        is_blank = line.strip() == ""
        if is_blank and prev_blank:
            continue
        cleaned.append(line)
        prev_blank = is_blank

    body = "\n".join(cleaned).strip()
    return title, body


# ─────────────────────────────────────────────────────────────────────────────
# Session / Login
# ─────────────────────────────────────────────────────────────────────────────

def save_cookies(context):
    COOKIES_FILE.write_text(json.dumps(context.cookies(), indent=2), encoding="utf-8")
    print(f"💾  Session saved → {COOKIES_FILE.name}")


def load_cookies(context) -> bool:
    if COOKIES_FILE.exists():
        context.add_cookies(json.loads(COOKIES_FILE.read_text(encoding="utf-8")))
        return True
    return False


def do_login(page, headless: bool):
    print(f"\n🔐  Opening portal: {PORTAL_URL}")
    page.goto(PORTAL_URL, timeout=NAV_TIMEOUT)

    if USERNAME and PASSWORD:
        for sel in ["#username", "input[name='username']", "input[type='email']",
                    "input[name='j_username']"]:
            try:
                page.fill(sel, USERNAME, timeout=2_000); break
            except Exception:
                pass
        for sel in ["#password", "input[name='password']",
                    "input[type='password']", "input[name='j_password']"]:
            try:
                page.fill(sel, PASSWORD, timeout=2_000); break
            except Exception:
                pass
        for sel in ["button[type='submit']", "input[type='submit']",
                    "#login-btn", "button:has-text('Sign in')",
                    "button:has-text('Log in')"]:
            try:
                page.click(sel, timeout=2_000); break
            except Exception:
                pass

    if not headless:
        print("\n⚠️  Browser is open — log in manually if needed.")
        print("   Once you're inside the portal, come back here and press ENTER.\n")
        input(">> Press ENTER when fully logged in... ")
    else:
        try:
            page.wait_for_load_state("networkidle", timeout=15_000)
        except PlaywrightTimeoutError:
            pass

    print("✅  Login done.\n")


# ─────────────────────────────────────────────────────────────────────────────
# PDF download
# ─────────────────────────────────────────────────────────────────────────────

def download_pdf(page, url: str):
    PDF_SUBDIR.mkdir(parents=True, exist_ok=True)
    stem = sanitise_filename(urllib.parse.unquote(url.split("/")[-1]).replace(".pdf", ""))
    pdf_path = unique_path(PDF_SUBDIR, stem, ".pdf")
    try:
        with page.expect_download(timeout=30_000) as dl_info:
            fetch_with_retry(page, url)
        dl_info.value.save_as(str(pdf_path))
        print(f"  📄  PDF → {pdf_path.name}")
    except Exception:
        # Try plain requests download as fallback
        try:
            cookies = {c["name"]: c["value"] for c in page.context.cookies()}
            response = requests.get(url, cookies=cookies, timeout=30)
            response.raise_for_status()
            content_type = (response.headers.get("content-type") or "").lower()
            content = response.content

            # Guard against login HTML accidentally saved as .pdf
            looks_like_pdf = content.startswith(b"%PDF-") or "application/pdf" in content_type
            if not looks_like_pdf:
                raise RuntimeError(f"Fallback response is not a PDF (content-type={content_type or 'unknown'})")

            pdf_path.write_bytes(content)
            print(f"  📄  PDF (fallback) → {pdf_path.name}")
        except Exception as e2:
            print(f"  ⚠️  PDF failed: {url} — {e2}")


# ─────────────────────────────────────────────────────────────────────────────
# Crawler
# ─────────────────────────────────────────────────────────────────────────────

def crawl(page, seed_urls: list, discover_only: bool):
    visited:   set = set()
    queued:    set = set(dict.fromkeys(seed_urls))
    to_visit = deque(dict.fromkeys(seed_urls))
    pdf_queue: list = []
    content_hashes: set[str] = set()
    scraped = 0
    skipped_duplicate_content = 0
    nav_failures = 0

    print(f"🕷️  Crawling — max {MAX_PAGES} pages, seeds: {len(to_visit)}\n")

    while to_visit and scraped < MAX_PAGES:
        url = to_visit.popleft()
        queued.discard(url)
        if url in visited:
            continue
        visited.add(url)

        if should_skip(url):
            continue
        if is_pdf_url(url):
            pdf_queue.append(url)
            continue
        if not same_domain(url):
            continue

        # Navigate
        try:
            response = fetch_with_retry(page, url)
        except Exception as e:
            nav_failures += 1
            print(f"  ❌  Error: {url} — {e}")
            continue

        # Wait for JS to finish rendering (SharePoint/Nest is JS-heavy)
        # Ignore networkidle timeout — partial loads are still useful
        try:
            page.wait_for_load_state("networkidle", timeout=12_000)
        except PlaywrightTimeoutError:
            pass

        # Skip non-HTML responses
        if response and response.headers.get("content-type", "").startswith("application/pdf"):
            pdf_queue.append(url)
            continue

        current_url = page.url
        if current_url != url:
            visited.add(current_url)

        html = page.content()

        # Collect links via JavaScript (more reliable on dynamic/JS-rendered portals)
        try:
            js_hrefs = page.evaluate("""
                () => Array.from(document.querySelectorAll('a[href]'))
                           .map(a => a.getAttribute('href'))
            """)
        except Exception:
            js_hrefs = []

        # Also parse HTML with BeautifulSoup as fallback
        soup = BeautifulSoup(html, "html.parser")
        bs_hrefs = [a.get("href", "") for a in soup.find_all("a", href=True)]

        all_hrefs = list(dict.fromkeys(js_hrefs + bs_hrefs))  # deduplicated, JS-first

        for href in all_hrefs:
            if not href:
                continue
            norm = normalise_url(href.strip(), current_url)
            if not norm or norm in visited or norm in queued:
                continue
            if is_pdf_url(norm):
                pdf_queue.append(norm)
            elif same_domain(norm) and not should_skip(norm):
                to_visit.append(norm)
                queued.add(norm)

        # Convert to Markdown using live DOM text
        title, body = get_page_content(page, current_url)

        if discover_only:
            print(f"  🔍  {current_url}  |  {title[:60]}")
            scraped += 1
            continue

        # Build the Markdown document
        header = (
            f"# {title}\n\n"
            f"> **Source:** {current_url}\n\n"
            f"---\n\n"
        )
        full_doc = header + body

        # Skip duplicate content to reduce noisy retraining data.
        content_key = hashlib.sha256(body.encode("utf-8", errors="ignore")).hexdigest()
        if content_key in content_hashes:
            skipped_duplicate_content += 1
            print(f"  ↪️  Duplicate content skipped: {title[:60]}")
            continue
        content_hashes.add(content_key)

        if len(body.strip()) < MIN_CONTENT:
            print(f"  ↪️  Too short skipped ({len(body.strip())} chars): {title[:60]}")
            continue

        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        stem = sanitise_filename(title)
        filepath = unique_path(OUTPUT_DIR, stem, ".md")
        filepath.write_text(full_doc, encoding="utf-8")
        scraped += 1
        size_kb = round(len(full_doc) / 1024, 1)
        print(f"  [{scraped}/{MAX_PAGES}] {title[:60]}  ({size_kb} kB)")

    # Download PDFs
    if not discover_only and pdf_queue:
        deduped_pdfs = list(dict.fromkeys(pdf_queue))
        print(f"\n📄  Downloading {len(deduped_pdfs)} PDF(s)…")
        for pdf_url in deduped_pdfs:
            download_pdf(page, pdf_url)

    return {
        "pages_scraped": scraped,
        "pdfs_queued": len(pdf_queue),
        "visited_urls": len(visited),
        "nav_failures": nav_failures,
        "duplicate_skips": skipped_duplicate_content,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────────────────────

def main():
    global MAX_PAGES, MIN_CONTENT
    parser = argparse.ArgumentParser(description="Roehampton Portal Scraper v2")
    parser.add_argument("--headless",   action="store_true",
                        help="Headless mode (requires saved session cookies)")
    parser.add_argument("--discover",   action="store_true",
                        help="Print discovered URLs only — do not save files")
    parser.add_argument("--max-pages",  type=int, default=MAX_PAGES,
                        help=f"Maximum pages to scrape (default: {MAX_PAGES})")
    parser.add_argument("--min-content", type=int, default=MIN_CONTENT,
                        help="Skip saving pages with body text shorter than this many chars (default: 0)")
    args = parser.parse_args()
    MAX_PAGES = args.max_pages
    MIN_CONTENT = max(0, args.min_content)

    with sync_playwright() as pw:
        browser = pw.chromium.launch(
            headless=args.headless,
            slow_mo=0,
        )
        context = browser.new_context(
            viewport={"width": 1280, "height": 900},
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0 Safari/537.36"
            ),
        )

        had_cookies = load_cookies(context)
        page = context.new_page()

        if not had_cookies or not args.headless:
            do_login(page, headless=args.headless)
            save_cookies(context)
        else:
            # In headless cookie-reuse mode we still need an explicit navigation;
            # otherwise the new page remains about:blank.
            print(f"\n🔁  Reusing saved session cookies. Opening portal: {PORTAL_URL}")
            try:
                fetch_with_retry(page, PORTAL_URL)
                try:
                    page.wait_for_load_state("networkidle", timeout=12_000)
                except PlaywrightTimeoutError:
                    pass
            except Exception as e:
                print(f"  ⚠️  Could not open portal in headless mode: {e}")

        # After login the user is already on the portal home page.
        # Detect the real domain (may differ from PORTAL_URL due to SSO redirect).
        home_url = page.url
        parsed_home = urllib.parse.urlparse(home_url)

        global HOME_DOMAIN, HOME_PATH_PREFIX
        HOME_DOMAIN = parsed_home.netloc

        # For SharePoint portals, scope the crawl to /sites/<name> prefix
        path_parts = [p for p in parsed_home.path.split("/") if p]
        if "sites" in path_parts:
            site_idx = path_parts.index("sites")
            HOME_PATH_PREFIX = "/" + "/".join(path_parts[: site_idx + 2])
        else:
            HOME_PATH_PREFIX = ""

        print(f"\nℹ️   Starting crawl from: {home_url}")
        print(f"ℹ️   Domain: {HOME_DOMAIN}  Path prefix: {HOME_PATH_PREFIX or '(none)'}")

        # Seed the queue with links already visible on the post-login page
        try:
            initial_hrefs = page.evaluate("""
                () => Array.from(document.querySelectorAll('a[href]'))
                           .map(a => a.getAttribute('href'))
            """)
        except Exception:
            initial_hrefs = []

        from bs4 import BeautifulSoup as _BS
        initial_html = page.content()
        bs_hrefs = [a.get("href", "") for a in _BS(initial_html, "html.parser").find_all("a", href=True)]
        all_initial = list(dict.fromkeys(initial_hrefs + bs_hrefs))
        print(f"ℹ️   Discovered {len(all_initial)} links on the home page.\n")

        # Build seed list: home URL first, then discovered child URLs
        seeds = [home_url]
        for href in all_initial:
            if not href:
                continue
            norm = normalise_url(href.strip(), home_url)
            if norm and norm != home_url and same_domain(norm) and not should_skip(norm):
                seeds.append(norm)

        print(f"ℹ️   Seeds after domain filter: {len(seeds)}\n")
        stats = crawl(page, seeds, discover_only=args.discover)

        save_cookies(context)
        browser.close()

    if args.discover:
        print(f"\n📋  Found {stats['pages_scraped']} pages + {stats['pdfs_queued']} PDFs to download.")
    else:
        print(f"\n🎉  Done!  {stats['pages_scraped']} pages + {stats['pdfs_queued']} PDFs.")
        print(
            f"ℹ️   Crawl stats: visited={stats['visited_urls']} nav_failures={stats['nav_failures']} duplicate_skips={stats['duplicate_skips']}"
        )
        print(f"📁  Markdown files: {OUTPUT_DIR}")
        print(f"📁  PDF files:      {PDF_SUBDIR}")
        print(f"\n👉  Upload the files via MyUni Admin → AI Training Studio → Incremental Add")


if __name__ == "__main__":
    main()
