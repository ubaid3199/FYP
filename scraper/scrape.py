"""
University of Roehampton Portal Scraper  (v2   Full Crawl + Markdown Output)
=============================================================================
Uses Playwright to log into the student portal and crawl EVERY reachable page
on the same domain, saving each as a structured Markdown (.md) file.

Output: .md files saved to  ../pdf files/scraped/
        PDFs saved to       ../pdf files/scraped/pdfs/
        (directly compatible with the MyUni AI Training Studio upload)

Usage:
  python scrape.py                   # Interactive login (browser opens visibly)
  python scrape.py --headless        # Headless   reuses saved session cookies
  python scrape.py --discover        # Print all URLs found, don't save files
  python scrape.py --max-pages 300   # Override page limit (default 300)
    python scrape.py --output-dir scraped_2026_04_21  # Write to ../pdf files/scraped_2026_04_21
    python scrape.py --seed-url "https://..." --seed-url "https://..."
    python scrape.py --seed-file extra_links.txt
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

#                                                                              
# Config
#                                                                              
load_dotenv()

PORTAL_URL   = os.getenv("PORTAL_URL", "https://portal.roehampton.ac.uk")
USERNAME     = os.getenv("PORTAL_USERNAME", "")
PASSWORD     = os.getenv("PORTAL_PASSWORD", "")

SCRIPT_DIR   = Path(__file__).parent
PDF_FILES_ROOT = SCRIPT_DIR.parent / "pdf files"
OUTPUT_DIR   = PDF_FILES_ROOT / os.getenv("SCRAPED_DOCS_DIR", "scraped")
PDF_SUBDIR   = OUTPUT_DIR / "pdfs"
PDF_SOURCE_MAP_FILE = PDF_SUBDIR / "_source_map.json"
DOC_SUBDIR   = OUTPUT_DIR / "docs"
DOC_SOURCE_MAP_FILE = DOC_SUBDIR / "_source_map.json"
PAGE_SOURCE_MAP_FILE = OUTPUT_DIR / "_page_source_map.json"
COOKIES_FILE = SCRIPT_DIR / "session_cookies.json"

# Pages / URL schemes we never want
SKIP_PATTERNS = re.compile(
    r"^javascript:"
    r"|\.(css|js|json|xml|ico|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot|map)(\?|$)"
    r"|/logout|/signout|/sign-out|/log-out"
    r"|/login|/signin"
    r"|/_next|/__nextjs|/api/"
    r"|PageNotFoundError\.aspx|AccessDenied\.aspx|error\.aspx",
    re.IGNORECASE,
)

AUTH_PAGE_PATTERNS = re.compile(
    r"sts\.roehampton\.ac\.uk"
    r"|/adfs/"
    r"|/login"
    r"|/signin"
    r"|wa=wsignin1\.0"
    r"|wtrealm=",
    re.IGNORECASE,
)

MAX_PAGES   = 300
NAV_TIMEOUT = 30_000   # ms per page navigation
MIN_CONTENT = 0        # save everything   SharePoint pages are JS-rendered and often short
NAV_RETRIES = 2
RETRY_BACKOFF_SECONDS = 1.5

# Set dynamically after login (see main())
HOME_DOMAIN      = ""   # e.g. roehamptonprod.sharepoint.com
HOME_PATH_PREFIX = ""   # e.g. /sites/portal  (keeps crawl scoped)
EXTRA_ALLOWED_DOMAINS: set[str] = {"www.roehampton.ac.uk"}

MOODLE_BLOCK_HOSTS: set[str] = {
    "moodle.roehampton.ac.uk",
    "partnerships.moodle.roehampton.ac.uk",
}


def configure_output_paths(output_dir_value: str):
    """Set output paths globally so scraping and map writes stay in one folder."""
    global OUTPUT_DIR, PDF_SUBDIR, PDF_SOURCE_MAP_FILE, DOC_SUBDIR, DOC_SOURCE_MAP_FILE, PAGE_SOURCE_MAP_FILE

    cleaned = (output_dir_value or "scraped").strip()
    target = Path(cleaned)
    if not target.is_absolute():
        target = (PDF_FILES_ROOT / target).resolve()

    OUTPUT_DIR = target
    PDF_SUBDIR = OUTPUT_DIR / "pdfs"
    PDF_SOURCE_MAP_FILE = PDF_SUBDIR / "_source_map.json"
    DOC_SUBDIR = OUTPUT_DIR / "docs"
    DOC_SOURCE_MAP_FILE = DOC_SUBDIR / "_source_map.json"
    PAGE_SOURCE_MAP_FILE = OUTPUT_DIR / "_page_source_map.json"


#                                                                              
# Helpers
#                                                                              

def same_domain(url: str) -> bool:
    """Return True if URL is on the portal domain or an explicitly allowed extra domain."""
    try:
        parsed = urllib.parse.urlparse(url)
        host = parsed.netloc

        if is_moodle_url(url):
            return False

        if host == HOME_DOMAIN:
            # If we have a path prefix (SharePoint sites), stay within it
            if HOME_PATH_PREFIX and not parsed.path.startswith(HOME_PATH_PREFIX):
                return False
            return True

        if host in EXTRA_ALLOWED_DOMAINS:
            return True

        return False
    except Exception:
        return False


def is_moodle_url(url: str) -> bool:
    """Block Moodle everywhere (including Safe Links unwrapped targets)."""
    try:
        parsed = urllib.parse.urlparse((url or "").strip())
        host = (parsed.netloc or "").lower()
        if not host:
            return False
        if host in MOODLE_BLOCK_HOSTS:
            return True
        # Broad block: any host containing 'moodle'
        if "moodle" in host:
            return True
        return False
    except Exception:
        return False


def unwrap_safelinks_url(url: str) -> str:
    """Decode Outlook Safe Links wrappers to the original target URL when possible."""
    value = (url or "").strip()
    if not value:
        return ""

    try:
        parsed = urllib.parse.urlparse(value)
        if "safelinks.protection.outlook.com" not in parsed.netloc.lower():
            return value

        params = urllib.parse.parse_qs(parsed.query)
        target_values = params.get("url")
        if not target_values:
            return ""
        return urllib.parse.unquote(target_values[0])
    except Exception:
        return value


def parse_seed_url_values(raw_values: list[str]) -> list[str]:
    """Accept comma/newline separated values and unwrap safelinks."""
    parsed: list[str] = []
    for raw in raw_values:
        if not raw:
            continue
        for part in re.split(r"[\r\n,]+", raw):
            item = unwrap_safelinks_url(part.strip())
            if item:
                parsed.append(item)
    return parsed


def should_skip(url: str) -> bool:
    return bool(SKIP_PATTERNS.search(url))


def is_auth_or_login_url(url: str) -> bool:
    return bool(AUTH_PAGE_PATTERNS.search(url))


def is_pdf_url(url: str) -> bool:
    return url.lower().split("?")[0].endswith(".pdf")


def is_docx_url(url: str) -> bool:
    return url.lower().split("?")[0].endswith(".docx")


def is_legacy_doc_url(url: str) -> bool:
    return url.lower().split("?")[0].endswith(".doc")


def looks_like_not_found_page(url: str, title: str, body: str) -> bool:
    """Detect common 404/not-found pages so they are not saved to corpus."""
    haystack = " ".join([
        (url or "").lower(),
        (title or "").lower(),
        (body or "").lower(),
    ])
    markers = [
        "page not found",
        "404",
        "we can't find that page",
        "we can't seem to find the page",
        "file not found",
        "this page does not exist",
        "sorry, this page",
        "the resource you are looking for",
        "something went wrong",
        "error has occurred",
        "access denied",
        "you don't have access",
    ]
    return any(marker in haystack for marker in markers)


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
            print(f"  [Timeout] (attempt {attempt}/{NAV_RETRIES + 1}): {url} - retrying in {wait_s:.1f}s")
            page.wait_for_timeout(int(wait_s * 1000))
        except Exception as e:
            last_error = e
            if attempt > NAV_RETRIES:
                break
            wait_s = RETRY_BACKOFF_SECONDS * attempt
            print(f"  [Error] (attempt {attempt}/{NAV_RETRIES + 1}): {url} - retrying in {wait_s:.1f}s")
            page.wait_for_timeout(int(wait_s * 1000))

    raise last_error if last_error else RuntimeError(f"Navigation failed for {url}")


def get_page_content(page, current_url: str) -> tuple[str, str]:
    """
    Extract rendered content directly from the live browser DOM.
    Uses page.inner_text()   the only reliable method for SharePoint/JS-rendered pages.
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


def normalize_links(hrefs: list[str], base_url: str) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for href in hrefs:
        if not href:
            continue
        norm = normalise_url(href.strip(), base_url)
        if not norm:
            continue
        if is_moodle_url(norm):
            continue
        if is_auth_or_login_url(norm):
            continue
        if norm in seen:
            continue
        seen.add(norm)
        normalized.append(norm)
    return normalized


def extract_page_links_and_forms(page, current_url: str, soup: BeautifulSoup) -> tuple[list[str], list[str]]:
    """Extract normalized links and form actions for richer retrieval context."""
    try:
        js_hrefs = page.evaluate(
            """
            () => Array.from(document.querySelectorAll('a[href]'))
              .map(a => a.getAttribute('href') || '')
            """
        )
    except Exception:
        js_hrefs = []

    bs_hrefs = [a.get("href", "") for a in soup.find_all("a", href=True)]
    links = normalize_links(js_hrefs + bs_hrefs, current_url)

    form_actions = [form.get("action", "") for form in soup.find_all("form")]
    forms = normalize_links(form_actions, current_url)

    # Exclude links already present in forms list to avoid duplicate noise.
    forms_set = set(forms)
    links = [link for link in links if link not in forms_set]
    return links, forms


def build_links_forms_section(links: list[str], forms: list[str], max_links: int = 80, max_forms: int = 30) -> str:
    parts: list[str] = []

    if links:
        link_lines = [f"- {item}" for item in links[:max_links]]
        parts.append("## Links on this page\n" + "\n".join(link_lines))

    if forms:
        form_lines = [f"- {item}" for item in forms[:max_forms]]
        parts.append("## Forms on this page\n" + "\n".join(form_lines))

    return "\n\n".join(parts).strip()


def load_seed_urls_from_file(file_path: str) -> list[str]:
    seed_urls: list[str] = []
    if not file_path:
        return seed_urls

    path_obj = Path(file_path)
    if not path_obj.is_absolute():
        path_obj = (SCRIPT_DIR / path_obj).resolve()

    if not path_obj.exists():
        print(f"      Seed file not found: {path_obj}")
        return seed_urls

    try:
        lines = path_obj.read_text(encoding="utf-8", errors="ignore").splitlines()
        for line in lines:
            candidate = line.strip()
            if candidate and not candidate.startswith("#"):
                seed_urls.extend(parse_seed_url_values([candidate]))
    except Exception as e:
        print(f"      Could not read seed file {path_obj}: {e}")

    return seed_urls


#                                                                              
# Session / Login
#                                                                              

def save_cookies(context):
    COOKIES_FILE.write_text(json.dumps(context.cookies(), indent=2), encoding="utf-8")
    print(f"[DISK] Session saved -> {COOKIES_FILE.name}")


def load_cookies(context) -> bool:
    if COOKIES_FILE.exists():
        context.add_cookies(json.loads(COOKIES_FILE.read_text(encoding="utf-8")))
        return True
    return False


def do_login(page, headless: bool):
    print(f"\n[LOGIN] Opening portal: {PORTAL_URL}")
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
        print("\n[WARNING] Browser is open - log in manually if needed.")
        print("   Once you're inside the portal, come back here and press ENTER.\n")
        input(">> Press ENTER when fully logged in... ")
    else:
        try:
            page.wait_for_load_state("networkidle", timeout=15_000)
        except PlaywrightTimeoutError:
            pass

    print("[OK] Login done.\n")


#                                                                              
# PDF download
#                                                                              

def download_pdf(page, url: str, source_map: dict[str, str]):
    if is_moodle_url(url):
        print(f"      PDF blocked (Moodle): {url}")
        return
    PDF_SUBDIR.mkdir(parents=True, exist_ok=True)
    stem = sanitise_filename(urllib.parse.unquote(url.split("/")[-1]).replace(".pdf", ""))
    pdf_path = unique_path(PDF_SUBDIR, stem, ".pdf")
    try:
        with page.expect_download(timeout=30_000) as dl_info:
            response = fetch_with_retry(page, url)

        try:
            status_code = response.status if response else None
            if status_code and status_code >= 400:
                print(f"      PDF skipped (HTTP {status_code}): {url}")
                return
        except Exception:
            pass
        dl_info.value.save_as(str(pdf_path))
        rel_pdf_path = pdf_path.relative_to(OUTPUT_DIR).as_posix()
        source_map[rel_pdf_path] = url
        print(f"     PDF   {pdf_path.name}")
    except Exception:
        # Try plain requests download as fallback
        try:
            cookies = {c["name"]: c["value"] for c in page.context.cookies()}
            candidate_urls = [url]

            # SharePoint web-view links often need download=1 to return binary PDF.
            if "sharepoint.com" in url and ".pdf" in url.lower():
                joiner = "&" if "?" in url else "?"
                candidate_urls.append(f"{url}{joiner}download=1")

            response = None
            content = b""
            content_type = ""
            for candidate in candidate_urls:
                response = requests.get(candidate, cookies=cookies, timeout=30)
                response.raise_for_status()
                content_type = (response.headers.get("content-type") or "").lower()
                content = response.content
                looks_like_pdf = content.startswith(b"%PDF-") or "application/pdf" in content_type
                if looks_like_pdf:
                    break

            # Guard against login HTML accidentally saved as .pdf
            looks_like_pdf = content.startswith(b"%PDF-") or "application/pdf" in content_type
            if not looks_like_pdf:
                raise RuntimeError(f"Fallback response is not a PDF (content-type={content_type or 'unknown'})")

            pdf_path.write_bytes(content)
            rel_pdf_path = pdf_path.relative_to(OUTPUT_DIR).as_posix()
            source_map[rel_pdf_path] = url
            print(f"     PDF (fallback)   {pdf_path.name}")
        except Exception as e2:
            print(f"      PDF failed: {url}   {e2}")


def download_docx(page, url: str, source_map: dict[str, str]):
    """Download DOCX forms/docs (use requests fallback with cookies)."""
    if is_moodle_url(url):
        print(f"      DOCX blocked (Moodle): {url}")
        return

    if not is_docx_url(url):
        return

    DOC_SUBDIR.mkdir(parents=True, exist_ok=True)
    stem = sanitise_filename(urllib.parse.unquote(url.split("/")[-1]).replace(".docx", ""))
    doc_path = unique_path(DOC_SUBDIR, stem, ".docx")

    # Prefer direct requests download to avoid Playwright "Download is starting" navigation errors.
    try:
        cookies = {c["name"]: c["value"] for c in page.context.cookies()}
        response = requests.get(url, cookies=cookies, timeout=60)
        response.raise_for_status()

        content_type = (response.headers.get("content-type") or "").lower()
        # Some servers may not provide a perfect content-type; accept docx by extension.
        if "text/html" in content_type and response.text.lstrip().lower().startswith("<!doctype"):
            raise RuntimeError("DOCX download returned HTML (likely blocked/redirect)")

        doc_path.write_bytes(response.content)
        rel_doc_path = doc_path.relative_to(OUTPUT_DIR).as_posix()
        source_map[rel_doc_path] = url
        print(f"     DOCX  {doc_path.name}")
    except Exception as e:
        print(f"      DOCX failed: {url}   {e}")


def load_existing_pdf_source_map() -> dict[str, str]:
    """Load previously saved PDF source map so incremental crawls keep old mappings."""
    if not PDF_SOURCE_MAP_FILE.exists():
        return {}
    try:
        raw = PDF_SOURCE_MAP_FILE.read_text(encoding="utf-8")
        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            # Keep only string-to-string entries to avoid malformed rows.
            return {str(k): str(v) for k, v in parsed.items() if isinstance(k, str) and isinstance(v, str)}
    except Exception:
        pass
    return {}


def load_existing_doc_source_map() -> dict[str, str]:
    """Load previously saved DOCX source map so incremental crawls keep old mappings."""
    if not DOC_SOURCE_MAP_FILE.exists():
        return {}
    try:
        raw = DOC_SOURCE_MAP_FILE.read_text(encoding="utf-8")
        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            return {str(k): str(v) for k, v in parsed.items() if isinstance(k, str) and isinstance(v, str)}
    except Exception:
        pass
    return {}


def load_existing_page_source_map() -> dict[str, str]:
    """Load previously saved page source map so incremental crawls keep old mappings."""
    if not PAGE_SOURCE_MAP_FILE.exists():
        return {}
    try:
        raw = PAGE_SOURCE_MAP_FILE.read_text(encoding="utf-8")
        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            return {str(k): str(v) for k, v in parsed.items() if isinstance(k, str) and isinstance(v, str)}
    except Exception:
        pass
    return {}


def build_page_source_map_from_markdown_files() -> dict[str, str]:
    """Rebuild page map from markdown headers to preserve page URL provenance."""
    page_map: dict[str, str] = {}
    if not OUTPUT_DIR.exists():
        return page_map

    for md_file in OUTPUT_DIR.rglob("*.md"):
        if md_file.parent == PDF_SUBDIR:
            continue
        try:
            text = md_file.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue

        match = re.search(r"^>\s*\*\*Source:\*\*\s*(https?://\S+)", text, re.IGNORECASE | re.MULTILINE)
        if not match:
            continue

        url = match.group(1).strip()
        if not url or is_auth_or_login_url(url):
            continue

        rel_md_path = md_file.relative_to(OUTPUT_DIR).as_posix()
        page_map[rel_md_path] = url

    return page_map


#                                                                              
# Crawler
#                                                                              

def crawl(page, seed_urls: list, discover_only: bool):
    visited:   set = set()
    queued:    set = set(dict.fromkeys(seed_urls))
    to_visit = deque(dict.fromkeys(seed_urls))
    pdf_queue: list = []
    pdf_source_map: dict[str, str] = load_existing_pdf_source_map()
    docx_queue: list = []
    docx_source_map: dict[str, str] = load_existing_doc_source_map()
    page_source_map: dict[str, str] = load_existing_page_source_map()
    content_hashes: set[str] = set()
    scraped = 0
    skipped_duplicate_content = 0
    nav_failures = 0

    max_label = "unlimited" if MAX_PAGES <= 0 else str(MAX_PAGES)
    print(f"[CRAWL] Crawling - max {max_label} pages, seeds: {len(to_visit)}\n")

    while to_visit and (MAX_PAGES <= 0 or scraped < MAX_PAGES):
        url = to_visit.popleft()
        queued.discard(url)
        if url in visited:
            continue
        visited.add(url)

        if is_moodle_url(url):
            continue

        if should_skip(url):
            continue
        if is_pdf_url(url):
            if not is_moodle_url(url):
                pdf_queue.append(url)
            continue
        if is_docx_url(url):
            docx_queue.append(url)
            continue
        if is_legacy_doc_url(url):
            # Skip legacy .doc files (ingestion doesn't parse them reliably and they cause navigation download errors).
            continue
        if not same_domain(url):
            continue

        # Navigate
        try:
            response = fetch_with_retry(page, url)
        except Exception as e:
            nav_failures += 1
            print(f"     Error: {url}   {e}")
            continue

        # Wait for JS to finish rendering (SharePoint/Nest is JS-heavy)
        # Ignore networkidle timeout   partial loads are still useful
        try:
            page.wait_for_load_state("networkidle", timeout=12_000)
        except PlaywrightTimeoutError:
            pass

        # Skip HTTP error pages and move on.
        try:
            status_code = response.status if response else None
            if status_code and status_code >= 400:
                print(f"  [SKIP] HTTP error skipped ({status_code}): {url}")
                continue
        except Exception:
            pass

        # Skip non-HTML responses
        if response and response.headers.get("content-type", "").startswith("application/pdf"):
            pdf_queue.append(url)
            continue

        current_url = page.url
        if current_url != url:
            visited.add(current_url)

        if is_moodle_url(current_url):
            print(f"  [SKIP] Moodle blocked: {current_url}")
            continue

        if should_skip(current_url) or is_auth_or_login_url(current_url):
            print(f"  [SKIP] Auth/login/error page skipped: {current_url}")
            continue

        html = page.content()

        # Also parse HTML with BeautifulSoup as fallback
        soup = BeautifulSoup(html, "html.parser")
        page_links, page_forms = extract_page_links_and_forms(page, current_url, soup)

        all_hrefs = list(dict.fromkeys(page_links + page_forms))

        for href in all_hrefs:
            if not href:
                continue
            norm = normalise_url(href.strip(), current_url)
            if not norm or norm in visited or norm in queued:
                continue
            if is_moodle_url(norm):
                continue
            if is_auth_or_login_url(norm):
                continue
            if is_pdf_url(norm):
                if not is_moodle_url(norm):
                    pdf_queue.append(norm)
            elif is_docx_url(norm):
                docx_queue.append(norm)
            elif is_legacy_doc_url(norm):
                continue
            elif same_domain(norm) and not should_skip(norm):
                to_visit.append(norm)
                queued.add(norm)

        # Convert to Markdown using live DOM text
        title, body = get_page_content(page, current_url)

        if looks_like_not_found_page(current_url, title, body):
            print(f"  [SKIP] Not found page skipped: {title[:60]}")
            continue

        if discover_only:
            print(f"     {current_url}  |  {title[:60]}")
            scraped += 1
            continue

        # Build the Markdown document
        header = (
            f"# {title}\n\n"
            f"SOURCE_URL: {current_url}\n\n"
            f"---\n\n"
        )
        links_forms_section = build_links_forms_section(page_links, page_forms)
        full_doc = header + body
        if links_forms_section:
            full_doc += f"\n\n---\n\n{links_forms_section}"

        full_doc += f"\n\n---\n**Original Webpage Link:** {current_url}\n"

        # Skip duplicate content to reduce noisy retraining data.
        content_key = hashlib.sha256(body.encode("utf-8", errors="ignore")).hexdigest()
        if content_key in content_hashes:
            skipped_duplicate_content += 1
            print(f"  [DUP] Duplicate content skipped: {title[:60]}")
            continue
        content_hashes.add(content_key)

        if len(body.strip()) < MIN_CONTENT:
            print(f"  [SHORT] Too short skipped ({len(body.strip())} chars): {title[:60]}")
            continue

        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        stem = sanitise_filename(title)
        filepath = unique_path(OUTPUT_DIR, stem, ".md")
        filepath.write_text(full_doc, encoding="utf-8")
        rel_md_path = filepath.relative_to(OUTPUT_DIR).as_posix()
        page_source_map[rel_md_path] = current_url
        scraped += 1
        size_kb = round(len(full_doc) / 1024, 1)
        if MAX_PAGES <= 0:
            print(f"  [{scraped}] {title[:60]}  ({size_kb} kB)")
        else:
            print(f"  [{scraped}/{MAX_PAGES}] {title[:60]}  ({size_kb} kB)")

    # Download PDFs
    if not discover_only:
        deduped_docs = list(dict.fromkeys(docx_queue))
        if deduped_docs:
            print(f"\n[DOCX] Downloading {len(deduped_docs)} DOCX file(s)...")
            for doc_url in deduped_docs:
                download_docx(page, doc_url, docx_source_map)

        deduped_pdfs = list(dict.fromkeys(pdf_queue))
        if deduped_pdfs:
            print(f"\n[PDF] Downloading {len(deduped_pdfs)} PDF(s)...")
            for pdf_url in deduped_pdfs:
                if is_moodle_url(pdf_url):
                    print(f"  [SKIP] Moodle PDF blocked: {pdf_url}")
                    continue
                download_pdf(page, pdf_url, pdf_source_map)

        DOC_SUBDIR.mkdir(parents=True, exist_ok=True)
        DOC_SOURCE_MAP_FILE.write_text(json.dumps(docx_source_map, indent=2), encoding="utf-8")
        print(f"  [MAP] DOCX source map -> {DOC_SOURCE_MAP_FILE}")

        PDF_SUBDIR.mkdir(parents=True, exist_ok=True)
        PDF_SOURCE_MAP_FILE.write_text(json.dumps(pdf_source_map, indent=2), encoding="utf-8")
        print(f"  [MAP] PDF source map -> {PDF_SOURCE_MAP_FILE}")
        rebuilt_page_map = build_page_source_map_from_markdown_files()
        merged_page_map = {**page_source_map, **rebuilt_page_map}
        # Keep only non-auth HTTP/HTTPS URLs.
        merged_page_map = {
            k: v for k, v in merged_page_map.items()
            if isinstance(k, str) and isinstance(v, str) and v.startswith(("http://", "https://")) and not is_auth_or_login_url(v)
        }

        PAGE_SOURCE_MAP_FILE.write_text(json.dumps(merged_page_map, indent=2), encoding="utf-8")
        print(f"  [MAP] Page source map -> {PAGE_SOURCE_MAP_FILE}")

    return {
        "pages_scraped": scraped,
        "pdfs_queued": len(pdf_queue),
        "docx_queued": len(docx_queue),
        "visited_urls": len(visited),
        "nav_failures": nav_failures,
        "duplicate_skips": skipped_duplicate_content,
    }


#                                                                              
# Entry point
#                                                                              

def main():
    global MAX_PAGES, MIN_CONTENT, EXTRA_ALLOWED_DOMAINS
    parser = argparse.ArgumentParser(description="Roehampton Portal Scraper v2")
    parser.add_argument("--headless",   action="store_true",
                        help="Headless mode (requires saved session cookies)")
    parser.add_argument("--discover",   action="store_true",
                        help="Print discovered URLs only   do not save files")
    parser.add_argument(
        "--max-pages",
        type=int,
        default=MAX_PAGES,
        help=f"Maximum pages to scrape (default: {MAX_PAGES}). Use 0 for unlimited.",
    )
    parser.add_argument("--min-content", type=int, default=MIN_CONTENT,
                        help="Skip saving pages with body text shorter than this many chars (default: 0)")
    parser.add_argument(
        "--output-dir",
        type=str,
        default=os.getenv("SCRAPED_DOCS_DIR", "scraped"),
        help="Scrape output folder under ../pdf files (or absolute path)",
    )
    parser.add_argument(
        "--seed-url",
        action="append",
        default=[],
        help="Additional URL to seed crawl from. Can be passed multiple times.",
    )
    parser.add_argument(
        "--seed-file",
        type=str,
        default="",
        help="Path to a text file containing one seed URL per line.",
    )
    args = parser.parse_args()
    MAX_PAGES = args.max_pages
    MIN_CONTENT = max(0, args.min_content)
    configure_output_paths(args.output_dir)

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
            print(f"\n   Reusing saved session cookies. Opening portal: {PORTAL_URL}")
            try:
                fetch_with_retry(page, PORTAL_URL)
                try:
                    page.wait_for_load_state("networkidle", timeout=12_000)
                except PlaywrightTimeoutError:
                    pass
            except Exception as e:
                print(f"      Could not open portal in headless mode: {e}")

        # After login the user is already on the portal home page.
        # Detect the real domain (may differ from PORTAL_URL due to SSO redirect).
        home_url = page.url
        if is_auth_or_login_url(home_url):
            print("\n   Session appears unauthenticated (redirected to login page).")
            print("LOGIN_REQUIRED=1")
            OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
            rebuilt_page_map = build_page_source_map_from_markdown_files()
            PAGE_SOURCE_MAP_FILE.write_text(json.dumps(rebuilt_page_map, indent=2), encoding="utf-8")
            print(f"      Rebuilt page source map from existing markdown files   {PAGE_SOURCE_MAP_FILE}")
            print("   Run scraper without --headless once, complete login manually, then rerun headless.")
            save_cookies(context)
            browser.close()
            return

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

        print(f"\n     Starting crawl from: {home_url}")
        print(f"     Domain: {HOME_DOMAIN}  Path prefix: {HOME_PATH_PREFIX or '(none)'}")
        print("LOGIN_REQUIRED=0")

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
        print(f"     Discovered {len(all_initial)} links on the home page.\n")

        # Build seed list: home URL first, then discovered child URLs
        seeds = [home_url]
        for href in all_initial:
            if not href:
                continue
            norm = normalise_url(href.strip(), home_url)
            if norm and norm != home_url and same_domain(norm) and not should_skip(norm):
                seeds.append(norm)

        extra_seed_candidates = parse_seed_url_values(list(args.seed_url or [])) + load_seed_urls_from_file(args.seed_file)
        added_extra_seeds = 0
        for seed in extra_seed_candidates:
            try:
                host = urllib.parse.urlparse(seed).netloc
                if host and host != HOME_DOMAIN:
                    EXTRA_ALLOWED_DOMAINS.add(host)
            except Exception:
                pass

        if EXTRA_ALLOWED_DOMAINS:
            print(f"     Extra allowed domains: {', '.join(sorted(EXTRA_ALLOWED_DOMAINS))}")

        for seed in extra_seed_candidates:
            norm = normalise_url(seed.strip(), home_url)
            if norm and norm != home_url and same_domain(norm) and not should_skip(norm):
                seeds.append(norm)
                added_extra_seeds += 1

        if added_extra_seeds:
            print(f"     Added extra seeds from input: {added_extra_seeds}")

        print(f"     Seeds after domain filter: {len(seeds)}\n")
        stats = crawl(page, seeds, discover_only=args.discover)

        save_cookies(context)
        browser.close()

    if args.discover:
        print(
            f"\n   Found {stats['pages_scraped']} pages + {stats.get('docx_queued', 0)} DOCX + {stats['pdfs_queued']} PDFs to download."
        )
    else:
        print(
            f"\n   Done!  {stats['pages_scraped']} pages + {stats.get('docx_queued', 0)} DOCX + {stats['pdfs_queued']} PDFs."
        )
        print(
            f"     Crawl stats: visited={stats['visited_urls']} nav_failures={stats['nav_failures']} duplicate_skips={stats['duplicate_skips']}"
        )
        print(f"   Markdown files: {OUTPUT_DIR}")
        print(f"   PDF files:      {PDF_SUBDIR}")
        print(f"\n   Upload the files via MyUni Admin   AI Training Studio   Incremental Add")


if __name__ == "__main__":
    main()
