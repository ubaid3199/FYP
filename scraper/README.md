# 🕷️ Roehampton Portal Scraper

Scrapes the University of Roehampton student portal using Playwright and saves
the content as `.md` files that can be uploaded directly to the **MyUni AI
Training Studio** (Incremental Add).

---

## 📁 Output

Scraped files are saved to:

```
fyp/pdf files/scraped/          ← HTML pages as .md files
fyp/pdf files/scraped/pdfs/     ← Downloaded PDFs
```

These map directly to what `ingest.ts` reads during RAG training.

---

## ⚙️ Setup

### 1. Create your `.env` file

```bash
cd fyp/scraper
copy .env.example .env
```

Edit `.env` and fill in your credentials:

```
PORTAL_URL=https://portal.roehampton.ac.uk
PORTAL_USERNAME=your_student_id
PORTAL_PASSWORD=your_password
```

### 2. Install Python dependencies

```bash
pip install -r requirements.txt
playwright install chromium
```

---

## 🚀 Usage

### Option A — Interactive login (Recommended first time)

The browser will open visibly. Log in manually if the auto-login doesn't work
(MFA, CAPTCHAs, SSO). Once you're in, **press ENTER** in the terminal.

```bash
python scrape.py
```

Your session cookies are saved to `session_cookies.json` so you don't have to
log in again on the next run.

### Option B — Discover links only (no files saved)

Useful to check what the scraper finds before committing to a full run:

```bash
python scrape.py --discover
```

### Option C — Headless (reuses saved session)

Run silently after you've already saved cookies:

```bash
python scrape.py --headless
```

### Limit the number of pages

```bash
python scrape.py --max-pages 50
```

### Skip very short pages

Useful when portal pages contain shell content/navigation only.

```bash
python scrape.py --min-content 200
```

### Reliability improvements now included

- Automatic navigation retries with backoff for transient timeout failures.
- Duplicate-content skipping to reduce noisy retraining data.
- Safer PDF fallback download validation to avoid saving login HTML as `.pdf`.

---

## 📤 Upload to RAG

After the scrape finishes:

1. Open **MyUni** at `http://localhost:3000`
2. Log in as **admin**
3. Go to **AI Training Studio**
4. Upload the files from `fyp/pdf files/scraped/`
5. Click **Incremental Add**

That's it — the chatbot will now know about your portal content! 🎉
