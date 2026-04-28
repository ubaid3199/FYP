# System Updates & Changelog

This document outlines the recent modifications, optimizations, and features added to the Multimodal RAG Portal project, specifically focusing on the web scraping pipeline and the data ingestion process.

## 1. Web Scraper Enhancements (`scraper/scrape.py`)

The portal scraper was entirely overhauled to prioritize data quality, handle edge cases gracefully, and ensure all visual/interactive elements are preserved for the AI models.

*   **Increased Crawl Capacity**: The maximum page limit was bumped from 300 to **1000 pages**, allowing for a complete, exhaustive crawl of the University portal.
*   **Quality Over Speed (Dynamic Loading)**: The network idle timeout was carefully calibrated to **5 seconds** with an explicit 1-second extra buffer. This prevents incomplete HTML from being scraped on heavy, JS-rendered SharePoint pages, completely eliminating half-loaded text blocks.
*   **Automatic Form & Image Extraction**: 
    *   **Forms**: Injected JavaScript to parse `<input>`, `<textarea>`, and `<select>` elements dynamically *before* inner text extraction. This ensures all interactive form fields (e.g., search bars, submission forms) are recorded as readable text in the Markdown files.
    *   **Images**: Automatically extracts the `alt` text and `src` URL of all visible images, embedding them directly into the textual flow of the page (e.g., `[Image: logo - Link: ...]`).
*   **Robust Error Handling**: Added explicit checks for `HTTP 400+` status codes to instantly skip broken, restricted, or non-existent pages instead of logging useless error pages into the dataset.
*   **Custom Seeds Support**: Added the ability to ingest custom starting points via a `custom_links.txt` file (populated with links provided via email), ensuring specific high-priority pages are always crawled.
*   **Emoji Encoding Fix**: Resolved a critical Windows terminal bug (`UnicodeEncodeError`) by forcing `sys.stdout` to UTF-8, ensuring the final physical image downloads don't crash the script at completion.
*   **Seamless Headless Execution**: Decoupled the manual login requirement from the headless execution mode. If valid session cookies exist, the scraper will immediately launch and reuse them, preventing the script from hanging on manual prompts.

## 2. RAG Ingestion Pipeline (`web-app/scripts/ingest.ts`)

The ingestion script was optimized to guarantee that the local system leverages GPU hardware, significantly accelerating the processing of massive RAG datasets.

*   **Forced GPU Embeddings**: Added `numGpu: -1` to the `OllamaEmbeddings` configuration object. This forces the local embedding model (`nomic-embed-text:latest`) to load completely into VRAM, eliminating CPU bottlenecks during the massive 30,000+ chunk ingestion.
*   **Forced GPU Vision Inference**: Added `num_gpu: -1` to the `options` payload inside the `/api/generate` fetch call. This guarantees that when the system falls back to describing physical images (e.g., using `llava:llava`), the vision model is fully accelerated by the GPU.

## 3. Web App Configuration (`web-app/.env`)

The system's context limits were expanded to accommodate the high-quality data coming from the updated scraper.

*   **Expanded Context Window**: Updated `OLLAMA_NUM_CTX` from `2048` to **`4096`**. Since the system uses $K=4$ retrieval (pulling 4 large document chunks of ~2200 characters each), the total payload easily exceeds 2000 tokens. Setting the context window to 4096 completely eliminates context truncation, ensuring the `gemma3:1b` chat model processes the *entirety* of the retrieved knowledge base before answering.

---
**Status**: The latest massive scrape (72 core pages, 359 PDFs, and extensive image maps) has been finalized, and the GPU-accelerated embedding process is currently running on over 30,000 contextual child chunks.
