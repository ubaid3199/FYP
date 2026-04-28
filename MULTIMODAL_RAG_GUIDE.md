# Multimodal RAG & Scraper — Model Usage Guide

## Overview
Your system now supports **true multimodal RAG** with local models only (no cloud). Images scraped from pages are described using a vision model, then embedded alongside text for retrieval.

## Available Models (Local)

### Vision Models (for image description)
- **`llava:llava`** (recommended) — Full vision-language model, best for understanding images, charts, diagrams, and screenshots
- **`llava:latest`** — LLaVA variant
- **`gemma3:latest`** — Strong text model (can describe images if given base64, but suboptimal)
- **`gemma4:e4b`** — Larger Gemma 4 (text-only fallback)
- **`gpt-oss:20b`** — Large text model (no vision support)

### Chat Models (for response generation)
- **`gemma3:latest`** — Default, fast, good quality
- **`gemma3:1b`** — Smaller, faster, lower quality
- **`gemma4:e2b`** — Larger, higher quality
- **`gemma4:e4b`** — Even larger
- **`gpt-oss:20b`** — Large model, slower but powerful

### Embedding Models
- **`nomic-embed-text:latest`** — Default for vector search

## Environment Variables

Create or edit `.env` in the web-app folder:

```bash
# Vision model for image description (defaults to llava:llava)
IMAGE_DESC_MODEL=llava:llava

# Chat model for answering questions (defaults to gemma3:latest)
OLLAMA_MODEL=gemma3:latest

# Embedding model for vector search (defaults to nomic-embed-text:latest)
OLLAMA_EMBEDDING_MODEL=nomic-embed-text:latest

# Folder name under "pdf files" for scraped content
SCRAPED_DOCS_DIR=scraped_2026_04_21_links
```

## Quick Start

### 1. Install required vision model (if not present)
```bash
ollama pull llava:llava         # Best for image understanding
ollama pull gemma3:latest       # Fast fallback
```

### 2. Run the enhanced scraper (collects text + images)
```bash
cd scraper
# First run (interactive login)
python scrape.py

# Subsequent runs (uses saved cookies)
python scrape.py --headless

# With custom output folder
python scrape.py --output-dir my_scraped_data --max-pages 1000
```

This creates:
- `pdf files/scraped/` — Markdown pages with text content
- `pdf files/scraped/images/` — Downloaded images  
- `pdf files/scraped/images/_image_map.json` — Maps images to their source pages

### 3. Ingest everything (text + image descriptions)
```bash
cd web-app
npm run ingest
```

The script automatically:
- Parses all markdown files and PDFs
- **Generates image descriptions** using your chosen vision model
- Embeds everything into the vector store
- Creates parent/child chunks for hybrid search

### 4. Chat with multimodal knowledge
```bash
# Start the dev server
npm run dev
```

Now the assistant can answer questions based on:
- Text content from pages
- **Image content** (charts, diagrams, screenshots, text-in-images)

## Model Switching Examples

### Use LLaVA for best image understanding
```bash
# .env
IMAGE_DESC_MODEL=llava:llava
OLLAMA_MODEL=gemma3:latest
```

### Use GPT-OSS for heavy reasoning (no vision)
```bash
# Note: GPT-OSS can't process images directly, so pair it with LLaVA for vision
IMAGE_DESC_MODEL=llava:llava
OLLAMA_MODEL=gpt-oss:20b
```

### Fast local setup (smaller models)
```bash
IMAGE_DESC_MODEL=gemma3:latest  # No true vision, but works
OLLAMA_MODEL=gemma3:1b
```

### Best quality setup (recommended)
```bash
IMAGE_DESC_MODEL=llava:llava    # True vision model
OLLAMA_MODEL=gemma4:e2b          # Larger text model
OLLAMA_EMBEDDING_MODEL=nomic-embed-text:latest
```

## How Multimodal RAG Works

1. **Scraping** (`scrape.py`)
   - Downloads images visible on each page
   - Saves images to `images/` folder
   - Creates `_image_map.json` linking images to source URLs

2. **Ingestion** (`ingest.ts`)
   - For each image: generates description using vision model
   - Creates a Document with: `Image (filename): [description]`
   - Embeds this alongside text chunks
   - Metadata tracks `visionModel` used and `imagePath`

3. **Retrieval** (`hybridStore.ts`)
   - Vector search finds relevant text AND image descriptions
   - Hybrid scoring combines BM25 + vector similarity
   - Parent chunks group related text/image content

4. **Chat Response**
   - Retrieved context includes descriptive text about images
   - LLM answers using both page text and image content

## Checking Available Models

```bash
ollama list
```

## Troubleshooting

### "No image source map found"
- Run the scraper first with `--headless` after login
- Ensure it completes without errors

### "Failed to describe image: context length exceeded"
- Vision model ran out of context window
- Try a smaller model or reduce `num_predict` in `ingest.ts`

### "Ollama API error" during image processing
- Model not found locally: `ollama pull llava:llava`
- GPU OOM: Use smaller model like `gemma3:latest`

### "No multimodal response"
- Confirm LLaVA is running: `curl http://localhost:11434/api/tags | grep llava`
- Check `.env` has `IMAGE_DESC_MODEL=llava:llava`
- Re-run `npm run ingest` after changing models

## Performance Tips

- **LLaVA on CPU**: ~10-20s per image (slow!)
- **LLaVA with GPU**: ~2-5s per image (recommended)
- **Gemma3 on CPU**: ~5-10s per image (no true vision but faster)
- **Batch processing**: Ingest runs sequentially; consider smaller batches

## Files Modified

### Scraper (`scraper/scrape.py`)
- Increased `MAX_PAGES` to 5000
- Enhanced skip patterns for SharePoint
- Added image extraction: `extract_images_from_page()`
- Downloads images to `images/` folder
- Saves `_image_map.json` and `_image_source_map.json`
- Auto-discovers seed URLs from all `.txt` files

### Ingest (`web-app/scripts/ingest.ts`)
- Added model availability checking: `checkModelAvailable()`
- Auto-fallback through `IMAGE_DESC_FALLBACKS`
- `generateImageDescription()` with vision model support
- Processes `_image_map.json` into Document objects
- Metadata tracks `visionModel`, `imagePath`, `_image_embedding`

### RAG Store (`web-app/lib/domains/rag/hybridStore.ts`)
- No changes needed — works with any Document content
- Image descriptions embed alongside text naturally
- Parent/child chunking groups related content

## Example Output

```
Successfully parsed 637 total documents 
(47 image descriptions, 590 text documents). 
Preparing parent-child chunks...
Prepared 5519 parent chunks and 15707 child chunks for embedding.
Embedding 15687 child chunks into Vector Store... this might take a minute!
...
Ingest summary: parent chunks=5519, child chunks=15707, embedded child chunks=15687
```

## Key Features

✅ All-local models (no cloud)  
✅ Automatic model detection and fallback  
✅ Vision model for image understanding  
✅ Configurable via environment variables  
✅ Seamless integration with existing hybrid RAG  
✅ Parent/child chunking preserves context  
✅ Metadata tracking for debugging  

